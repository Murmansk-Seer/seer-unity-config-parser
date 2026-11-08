#!/usr/bin/env node

/**
 * 配置变化检测脚本
 * 比较当前生成的JSON文件与上一版本的差异
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

const jsonDir = "./json";
const cacheDir = process.env.PARSER_STATE_DIR || "./.build-state/parser";
const cachePath = path.join(cacheDir, "last-release-hashes.json");

interface FileHash {
  file: string;
  hash: string;
  size: number;
}

interface ChangeInfo {
  file: string;
  type: "added" | "modified" | "removed" | "unchanged";
  oldSize?: number;
  newSize?: number;
  sizeDiff?: string;
}

function calculateFileHash(filePath: string): string {
  const content = Buffer.from(fs.readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n"), "utf-8");
  return crypto.createHash("sha256").update(content).digest("hex");
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getCurrentHashes(): FileHash[] {
  if (!fs.existsSync(jsonDir)) {
    return [];
  }

  const files = fs.readdirSync(jsonDir).filter((f) => f.endsWith(".json")).sort();
  const hashes: FileHash[] = [];

  for (const file of files) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*\.json$/.test(file)) throw new Error(`Invalid JSON filename: ${file}`);
    const filePath = path.join(jsonDir, file);
    const stats = fs.lstatSync(filePath);
    if (!stats.isFile()) throw new Error(`JSON input must be a regular file: ${file}`);
    JSON.parse(fs.readFileSync(filePath, "utf-8"));

    hashes.push({
      file,
      hash: calculateFileHash(filePath),
      size: Buffer.byteLength(fs.readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n"), "utf-8"),
    });
  }

  return hashes;
}

function loadPreviousHashes(): FileHash[] {
  if (!fs.existsSync(cachePath)) {
    if (process.env.PARSER_REQUIRE_STATE === "1") {
      throw new Error("Restore the paired pipeline-state inventory before publishing parser output");
    }
    return [];
  }
  const rows: unknown = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
  if (!Array.isArray(rows)) throw new Error("Parser inventory must be an array");
  if (rows.length === 0 && process.env.PARSER_REQUIRE_STATE === "1") throw new Error("Required parser inventory cannot be empty");
  const seen = new Set<string>();
  return rows.map((row: unknown): FileHash => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error("Invalid parser inventory entry");
    }
    const value = row as Record<string, unknown>;
    if (typeof value.file !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.-]*\.json$/.test(value.file)
      || typeof value.hash !== "string" || !/^[0-9a-f]{64}$/.test(value.hash)
      || !Number.isSafeInteger(value.size) || Number(value.size) < 0
      || Object.keys(value).some((key) => !["file", "hash", "size", "lastModified"].includes(key))
      || seen.has(value.file)) {
      throw new Error("Invalid or duplicate parser inventory entry");
    }
    seen.add(value.file);
    return { file: value.file, hash: value.hash, size: Number(value.size) };
  });
}

function saveCurrentHashes(hashes: FileHash[]): void {
  const content = JSON.stringify(hashes, null, 2) + "\n";
  if (fs.existsSync(cachePath) && fs.readFileSync(cachePath, "utf-8") === content) return;
  fs.mkdirSync(cacheDir, { recursive: true });
  const temporary = `${cachePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, content, { flag: "wx" });
  try {
    fs.renameSync(temporary, cachePath);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function detectChanges(
  current: FileHash[],
  previous: FileHash[]
): ChangeInfo[] {
  const changes: ChangeInfo[] = [];
  const previousMap = new Map(previous.map((h) => [h.file, h]));
  const currentFiles = new Set(current.map((h) => h.file));

  // 检查当前文件
  for (const currentHash of current) {
    const previousHash = previousMap.get(currentHash.file);

    if (!previousHash) {
      // 新增文件
      changes.push({
        file: currentHash.file,
        type: "added",
        newSize: currentHash.size,
      });
    } else if (currentHash.hash !== previousHash.hash) {
      // 文件已修改
      const sizeDiff = currentHash.size - previousHash.size;
      const sizeDiffStr =
        sizeDiff > 0
          ? `+${formatBytes(sizeDiff)}`
          : sizeDiff < 0
          ? `-${formatBytes(Math.abs(sizeDiff))}`
          : "无变化";

      changes.push({
        file: currentHash.file,
        type: "modified",
        oldSize: previousHash.size,
        newSize: currentHash.size,
        sizeDiff: sizeDiffStr,
      });
    } else {
      // 文件未变化
      changes.push({
        file: currentHash.file,
        type: "unchanged",
        newSize: currentHash.size,
      });
    }
  }

  // 检查已删除的文件
  for (const previousHash of previous) {
    if (!currentFiles.has(previousHash.file)) {
      changes.push({
        file: previousHash.file,
        type: "removed",
        oldSize: previousHash.size,
      });
    }
  }

  return changes;
}

function main() {
  console.log("🔍 检测配置文件变化...\n");

  const currentHashes = getCurrentHashes();
  const previousHashes = loadPreviousHashes();

  if (currentHashes.length === 0) {
    console.log("❌ 没有找到当前的JSON文件");
    process.exit(1);
  }

  const changes = detectChanges(currentHashes, previousHashes);

  // 统计变化
  const stats = {
    added: changes.filter((c) => c.type === "added").length,
    modified: changes.filter((c) => c.type === "modified").length,
    removed: changes.filter((c) => c.type === "removed").length,
    unchanged: changes.filter((c) => c.type === "unchanged").length,
  };

  const hasChanges = stats.added > 0 || stats.modified > 0 || stats.removed > 0;

  console.log("📊 变化统计:");
  console.log(`   新增: ${stats.added} 个文件`);
  console.log(`   修改: ${stats.modified} 个文件`);
  console.log(`   删除: ${stats.removed} 个文件`);
  console.log(`   未变: ${stats.unchanged} 个文件`);
  console.log("");

  if (hasChanges) {
    console.log("📋 详细变化:");

    // 显示新增文件
    const addedFiles = changes.filter((c) => c.type === "added");
    if (addedFiles.length > 0) {
      console.log("  🆕 新增文件:");
      addedFiles.forEach((c) => {
        console.log(`     + ${c.file} (${formatBytes(c.newSize!)})`);
      });
    }

    // 显示修改文件
    const modifiedFiles = changes.filter((c) => c.type === "modified");
    if (modifiedFiles.length > 0) {
      console.log("  📝 修改文件:");
      modifiedFiles.forEach((c) => {
        console.log(
          `     ~ ${c.file} (${formatBytes(c.oldSize!)} → ${formatBytes(
            c.newSize!
          )}, ${c.sizeDiff})`
        );
      });
    }

    // 显示删除文件
    const removedFiles = changes.filter((c) => c.type === "removed");
    if (removedFiles.length > 0) {
      console.log("  🗑️  删除文件:");
      removedFiles.forEach((c) => {
        console.log(`     - ${c.file} (${formatBytes(c.oldSize!)})`);
      });
    }

    console.log("\n✅ 检测到配置变化，建议发布新版本");

    // 输出环境变量给GitHub Actions使用
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `has_config_changes=true\n`);
      fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        `changes_summary=新增${stats.added}个,修改${stats.modified}个,删除${stats.removed}个\n`
      );
    }
  } else {
    console.log("ℹ️ 没有检测到配置变化");

    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        `has_config_changes=false\n`
      );
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `changes_summary=无变化\n`);
    }
  }

  // 保存当前哈希以供下次比较
  saveCurrentHashes(currentHashes);

  console.log(`\n💾 已保存当前文件哈希到 ${cachePath}`);

  process.exit(0);
}

main();
