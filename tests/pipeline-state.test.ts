import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, utimesSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(project, "node_modules/tsx/dist/cli.mjs");
const script = join(project, "scripts/detect-changes.ts");
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "parser-state-test-"));
  const state = join(root, ".build-state/parser");
  mkdirSync(join(root, "json"));
  writeFileSync(join(root, "json/b.json"), '{"id":2}');
  writeFileSync(join(root, "json/a.json"), '{"id":1}');
  const cache = join(state, "last-release-hashes.json");
  const run = (required = false) => {
    const output = join(root, "outputs.txt");
    writeFileSync(output, "");
    const result = spawnSync(process.execPath, [cli, script], {
      cwd: root, encoding: "utf8",
      env: { ...process.env, PARSER_STATE_DIR: state, PARSER_REQUIRE_STATE: required ? "1" : "", GITHUB_OUTPUT: output },
    });
    return { ...result, actions: readFileSync(output, "utf8") };
  };
  return { root, state, cache, run, close() {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(root.includes("parser-state-test-"));
    rmSync(root, { recursive: true, force: true });
  } };
}

test("touching identical JSON and repeated polling keep canonical inventory bytes", () => {
  const f = fixture(); try {
    assert.equal(f.run().status, 0);
    const before = readFileSync(f.cache, "utf8");
    assert.deepEqual(JSON.parse(before).map((x) => x.file), ["a.json", "b.json"]);
    assert.ok(JSON.parse(before).every((x) => Object.keys(x).join(",") === "file,hash,size"));
    utimesSync(join(f.root, "json/a.json"), new Date(0), new Date());
    for (let i = 0; i < 2; i++) {
      const result = f.run(true); assert.equal(result.status, 0, result.stderr);
      assert.match(result.actions, /has_config_changes=false/);
      assert.equal(readFileSync(f.cache, "utf8"), before);
    }
  } finally { f.close(); }
});

test("real changes and deletions update hashes and preserve the remaining set", () => {
  const f = fixture(); try {
    assert.equal(f.run().status, 0);
    writeFileSync(join(f.root, "json/a.json"), '{"id":10}');
    rmSync(join(f.root, "json/b.json"));
    const result = f.run(true); assert.equal(result.status, 0, result.stderr);
    assert.match(result.actions, /has_config_changes=true/);
    assert.deepEqual(JSON.parse(readFileSync(f.cache, "utf8")).map((x) => x.file), ["a.json"]);
  } finally { f.close(); }
});

test("legacy timestamps may migrate once without becoming data changes", () => {
  const f = fixture(); try {
    assert.equal(f.run().status, 0);
    const rows = JSON.parse(readFileSync(f.cache, "utf8")).reverse();
    rows.forEach((row) => row.lastModified = "2026-01-01T00:00:00Z");
    writeFileSync(f.cache, JSON.stringify(rows));
    const result = f.run(true); assert.equal(result.status, 0, result.stderr);
    assert.match(result.actions, /has_config_changes=false/);
    assert.ok(!readFileSync(f.cache, "utf8").includes("lastModified"));
    const after = readFileSync(f.cache, "utf8"); assert.equal(f.run(true).status, 0);
    assert.equal(readFileSync(f.cache, "utf8"), after);
  } finally { f.close(); }
});

test("missing paired state fails before creating an inventory in CI", () => {
  const f = fixture(); try {
    assert.notEqual(f.run(true).status, 0); assert.ok(!existsSync(f.cache));
  } finally { f.close(); }
});

for (const kind of ["malformed", "duplicate", "path", "hash", "size", "empty"]) {
  test(`invalid ${kind} state never replaces the previous checkpoint`, () => {
    const f = fixture(); try {
      assert.equal(f.run().status, 0);
      const rows = JSON.parse(readFileSync(f.cache, "utf8"));
      if (kind === "duplicate") rows.push(rows[0]);
      if (kind === "path") rows[0].file = "../outside.json";
      if (kind === "hash") rows[0].hash = "invalid";
      if (kind === "size") rows[0].size = -1;
      const bad = kind === "malformed" ? "{" : JSON.stringify(kind === "empty" ? [] : rows);
      writeFileSync(f.cache, bad);
      assert.notEqual(f.run(true).status, 0);
      assert.equal(readFileSync(f.cache, "utf8"), bad);
    } finally { f.close(); }
  });
}

test("truncated JSON cannot advance the previous inventory", () => {
  const f = fixture(); try {
    assert.equal(f.run().status, 0); const before = readFileSync(f.cache, "utf8");
    writeFileSync(join(f.root, "json/a.json"), "{");
    assert.notEqual(f.run(true).status, 0);
    assert.equal(readFileSync(f.cache, "utf8"), before);
  } finally { f.close(); }
});

test("a JSON-named directory cannot be published as a file", () => {
  const f = fixture(); try {
    mkdirSync(join(f.root, "json/not-a-file.json"));
    assert.notEqual(f.run().status, 0); assert.ok(!existsSync(f.cache));
  } finally { f.close(); }
});


test("checkout CRLF and LF share one inventory without a polling commit", () => {
  const f = fixture(); try {
    writeFileSync(join(f.root, "json/a.json"), '{\n  "id":1\n}\n');
    assert.equal(f.run().status, 0); const before = readFileSync(f.cache, "utf8");
    writeFileSync(join(f.root, "json/a.json"), '{\r\n  "id":1\r\n}\r\n');
    const result = f.run(true); assert.equal(result.status, 0, result.stderr);
    assert.match(result.actions, /has_config_changes=false/);
    assert.equal(readFileSync(f.cache, "utf8"), before);
  } finally { f.close(); }
});


test("mixed-case filenames use one ordinal inventory order", () => {
  const f = fixture(); try {
    writeFileSync(join(f.root, "json/Z.json"), '{"id":99}');
    assert.equal(f.run().status, 0);
    assert.deepEqual(JSON.parse(readFileSync(f.cache, "utf8")).map((row) => row.file), ["Z.json", "a.json", "b.json"]);
    assert.equal(f.run(true).status, 0);
  } finally { f.close(); }
});
