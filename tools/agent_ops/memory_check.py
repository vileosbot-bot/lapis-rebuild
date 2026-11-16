#!/usr/bin/env python3
"""Zero-token integrity checker for a downloaded Drive agent-memory Git snapshot.

The Drive ZIP is downloaded by the authenticated Drive connector/CLI to a local
read-only path; this script compares its contents with the current Git main tree.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any

import backup_memory


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def current_git_snapshot(repo: Path, *, no_fetch: bool, ref: str) -> tuple[str, dict[str, dict[str, Any]]]:
    head = backup_memory.resolve_git_head(repo, no_fetch=no_fetch, ref=ref)
    return head, backup_memory.read_git_snapshot(repo, head)


def parse_manifest(data: bytes) -> dict[str, str]:
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError("manifest.sha256 不是 UTF-8") from exc
    result: dict[str, str] = {}
    for line_no, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            continue
        if "  " not in line:
            raise ValueError("manifest 第 %d 行格式错误" % line_no)
        digest, path = line.split("  ", 1)
        if len(digest) != 64 or any(ch not in "0123456789abcdef" for ch in digest):
            raise ValueError("manifest 第 %d 行 SHA-256 格式错误" % line_no)
        if path in result:
            raise ValueError("manifest 出现重复路径：%s" % path)
        result[path] = digest
    return result


def check_archive(repo: Path, archive_path: Path, *, no_fetch: bool = False, ref: str = "main") -> dict[str, Any]:
    errors: list[str] = []
    head = ""
    file_count = 0
    checked_files: list[dict[str, Any]] = []
    try:
        head, snapshot = current_git_snapshot(repo, no_fetch=no_fetch, ref=ref)
        file_count = len(snapshot)
    except Exception as exc:
        return {"status": "FAIL", "errors": ["读取 Git 主本失败：%s" % exc], "git_head": None, "file_count": 0}

    try:
        with zipfile.ZipFile(archive_path, "r") as archive:
            bad_entry = archive.testzip()
            if bad_entry:
                errors.append("ZIP CRC 损坏：%s" % bad_entry)
            names = archive.namelist()
            if len(names) != len(set(names)):
                errors.append("ZIP 含重复条目")
            for name in names:
                parsed = PurePosixPath(name)
                if name.startswith("/") or "\\" in name or ".." in parsed.parts:
                    errors.append("ZIP 含不安全路径：%s" % name)
            if "metadata.json" not in names:
                errors.append("缺 metadata.json")
            if "manifest.sha256" not in names:
                errors.append("缺 manifest.sha256")
            if errors:
                return {"status": "FAIL", "errors": errors, "git_head": head, "file_count": file_count}
            metadata = json.loads(archive.read("metadata.json").decode("utf-8"))
            manifest = parse_manifest(archive.read("manifest.sha256"))
            expected_paths = set(snapshot)
            expected_zip_names = expected_paths | {"metadata.json", "manifest.sha256"}
            if set(names) != expected_zip_names:
                missing = sorted(expected_zip_names - set(names))
                extra = sorted(set(names) - expected_zip_names)
                if missing:
                    errors.append("ZIP 缺少条目：%s" % ", ".join(missing))
                if extra:
                    errors.append("ZIP 出现额外条目：%s" % ", ".join(extra))
            if metadata.get("repository") != backup_memory.REPOSITORY:
                errors.append("metadata repository 不匹配")
            if metadata.get("git_ref") != "refs/heads/main":
                errors.append("metadata git_ref 不是 refs/heads/main")
            if metadata.get("git_head") != head:
                errors.append("Git HEAD 不匹配：包内 %s / 当前 %s" % (metadata.get("git_head"), head))
            if metadata.get("file_count") != len(snapshot):
                errors.append("metadata file_count 不匹配：包内 %s / 当前 %d" % (metadata.get("file_count"), len(snapshot)))
            metadata_files = metadata.get("files")
            if not isinstance(metadata_files, list):
                errors.append("metadata.files 不是数组")
                metadata_files = []
            metadata_map: dict[str, dict[str, Any]] = {}
            for entry in metadata_files:
                if not isinstance(entry, dict) or not isinstance(entry.get("path"), str):
                    errors.append("metadata.files 含无效条目")
                    continue
                path = entry["path"]
                if path in metadata_map:
                    errors.append("metadata.files 出现重复路径：%s" % path)
                metadata_map[path] = entry
            if set(metadata_map) != expected_paths:
                errors.append("metadata 文件路径集合与 Git 主本不一致")
            expected_manifest_paths = expected_paths | {"metadata.json"}
            if set(manifest) != expected_manifest_paths:
                errors.append("manifest 路径集合与 Git 主本/metadata 不一致")
            metadata_bytes = archive.read("metadata.json")
            if manifest.get("metadata.json") != sha256_bytes(metadata_bytes):
                errors.append("metadata.json 的 manifest SHA-256 不匹配")
            for path, git_entry in snapshot.items():
                if path not in names:
                    continue
                data = archive.read(path)
                actual_sha = sha256_bytes(data)
                actual_size = len(data)
                meta_entry = metadata_map.get(path, {})
                if actual_sha != meta_entry.get("sha256"):
                    errors.append("metadata SHA-256 不匹配：%s" % path)
                if actual_size != meta_entry.get("size_bytes"):
                    errors.append("metadata 字节数不匹配：%s" % path)
                if actual_sha != git_entry["sha256"]:
                    errors.append("与当前 Git 文件 SHA-256 不匹配：%s" % path)
                if actual_sha != manifest.get(path):
                    errors.append("manifest SHA-256 不匹配：%s" % path)
                checked_files.append({"path": path, "size_bytes": actual_size, "sha256": actual_sha, "match": actual_sha == git_entry["sha256"]})
    except (OSError, zipfile.BadZipFile, KeyError, ValueError, json.JSONDecodeError) as exc:
        errors.append("读取或解析 ZIP 失败：%s" % exc)
    return {
        "status": "PASS" if not errors else "FAIL",
        "errors": errors,
        "repository": backup_memory.REPOSITORY,
        "git_head": head,
        "archive": str(archive_path),
        "file_count": file_count,
        "checked_file_count": len(checked_files),
        "checked_files": checked_files,
    }


def make_test_repo(root: Path) -> Path:
    repo = root / "repo"
    repo.mkdir()
    subprocess.run(["git", "init", "-b", "main", str(repo)], check=True, capture_output=True)
    subprocess.run(["git", "-C", str(repo), "config", "user.name", "Memory Check Test"], check=True)
    subprocess.run(["git", "-C", str(repo), "config", "user.email", "memory-check-test@example.invalid"], check=True)
    (repo / "README.md").write_text("# fixture\n", encoding="utf-8")
    (repo / "core").mkdir()
    (repo / "core" / "rules.md").write_text("# rules\nfixture only\n", encoding="utf-8")
    subprocess.run(["git", "-C", str(repo), "add", "README.md", "core/rules.md"], check=True)
    subprocess.run(["git", "-C", str(repo), "commit", "-m", "test fixture"], check=True, capture_output=True)
    return repo


def rewrite_zip(source: Path, destination: Path, *, modify_path: str | None = None, delete_path: str | None = None) -> None:
    with zipfile.ZipFile(source, "r") as original, zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as output:
        for name in original.namelist():
            if name == delete_path:
                continue
            data = original.read(name)
            if name == modify_path:
                data += b"\n# simulated tamper\n"
            output.writestr(name, data)


def self_test() -> dict[str, Any]:
    simulations: list[dict[str, Any]] = []
    with tempfile.TemporaryDirectory(prefix="memory-check-selftest-") as temp_name:
        root = Path(temp_name)
        repo = make_test_repo(root)
        work = root / "work"
        build_cmd = [
            sys.executable, str(Path(__file__).with_name("backup_memory.py")),
            "--repo", str(repo), "--no-fetch", "--test-mode", "--work-dir", str(work),
            "--date", "2026-11-17",
        ]
        built = subprocess.run(build_cmd, capture_output=True, text=True, check=False)
        archive = work / "agent-memory-main-2026-11-17.zip"
        if built.returncode != 0 or not archive.is_file():
            return {"status": "FAIL", "errors": ["测试快照生成失败：%s %s" % (built.stdout, built.stderr)]}
        valid = check_archive(repo, archive, no_fetch=True)
        simulations.append({"name": "baseline_valid_package", "detected": valid["status"] == "PASS", "result": valid["status"]})

        upload_cmd = build_cmd.copy()
        upload_cmd[upload_cmd.index("--work-dir") + 1] = str(root / "upload-failure-work")
        upload_cmd.extend(["--simulate-upload-failure"])
        upload_fail = subprocess.run(upload_cmd, capture_output=True, text=True, check=False)
        test_log = root / "upload-failure-work" / "test-backup-log.jsonl"
        logged_alert = False
        if test_log.is_file():
            try:
                log_rows = [json.loads(line) for line in test_log.read_text(encoding="utf-8").splitlines() if line.strip()]
                logged_alert = any(row.get("alert") is True and row.get("alert_code") == "upload_failed" for row in log_rows)
            except Exception:
                logged_alert = False
        upload_detected = upload_fail.returncode != 0 and '"alert": true' in upload_fail.stderr and '"alert_code": "upload_failed"' in upload_fail.stderr and logged_alert
        simulations.append({"name": "simulate_upload_failure", "detected": upload_detected, "exit_code": upload_fail.returncode, "test_log_written": test_log.is_file(), "alert_logged": logged_alert, "output": upload_fail.stderr.strip()[-500:]})

        modified = root / "modified.zip"
        rewrite_zip(archive, modified, modify_path="README.md")
        modified_result = check_archive(repo, modified, no_fetch=True)
        modified_detected = modified_result["status"] == "FAIL" and any("SHA-256 不匹配" in item for item in modified_result["errors"])
        simulations.append({"name": "modify_one_file", "detected": modified_detected, "errors": modified_result["errors"]})

        deleted = root / "deleted.zip"
        rewrite_zip(archive, deleted, delete_path="core/rules.md")
        deleted_result = check_archive(repo, deleted, no_fetch=True)
        deleted_detected = deleted_result["status"] == "FAIL" and any("缺少条目" in item for item in deleted_result["errors"])
        simulations.append({"name": "delete_manifest_file", "detected": deleted_detected, "errors": deleted_result["errors"]})

        missing_metadata = root / "missing-metadata.zip"
        rewrite_zip(archive, missing_metadata, delete_path="metadata.json")
        metadata_result = check_archive(repo, missing_metadata, no_fetch=True)
        metadata_detected = metadata_result["status"] == "FAIL" and any("缺 metadata.json" in item for item in metadata_result["errors"])
        simulations.append({"name": "delete_metadata_json", "detected": metadata_detected, "errors": metadata_result["errors"]})
    passed = all(item.get("detected") for item in simulations)
    return {"status": "PASS" if passed else "FAIL", "simulations": simulations, "simulation_count": len(simulations)}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="比较 Git 主本与下载自 Drive 的 agent-memory ZIP")
    parser.add_argument("--repo", default=os.environ.get("AGENT_MEMORY_REPO", str(Path.home() / "workspace/projects/agent-memory")))
    parser.add_argument("--archive", help="从 Drive 下载的 agent-memory-main-YYYY-MM-DD.zip 本地路径")
    parser.add_argument("--ref", default="main", help="仅 --self-test 使用的本地 ref")
    parser.add_argument("--report", help="可选 JSON 检查报告输出路径")
    parser.add_argument("--no-fetch", action="store_true", help="仅测试模式：使用本地 ref，不访问 GitHub")
    parser.add_argument("--self-test", action="store_true", help="在临时 Git 仓库/临时 ZIP 中运行四项自测，不访问 Drive")
    args = parser.parse_args(argv)
    if args.self_test:
        report = self_test()
    else:
        if args.no_fetch:
            parser.error("--no-fetch 仅允许通过 --self-test 的内部临时仓库使用")
        if not args.archive:
            parser.error("必须提供 --archive（Drive ZIP 的本地下载副本）或 --self-test")
        report = check_archive(Path(args.repo).expanduser().resolve(), Path(args.archive).expanduser().resolve())
    output = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True)
    print(output)
    if args.report:
        report_path = Path(args.report).expanduser().resolve()
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(output + "\n", encoding="utf-8")
    return 0 if report.get("status") == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
