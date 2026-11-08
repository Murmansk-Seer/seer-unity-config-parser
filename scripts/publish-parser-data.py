"""Publish validated parser JSON only; state is published separately after success."""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import subprocess
import sys


def git(*args: str, input: bytes | None = None) -> bytes:
    result = subprocess.run(["git", *args], input=input, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr.decode("utf-8", "replace"))
    return result.stdout


def publish() -> str:
    expected = os.environ.get("PARSER_BASE_REVISION", "")
    if not re.fullmatch(r"[0-9a-f]{40}", expected):
        raise ValueError("PARSER_BASE_REVISION must identify the validated checkout")
    if git("rev-parse", "HEAD").decode().strip() != expected:
        raise RuntimeError("Parser checkout changed during generation")
    if git("diff", "--name-only", "-z", "--", ".", ":(exclude)json"):
        raise RuntimeError("Tracked maintenance files changed during parsing")
    remote = git("ls-remote", "--heads", "origin", "refs/heads/main").decode().split()
    if not remote or remote[0] != expected:
        raise RuntimeError("Remote main changed; rerun parsing from a fresh checkout")
    if git("diff", "--cached", "--name-only", "-z"):
        raise RuntimeError("Unexpected staged files before parser data publication")
    git("add", "--all", "--", "json")
    names = [x.decode() for x in git("diff", "--cached", "--name-only", "-z").split(b"\0") if x]
    if any(not re.fullmatch(r"json/[A-Za-z0-9][A-Za-z0-9_.-]*\.json", name) for name in names):
        raise RuntimeError("Parser publication may stage only top-level JSON files")
    # Revalidate current JSON and the successful detector output before a commit.
    state = Path(os.environ.get("PARSER_STATE_DIR", ".build-state/parser")) / "last-release-hashes.json"
    inventory = json.loads(state.read_text(encoding="utf-8"))
    import hashlib
    actual = []
    for path in sorted(Path("json").glob("*.json"), key=lambda path: path.name):
        if path.is_symlink() or not path.is_file():
            raise ValueError("Parser JSON must be a regular file")
        raw = path.read_bytes().replace(b"\r\n", b"\n")
        json.loads(raw)
        actual.append({"file": path.name, "hash": hashlib.sha256(raw).hexdigest(), "size": len(raw)})
    if not actual:
        raise RuntimeError("Refuse to publish an empty parser output set")
    if inventory != actual:
        raise RuntimeError("JSON changed after successful inventory generation")
    if not names:
        print(json.dumps({"data_changed": False, "revision": expected}))
        return expected
    manifest = json.loads(Path("ConfigPackage/PackageManifest_ConfigPackage.json").read_text(encoding="utf-8"))
    version = manifest.get("version")
    if not isinstance(version, str) or not re.fullmatch(r"[0-9]{14}", version):
        raise ValueError("A validated official package version is required for a data commit")
    message = (
        f"data(parser): refresh configuration {version}\n\n"
        f"EN reason/scope: Commit only validated parsed JSON changes for official input package {version}. "
        f"Parser source: {expected}. Runtime inventory stays on pipeline-state. "
        "Verification: caller completed strict parsing/merge/validation; output hashes are rechecked here. "
        "The package version records this run's input, not a new ownership claim for retained legacy files.\n\n"
        f"中文原因与范围：仅提交官方输入包{version}对应本次已验证的解析JSON变化；"
        f"解析器源码为{expected}，运行清单保留于pipeline-state。"
        "验证：调用方已完成严格解析、合并及校验，此处再次核对输出哈希。"
        "包版本仅记录本次输入，不重新认定保留的遗留文件来源。\n"
    )
    git("-c", "user.name=github-actions[bot]", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com", "commit", "--file=-", input=message.encode())
    revision = git("rev-parse", "HEAD").decode().strip()
    git("push", "origin", revision + ":refs/heads/main")
    print(json.dumps({"data_changed": True, "revision": revision, "input_package_version": version}))
    return revision


if __name__ == "__main__":
    try:
        publish()
    except (OSError, ValueError, RuntimeError) as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1) from exc
