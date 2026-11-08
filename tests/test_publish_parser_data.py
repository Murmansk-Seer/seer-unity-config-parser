"""Exercise publication against temporary local bare remotes, never a service."""
from __future__ import annotations

from contextlib import contextmanager
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/publish-parser-data.py"
spec = importlib.util.spec_from_file_location("publish_parser_data", SCRIPT)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="parser-publish-test-")
        self.root = Path(self.temporary.name).resolve()
        self.repo = self.root / "checkout"
        self.remote = self.root / "origin.git"
        self.repo.mkdir()
        self.command("git", "init", "--bare", str(self.remote))
        self.command("git", "init", "-b", "main", str(self.repo))
        self.git("config", "user.name", "Parser local test")
        self.git("config", "user.email", "test@local.invalid")
        (self.repo / "json").mkdir()
        (self.repo / "README.md").write_text("maintenance\n")
        (self.repo / ".gitignore").write_text(".build-state/\nConfigPackage/\n")
        (self.repo / "json/a.json").write_text('{"id":1}')
        (self.repo / "json/b.json").write_text('{"id":2}')
        self.git("add", "README.md", ".gitignore", "json")
        self.git("commit", "-m", "data(test): seed parser data")
        self.base = self.git("rev-parse", "HEAD")
        self.git("remote", "add", "origin", str(self.remote))
        assert Path(self.git("remote", "get-url", "origin")).resolve() == self.remote
        self.git("push", "-u", "origin", "main")
        (self.repo / "ConfigPackage").mkdir()
        (self.repo / "ConfigPackage/PackageManifest_ConfigPackage.json").write_text(json.dumps({"version": "20261106181039"}))
        self.inventory()

    def tearDown(self):
        assert self.root.parent == Path(tempfile.gettempdir()).resolve()
        assert self.root.name.startswith("parser-publish-test-")
        self.temporary.cleanup()

    def command(self, *args, cwd=None):
        result = subprocess.run(args, cwd=cwd, capture_output=True)
        if result.returncode:
            raise RuntimeError(result.stderr.decode("utf-8", "replace"))
        return result.stdout.decode().strip()

    def git(self, *args):
        return self.command("git", "-C", str(self.repo), *args)

    def remote_git(self, *args):
        return self.command("git", "--git-dir=" + str(self.remote), *args)

    def inventory(self):
        rows = []
        for path in sorted((self.repo / "json").glob("*.json"), key=lambda path: path.name):
            raw = path.read_bytes().replace(b"\r\n", b"\n")
            rows.append({"file": path.name, "hash": hashlib.sha256(raw).hexdigest(), "size": len(raw)})
        path = self.repo / ".build-state/parser/last-release-hashes.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(rows, indent=2) + "\n")
        return path

    @contextmanager
    def environment(self):
        previous = Path.cwd()
        os.chdir(self.repo)
        try:
            with patch.dict(os.environ, {"PARSER_BASE_REVISION": self.base, "PARSER_STATE_DIR": ".build-state/parser"}):
                yield
        finally:
            os.chdir(previous)

    def publish(self):
        with self.environment():
            return module.publish()

    def test_unchanged_does_not_commit_main(self):
        self.assertEqual(self.publish(), self.base)
        self.assertEqual(self.remote_git("rev-list", "--count", "main"), "1")
        self.assertEqual(self.git("rev-parse", "HEAD"), self.base)

    def test_real_data_change_commits_only_json_with_source_evidence(self):
        (self.repo / "json/a.json").write_text('{"id":10}')
        self.inventory()
        head = self.publish()
        self.assertNotEqual(head, self.base)
        self.assertEqual(self.remote_git("rev-parse", "main"), head)
        self.assertEqual(self.git("diff-tree", "--no-commit-id", "--name-only", "-r", head), "json/a.json")
        message = self.git("show", "-s", "--format=%B", head)
        self.assertIn("data(parser): refresh configuration 20261106181039", message)
        self.assertIn(self.base, message)
        self.assertIn("中文原因与范围", message)
        self.base = head
        self.assertEqual(self.publish(), head)
        self.assertEqual(self.remote_git("rev-list", "--count", "main"), "2")

    def test_mixed_case_inventory_matches_javascript_filename_order(self):
        (self.repo / "json/Z.json").write_text('{"id":99}')
        inventory = self.inventory()
        self.assertEqual([row["file"] for row in json.loads(inventory.read_text())], ["Z.json", "a.json", "b.json"])
        head = self.publish()
        self.assertNotEqual(head, self.base)
        self.assertEqual(self.remote_git("rev-parse", "main"), head)

    def test_deleted_json_is_explicit_data_change(self):
        (self.repo / "json/b.json").unlink()
        self.inventory()
        head = self.publish()
        self.assertEqual(self.git("diff-tree", "--no-commit-id", "--name-status", "-r", head), "D\tjson/b.json")

    def test_concurrent_main_update_rejects_before_commit(self):
        other = self.root / "other"
        self.command("git", "clone", "-b", "main", str(self.remote), str(other))
        self.command("git", "-C", str(other), "config", "user.name", "Other local test")
        self.command("git", "-C", str(other), "config", "user.email", "other@local.invalid")
        (other / "README.md").write_text("concurrent maintenance\n")
        self.command("git", "-C", str(other), "commit", "-am", "docs(test): concurrent update")
        self.command("git", "-C", str(other), "push", "origin", "main")
        with self.assertRaisesRegex(RuntimeError, "Remote main changed"):
            self.publish()
        self.assertEqual(self.git("rev-parse", "HEAD"), self.base)
        self.assertEqual(self.remote_git("show", "main:json/a.json"), '{"id":1}')

    def test_unrelated_staged_file_rejects(self):
        (self.repo / "unexpected.txt").write_text("do not publish")
        self.git("add", "unexpected.txt")
        with self.assertRaisesRegex(RuntimeError, "Unexpected staged"):
            self.publish()
        self.assertEqual(self.remote_git("rev-parse", "main"), self.base)

    def test_tracked_maintenance_edit_rejects(self):
        (self.repo / "README.md").write_text("changed during parse")
        with self.assertRaisesRegex(RuntimeError, "Tracked maintenance"):
            self.publish()
        self.assertEqual(self.remote_git("rev-parse", "main"), self.base)

    def test_changed_json_after_detector_rejects(self):
        (self.repo / "json/a.json").write_text('{"id":10}')
        with self.assertRaisesRegex(RuntimeError, "JSON changed after"):
            self.publish()
        self.assertEqual(self.remote_git("rev-parse", "main"), self.base)

    def test_malformed_json_does_not_replace_remote(self):
        (self.repo / "json/a.json").write_text("{")
        self.inventory()
        with self.assertRaises(ValueError):
            self.publish()
        self.assertEqual(self.remote_git("rev-parse", "main"), self.base)

    def test_missing_inventory_rejects_even_without_data_change(self):
        self.inventory().unlink()
        with self.assertRaises(OSError):
            self.publish()
        self.assertEqual(self.remote_git("rev-parse", "main"), self.base)

    def test_invalid_version_rejects_before_commit(self):
        (self.repo / "json/a.json").write_text('{"id":10}')
        self.inventory()
        (self.repo / "ConfigPackage/PackageManifest_ConfigPackage.json").write_text('{"version":"unknown"}')
        with self.assertRaises(ValueError):
            self.publish()
        self.assertEqual(self.git("rev-parse", "HEAD"), self.base)
        self.assertEqual(self.remote_git("rev-parse", "main"), self.base)

    def test_push_rejection_does_not_replace_remote(self):
        hook = self.remote / "hooks/pre-receive"
        hook.write_text("#!/bin/sh\nexit 1\n")
        hook.chmod(0o755)
        (self.repo / "json/a.json").write_text('{"id":10}')
        self.inventory()
        with self.assertRaises(RuntimeError):
            self.publish()
        self.assertEqual(self.remote_git("rev-parse", "main"), self.base)
        self.assertEqual(self.remote_git("show", "main:json/a.json"), '{"id":1}')


if __name__ == "__main__":
    unittest.main()
