#!/usr/bin/env python3
"""scripts/evidence-bundle-check.py 的自带测试（P3 试点初稿）。

覆盖：正常产物通过、缺失截图报错、SHA 不一致报错、synthetic 未标注报错，
另加一项：断言数与测试用例数未分开记录时报错。

本地运行（Python 3.12，仅标准库）：
  python3 -m unittest discover -s scripts -v
  python3 scripts/test_evidence_bundle_check.py
"""

import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

BASE_SHA = "bec5b2d6daa608a68a5949fec7f2cab5c0218c62"
COMMIT_SHA = "c" * 40
BRANCH = "feat/p3-evidence-script-20261114"
REQUEST_ID = "lauren-p3-evidence-20261114-01"


def _load_module():
    path = Path(__file__).with_name("evidence-bundle-check.py")
    spec = importlib.util.spec_from_file_location("evidence_bundle_check", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


MODULE = _load_module()


def _manifest(png_sha256):
    return {
        "schema_version": 1,
        "bundle_id": "p3-evidence-test-01",
        "request_id": REQUEST_ID,
        "repository": "vileosbot-bot/lapis-rebuild",
        "revision": {
            "branch": BRANCH,
            "base_commit_sha": BASE_SHA,
            "commit_sha": COMMIT_SHA,
            "parent_commit_sha": "d" * 40,
            "tested_commit_sha": COMMIT_SHA,
            "observed_main_head_sha": BASE_SHA,
        },
        "scope": {
            "task_kind": "p3-evidence-script",
            "feature_ids": ["CH1-XXX"],
            "summary": "P3 试点：证据整理脚本自测用产物",
        },
        "changed_files": [
            {
                "path": "scripts/evidence-bundle-check.py",
                "change_status": "added",
                "line_count": 533,
                "git_blob_sha": "d" * 40,
            }
        ],
        "environment": {
            "python": "3.12.0",
            "platform": "linux",
            "node": "22.12.0",
        },
        "command_execution": {
            "status": "RECORDED",
            "commands": [
                {
                    "command": "python3 -m unittest discover -s scripts -v",
                    "working_directory": ".",
                    "exit_code": 0,
                    "result": "PASS",
                    "tested_commit_sha": COMMIT_SHA,
                    "notes": "",
                }
            ],
        },
        "static_verification": {
            "status": "PASS_RECORDED",
            "basis": "repository_audit",
            "checks": [],
            "independent_replay": {"status": "NOT_RUN"},
            "notes": "",
        },
        "runtime_acceptance": {
            "status": "PASS",
            "runtime_status": "PASS",
            "environment_kind": "production_preview",
            "tested_commit_sha": COMMIT_SHA,
            "feature_results": [],
            "notes": "",
        },
        "test_summary": {
            "test_cases": {
                "total": 2, "passed": 2, "failed": 0, "skipped": 0, "not_run": 0,
            },
            "assertions": {
                "total": 5, "executed": 5, "passed": 5,
                "failed": 0, "blocked": 0, "not_run": 0,
            },
        },
        "screenshots": {
            "status": "CAPTURED",
            "items": [
                {
                    "filename": "ch1-home.png",
                    "feature_id": "CH1-XXX",
                    "capture_point": "home",
                    "image_kind": "real_browser",
                    "sha256": png_sha256,
                    "artifact_location": "screenshots/ch1-home.png",
                    "status": "CAPTURED",
                }
            ],
        },
        "logs_and_artifacts": {
            "playwright_json": "playwright.json",
            "failure_trace": "NOT_RUN",
            "console_log": "NOT_RUN",
            "page_error_log": "NOT_RUN",
        },
        "provenance": [
            {
                "source_project": "vileosbot-bot/lapis-rebuild",
                "source_artifact": "manifest.json",
                "source_locator": "artifacts/manifest.json",
                "fingerprint_type": "sha256",
                "fingerprint": png_sha256,
                "fingerprint_origin": "实际文件字节",
                "raw_source_in_repository": True,
                "evidence_level": "INFERRED",
                "runtime_verified": False,
            }
        ],
        "known_gaps": [],
        "worker_verdict": "PASS",
        "manager_review": {
            "status": "NOT_RECORDED",
            "reviewed_commit_sha": "NOT_RECORDED",
            "readback_checks": [],
            "verdict": "NOT_RECORDED",
        },
    }


def _playwright():
    return {
        "suites": [
            {
                "title": "e2e",
                "specs": [
                    {
                        "title": "home loads",
                        "tests": [
                            {"title": "home loads", "results": [{"status": "passed"}]}
                        ],
                    },
                    {
                        "title": "second",
                        "tests": [
                            {"title": "second", "results": [{"status": "passed"}]}
                        ],
                    },
                ],
            }
        ]
    }


class EvidenceBundleCheckTests(unittest.TestCase):
    def _make_artifacts(self, tmp):
        artifacts = Path(tmp) / "artifacts"
        (artifacts / "screenshots").mkdir(parents=True)
        png = b"\x89PNG\r\n\x1a\nfake-screenshot-bytes"
        png_sha256 = hashlib.sha256(png).hexdigest()
        (artifacts / "screenshots" / "ch1-home.png").write_bytes(png)
        manifest = _manifest(png_sha256)
        (artifacts / "manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        (artifacts / "playwright.json").write_text(
            json.dumps(_playwright()), encoding="utf-8")
        (artifacts / "checkpoints.json").write_text(
            json.dumps({"checkpoints": [{"feature_id": "CH1-XXX", "checkpoint": "home",
                                         "screenshot": "ch1-home.png",
                                         "image_kind": "real_browser"}]}),
            encoding="utf-8")
        return artifacts, manifest

    def _run(self, artifacts, out):
        return MODULE.main([
            "--artifacts", str(artifacts), "--out", str(out),
            "--branch", BRANCH, "--commit-sha", COMMIT_SHA, "--base-sha", BASE_SHA,
        ])

    def _read_out(self, out):
        return json.loads((Path(out) / "evidence-bundle.json").read_text(encoding="utf-8"))

    def test_valid_bundle_passes(self):
        with tempfile.TemporaryDirectory() as tmp:
            artifacts, _ = self._make_artifacts(tmp)
            out = Path(tmp) / "out"
            self.assertEqual(self._run(artifacts, out), 0)
            bundle = self._read_out(out)
            self.assertEqual(bundle["verdict"], "PASS")
            self.assertEqual(bundle["errors"], [])
            self.assertTrue(all(c["result"] == "PASS" for c in bundle["checks"]))
            markdown = (out / "evidence-bundle.md").read_text(encoding="utf-8")
            self.assertIn(REQUEST_ID, markdown)
            self.assertIn("ch1-home.png", markdown)
            self.assertIn("real_browser", markdown)

    def test_missing_screenshot_errors(self):
        with tempfile.TemporaryDirectory() as tmp:
            artifacts, _ = self._make_artifacts(tmp)
            (artifacts / "screenshots" / "ch1-home.png").unlink()
            out = Path(tmp) / "out"
            self.assertEqual(self._run(artifacts, out), 1)
            bundle = self._read_out(out)
            self.assertTrue(any("ch1-home.png" in e for e in bundle["errors"]))

    def test_sha_mismatch_errors(self):
        with tempfile.TemporaryDirectory() as tmp:
            artifacts, manifest = self._make_artifacts(tmp)
            manifest["screenshots"]["items"][0]["sha256"] = "0" * 64
            (artifacts / "manifest.json").write_text(
                json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
            out = Path(tmp) / "out"
            self.assertEqual(self._run(artifacts, out), 1)
            bundle = self._read_out(out)
            self.assertTrue(any("SHA-256" in e for e in bundle["errors"]))

    def test_synthetic_unlabelled_errors(self):
        with tempfile.TemporaryDirectory() as tmp:
            artifacts, manifest = self._make_artifacts(tmp)
            # 检查点称其为 synthetic，但清单未标注 image_kind。
            manifest["screenshots"]["items"][0]["image_kind"] = ""
            (artifacts / "manifest.json").write_text(
                json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
            (artifacts / "checkpoints.json").write_text(
                json.dumps({"checkpoints": [{"feature_id": "CH1-XXX", "checkpoint": "home",
                                             "screenshot": "ch1-home.png",
                                             "image_kind": "synthetic_harness"}]}),
                encoding="utf-8")
            out = Path(tmp) / "out"
            self.assertEqual(self._run(artifacts, out), 1)
            bundle = self._read_out(out)
            self.assertTrue(any("image_kind" in e for e in bundle["errors"]))

    def test_counts_must_be_separate(self):
        with tempfile.TemporaryDirectory() as tmp:
            artifacts, manifest = self._make_artifacts(tmp)
            del manifest["test_summary"]["assertions"]
            (artifacts / "manifest.json").write_text(
                json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
            out = Path(tmp) / "out"
            self.assertEqual(self._run(artifacts, out), 1)
            bundle = self._read_out(out)
            self.assertTrue(any("assertions" in e for e in bundle["errors"]))


if __name__ == "__main__":
    unittest.main()
