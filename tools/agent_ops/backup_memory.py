#!/usr/bin/env python3
"""Create and verify a daily, read-only snapshot of vileosbot-bot/agent-memory main.

This is an independent Git-main snapshot track. It never edits the Git repository,
never modifies the existing Muse backup ZIP/mirror, and never changes a scheduler.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path, PurePosixPath
from typing import Any

BEIJING = timezone(timedelta(hours=8))
REPOSITORY = "vileosbot-bot/agent-memory"
EXPECTED_REMOTE = "github.com/vileosbot-bot/agent-memory"
DRIVE_FOLDER_ID = "1U1LIYZhNEO0KA4hreeGIS0RJRkvnSXeE"
DRIVE_CLI_DEFAULT = "/opt/hatch/bin/hatch_gws_cli"
HEARTBEAT_NAME = "agent-memory-heartbeat.json"
ARCHIVE_PREFIX = "agent-memory-main-"
VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v", ".flv", ".wmv"}
CREDENTIAL_NAME_PARTS = (
    ".env", "credentials", "credential", "secret", "token", ".pem", ".key",
    "password", "passwd", "apikey", "api_key", "cookies", "id_rsa",
    "id_ed25519", ".p12", ".pfx", ".netrc", ".npmrc", ".pypirc",
)
SECRET_PATTERNS = (
    re.compile(rb"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----"),
    re.compile(rb"\bgh[pousr]_[A-Za-z0-9]{25,}\b"),
    re.compile(rb"\bgithub_pat_[A-Za-z0-9_]{25,}\b"),
    re.compile(rb"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(rb"(?i)(?:api[_-]?key|access[_-]?token)\s*[:=]\s*['\"]?[A-Za-z0-9_./+=-]{24,}"),
)


class BackupError(RuntimeError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def now_beijing() -> datetime:
    return datetime.now(BEIJING)


def iso_time(value: datetime | None = None) -> str:
    return (value or now_beijing()).isoformat(timespec="seconds")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def md5_file(path: Path) -> str:
    h = hashlib.md5()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def run_command(command: list[str], timeout: int = 120, *, binary: bool = False) -> bytes | str:
    result = subprocess.run(
        command,
        capture_output=True,
        text=not binary,
        timeout=timeout,
        check=False,
    )
    if result.returncode != 0:
        stdout = result.stdout if isinstance(result.stdout, str) else result.stdout.decode("utf-8", "replace")
        stderr = result.stderr if isinstance(result.stderr, str) else result.stderr.decode("utf-8", "replace")
        raise BackupError(
            "command_failed",
            "命令失败 rc=%d: %s\nstdout=%s\nstderr=%s" % (
                result.returncode, " ".join(command), stdout[-1200:], stderr[-1200:]
            ),
        )
    return result.stdout


def git_command(repo: Path, *args: str, timeout: int = 120, binary: bool = False) -> bytes | str:
    return run_command(["git", "-C", str(repo), *args], timeout=timeout, binary=binary)


def normalize_remote(url: str) -> str:
    value = url.strip().lower()
    value = value.removesuffix(".git")
    for prefix in ("https://", "http://"):
        if value.startswith(prefix):
            value = value[len(prefix):]
    if value.startswith("git@") and ":" in value:
        value = value.split("@", 1)[1].replace(":", "/", 1)
    return value.rstrip("/")


def resolve_git_head(repo: Path, *, no_fetch: bool = False, ref: str = "main") -> str:
    repo = repo.expanduser().resolve()
    if not repo.is_dir():
        raise BackupError("repo_missing", "agent-memory 仓库目录不存在：%s" % repo)
    inside = git_command(repo, "rev-parse", "--is-inside-work-tree").strip()
    if inside != "true":
        raise BackupError("not_git_repo", "指定目录不是 Git 工作树：%s" % repo)
    if not no_fetch:
        remote = git_command(repo, "remote", "get-url", "origin").strip()
        if normalize_remote(remote) != EXPECTED_REMOTE:
            raise BackupError("wrong_remote", "origin 不是授权的 %s：%s" % (REPOSITORY, remote))
        git_command(repo, "fetch", "--no-tags", "origin", "main", timeout=180)
        head = git_command(repo, "rev-parse", "FETCH_HEAD^{commit}").strip()
    else:
        head = git_command(repo, "rev-parse", "%s^{commit}" % ref).strip()
    if not re.fullmatch(r"[0-9a-f]{40}", head):
        raise BackupError("invalid_git_head", "Git 未返回完整 commit SHA：%r" % head)
    return head


def validate_repo_path(path: str) -> None:
    if not path or "\\" in path or path.startswith("/"):
        raise BackupError("unsafe_path", "Git 路径不安全：%r" % path)
    parsed = PurePosixPath(path)
    if any(part in ("", ".", "..") for part in parsed.parts):
        raise BackupError("unsafe_path", "Git 路径含非法分量：%r" % path)
    low_parts = [part.lower() for part in parsed.parts]
    if any(any(pattern in part for pattern in CREDENTIAL_NAME_PARTS) for part in low_parts):
        raise BackupError("credential_path", "Git 文件名命中凭据排除规则：%s" % path)
    if parsed.suffix.lower() in VIDEO_EXTENSIONS:
        raise BackupError("video_path", "Git 文件是视频类型，拒绝打包：%s" % path)


def scan_secret_patterns(path: str, data: bytes) -> None:
    for pattern in SECRET_PATTERNS:
        if pattern.search(data):
            raise BackupError("secret_pattern", "文件命中高置信度密钥样式，拒绝打包：%s" % path)


def read_git_snapshot(repo: Path, head: str) -> dict[str, dict[str, Any]]:
    raw_tree = git_command(repo, "ls-tree", "-r", "-z", "--full-tree", head, binary=True)
    assert isinstance(raw_tree, bytes)
    snapshot: dict[str, dict[str, Any]] = {}
    for record in raw_tree.split(b"\0"):
        if not record:
            continue
        try:
            header, raw_path = record.split(b"\t", 1)
            mode, kind, blob_sha = header.decode("ascii").split(" ", 2)
            path = raw_path.decode("utf-8")
        except Exception as exc:
            raise BackupError("tree_parse_failed", "无法解析 Git tree 条目：%s" % exc) from exc
        if kind != "blob" or mode not in ("100644", "100755"):
            raise BackupError("unsupported_git_entry", "不接受符号链接/子模块/非普通文件：%s (%s %s)" % (path, mode, kind))
        validate_repo_path(path)
        if path in snapshot:
            raise BackupError("duplicate_git_path", "Git tree 出现重复路径：%s" % path)
        data = git_command(repo, "cat-file", "blob", blob_sha, binary=True)
        assert isinstance(data, bytes)
        if len(data) > 25 * 1024 * 1024:
            raise BackupError("oversized_file", "单文件超过 25 MB：%s (%d bytes)" % (path, len(data)))
        scan_secret_patterns(path, data)
        snapshot[path] = {
            "data": data,
            "size_bytes": len(data),
            "sha256": sha256_bytes(data),
            "git_blob_sha": blob_sha,
        }
    if not snapshot:
        raise BackupError("empty_snapshot", "Git 主本没有可导出的普通文件")
    return dict(sorted(snapshot.items()))


def build_archive(
    snapshot: dict[str, dict[str, Any]],
    head: str,
    backup_time: str,
    archive_path: Path,
) -> dict[str, Any]:
    archive_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="agent-memory-snapshot-") as temp_name:
        stage = Path(temp_name)
        metadata_files = []
        for rel, entry in snapshot.items():
            target = stage.joinpath(*PurePosixPath(rel).parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(entry["data"])
            metadata_files.append({
                "path": rel,
                "size_bytes": entry["size_bytes"],
                "sha256": entry["sha256"],
            })
        metadata = {
            "schema_version": 1,
            "repository": REPOSITORY,
            "git_ref": "refs/heads/main",
            "git_head": head,
            "backup_time": backup_time,
            "file_count": len(snapshot),
            "files": metadata_files,
        }
        metadata_bytes = (json.dumps(metadata, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        (stage / "metadata.json").write_bytes(metadata_bytes)
        manifest_lines = ["%s  %s" % (entry["sha256"], rel) for rel, entry in snapshot.items()]
        manifest_lines.append("%s  metadata.json" % sha256_bytes(metadata_bytes))
        manifest_bytes = ("\n".join(manifest_lines) + "\n").encode("utf-8")
        (stage / "manifest.sha256").write_bytes(manifest_bytes)
        if archive_path.exists():
            archive_path.unlink()
        with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for rel in snapshot:
                archive.write(stage.joinpath(*PurePosixPath(rel).parts), arcname=rel)
            archive.write(stage / "metadata.json", arcname="metadata.json")
            archive.write(stage / "manifest.sha256", arcname="manifest.sha256")
        with zipfile.ZipFile(archive_path, "r") as archive:
            bad_entry = archive.testzip()
            expected = set(snapshot) | {"metadata.json", "manifest.sha256"}
            actual_list = archive.namelist()
            if bad_entry is not None:
                raise BackupError("zip_corrupt", "ZIP CRC 检查失败：%s" % bad_entry)
            if len(actual_list) != len(set(actual_list)) or set(actual_list) != expected:
                raise BackupError("zip_contents_mismatch", "ZIP 条目与 Git 主本清单不一致")
    return {
        "archive_path": str(archive_path),
        "archive_name": archive_path.name,
        "archive_size_bytes": archive_path.stat().st_size,
        "archive_sha256": sha256_file(archive_path),
        "archive_md5": md5_file(archive_path),
        "metadata": metadata,
    }


def drive_json(cli: str, *args: str, timeout: int = 600) -> dict[str, Any]:
    raw = run_command([cli, "drive", *args], timeout=timeout)
    assert isinstance(raw, str)
    try:
        return json.loads(raw.strip()) if raw.strip() else {}
    except json.JSONDecodeError as exc:
        raise BackupError("drive_bad_json", "Drive CLI 返回非 JSON：%s" % raw[-1000:]) from exc


def check_drive_status(cli: str) -> None:
    raw = run_command([cli, "drive", "status"], timeout=60)
    assert isinstance(raw, str)
    try:
        data = json.loads(raw.strip())
        if data.get("status") != "connected" or data.get("connect_url"):
            raise BackupError("drive_not_connected", "Google Drive 未连接：%s" % raw[:500])
    except json.JSONDecodeError:
        if "not_connected" in raw:
            raise BackupError("drive_not_connected", "Google Drive 未连接：%s" % raw[:500])


def find_drive_files(cli: str, folder_id: str, name: str) -> list[dict[str, Any]]:
    query = "name = '%s' and '%s' in parents and trashed=false" % (name.replace("'", "\\'"), folder_id)
    result = drive_json(
        cli, "files", "list", "--params",
        json.dumps({"q": query, "pageSize": 10, "fields": "files(id,name,size,md5Checksum,modifiedTime,parents)"}),
    )
    return result.get("files", [])


def verify_drive_file(cli: str, folder_id: str, file_id: str, name: str, local_path: Path) -> dict[str, Any]:
    result = drive_json(
        cli, "files", "get", "--params",
        json.dumps({"fileId": file_id, "fields": "id,name,size,md5Checksum,modifiedTime,parents"}),
    )
    expected_size = local_path.stat().st_size
    expected_md5 = md5_file(local_path)
    if result.get("id") != file_id or result.get("name") != name:
        raise BackupError("drive_readback_identity", "Drive 读回文件 ID/名称不匹配：%s" % json.dumps(result)[:500])
    if "size" not in result or int(result["size"]) != expected_size:
        raise BackupError("drive_readback_size", "Drive 读回字节数不匹配：%s" % json.dumps(result)[:500])
    if not result.get("md5Checksum") or result.get("md5Checksum") != expected_md5:
        raise BackupError("drive_readback_md5", "Drive 读回 MD5 缺失或不匹配：%s" % json.dumps(result)[:500])
    if folder_id not in result.get("parents", []):
        raise BackupError("drive_readback_parent", "Drive 读回父目录不匹配：%s" % json.dumps(result)[:500])
    return result


def upload_new_archive(cli: str, folder_id: str, local_path: Path, name: str) -> tuple[str, str]:
    found = find_drive_files(cli, folder_id, name)
    if found:
        item = found[0]
        if len(found) > 1:
            raise BackupError("drive_duplicate_name", "Drive 中同名新快照超过 1 个，停止自动选择")
        if int(item.get("size", -1)) == local_path.stat().st_size and item.get("md5Checksum") == md5_file(local_path):
            return item["id"], "existing-identical"
        raise BackupError("drive_name_collision", "同名 Git 快照已存在但内容不同；为保护历史快照，拒绝覆盖：%s" % name)
    result = drive_json(cli, "+upload", str(local_path), "--parent", folder_id, "--name", name)
    file_id = result.get("id")
    if not file_id:
        raise BackupError("drive_upload_no_id", "Drive 上传未返回文件 ID：%s" % json.dumps(result)[:500])
    return file_id, "uploaded"


def upsert_heartbeat(cli: str, folder_id: str, local_path: Path) -> tuple[str, str]:
    found = find_drive_files(cli, folder_id, HEARTBEAT_NAME)
    if len(found) > 1:
        raise BackupError("drive_heartbeat_duplicate", "Drive 中心跳文件出现多个同名项，停止更新")
    if found:
        file_id = found[0]["id"]
        drive_json(cli, "files", "update", "--params", json.dumps({"fileId": file_id}), "--upload", str(local_path))
        return file_id, "updated"
    result = drive_json(cli, "+upload", str(local_path), "--parent", folder_id, "--name", HEARTBEAT_NAME)
    file_id = result.get("id")
    if not file_id:
        raise BackupError("drive_heartbeat_no_id", "心跳上传未返回文件 ID：%s" % json.dumps(result)[:500])
    return file_id, "uploaded"


def append_log(path: Path, event: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(event, ensure_ascii=False, sort_keys=True) + "\n")


def perform_backup(args: argparse.Namespace) -> dict[str, Any]:
    repo = Path(args.repo).expanduser().resolve()
    no_fetch = bool(args.no_fetch)
    if no_fetch and not args.test_mode:
        raise BackupError("unsafe_no_fetch", "--no-fetch 仅允许在 --test-mode 下使用")
    if args.simulate_upload_failure and not args.test_mode:
        raise BackupError("unsafe_simulation", "故障模拟必须同时使用 --test-mode")
    timestamp = now_beijing()
    date_value = args.date or timestamp.strftime("%Y-%m-%d")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date_value):
        raise BackupError("bad_date", "日期必须为 YYYY-MM-DD")
    datetime.strptime(date_value, "%Y-%m-%d")
    backup_time = iso_time(timestamp)
    head = resolve_git_head(repo, no_fetch=no_fetch, ref=args.ref)
    snapshot = read_git_snapshot(repo, head)
    if args.test_mode:
        if not args.work_dir:
            raise BackupError("test_workdir_required", "--test-mode 必须指定隔离的 --work-dir")
        work_dir = Path(args.work_dir).expanduser().resolve()
    else:
        work_dir = Path(args.work_dir).expanduser().resolve() if args.work_dir else Path(args.hidden_dir).expanduser().resolve() / "agent-memory-archives"
    work_dir.mkdir(parents=True, exist_ok=True)
    archive_name = "%s%s.zip" % (ARCHIVE_PREFIX, date_value)
    archive_path = work_dir / archive_name
    archive_info = build_archive(snapshot, head, backup_time, archive_path)
    if args.simulate_upload_failure:
        raise BackupError("upload_failed", "TEST_MODE 注入：模拟 Drive 上传失败；未访问 Drive、未写真实日志或心跳")
    result: dict[str, Any] = {
        "status": "OK",
        "test_mode": bool(args.test_mode),
        "repository": REPOSITORY,
        "git_ref": "refs/heads/main",
        "git_head": head,
        "backup_time": backup_time,
        "file_count": len(snapshot),
        "files_total_bytes": sum(entry["size_bytes"] for entry in snapshot.values()),
        **archive_info,
    }
    if args.test_mode:
        return result

    cli = args.cli
    folder_id = args.drive_folder_id
    check_drive_status(cli)
    archive_id, archive_action = upload_new_archive(cli, folder_id, archive_path, archive_name)
    archive_remote = verify_drive_file(cli, folder_id, archive_id, archive_name, archive_path)

    heartbeat = {
        "schema_version": 1,
        "last_successful_backup_at": backup_time,
        "git_head": head,
        "archive_name": archive_name,
        "archive_drive_file_id": archive_id,
        "archive_sha256": archive_info["archive_sha256"],
        "file_count": len(snapshot),
    }
    heartbeat_path = work_dir / HEARTBEAT_NAME
    heartbeat_path.write_text(json.dumps(heartbeat, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    heartbeat_id, heartbeat_action = upsert_heartbeat(cli, folder_id, heartbeat_path)
    heartbeat_remote = verify_drive_file(cli, folder_id, heartbeat_id, HEARTBEAT_NAME, heartbeat_path)

    local_heartbeat = Path(args.hidden_dir).expanduser().resolve() / HEARTBEAT_NAME
    local_heartbeat.parent.mkdir(parents=True, exist_ok=True)
    local_heartbeat.write_text(json.dumps(heartbeat, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    result.update({
        "archive_drive_file_id": archive_id,
        "archive_drive_action": archive_action,
        "archive_drive_size_bytes": int(archive_remote["size"]),
        "archive_drive_md5": archive_remote["md5Checksum"],
        "heartbeat_drive_file_id": heartbeat_id,
        "heartbeat_drive_action": heartbeat_action,
        "heartbeat_drive_size_bytes": int(heartbeat_remote["size"]),
        "heartbeat_drive_md5": heartbeat_remote["md5Checksum"],
    })
    log_event = {
        "timestamp": backup_time,
        "status": "OK",
        "alert": False,
        "alert_code": None,
        "git_head": head,
        "archive_name": archive_name,
        "archive_drive_file_id": archive_id,
        "file_count": len(snapshot),
        "files_total_bytes": result["files_total_bytes"],
        "archive_size_bytes": archive_info["archive_size_bytes"],
        "archive_sha256": archive_info["archive_sha256"],
        "heartbeat_drive_file_id": heartbeat_id,
    }
    append_log(Path(args.log_file).expanduser().resolve(), log_event)
    return result


def make_parser() -> argparse.ArgumentParser:
    home = Path.home()
    parser = argparse.ArgumentParser(description="每日导出 agent-memory/main 的独立 Git 快照")
    parser.add_argument("--repo", default=os.environ.get("AGENT_MEMORY_REPO", str(home / "workspace/projects/agent-memory")))
    parser.add_argument("--ref", default="main", help="仅测试模式 --no-fetch 时使用的本地 Git ref")
    parser.add_argument("--date", help="备份日期 YYYY-MM-DD，默认北京时间当天")
    parser.add_argument("--hidden-dir", default=str(home / "workspace/goals/goal-2/hidden_files"))
    parser.add_argument("--work-dir", help="本地 ZIP 工作目录；测试模式必填")
    parser.add_argument("--cli", default=os.environ.get("HATCH_GWS_CLI", DRIVE_CLI_DEFAULT))
    parser.add_argument("--drive-folder-id", default=DRIVE_FOLDER_ID)
    parser.add_argument("--log-file", default=str(home / "workspace/goals/goal-2/hidden_files/agent-memory-backup-log.jsonl"))
    parser.add_argument("--test-mode", action="store_true", help="只在隔离目录导出，不访问 Drive、不写真实日志或心跳")
    parser.add_argument("--no-fetch", action="store_true", help="仅测试模式：使用本地 ref，不访问 GitHub")
    parser.add_argument("--simulate-upload-failure", action="store_true", help="仅测试模式：在打包后注入上传失败")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = make_parser()
    args = parser.parse_args(argv)
    try:
        result = perform_backup(args)
        print("RESULT " + json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 0
    except BackupError as exc:
        event = {
            "timestamp": iso_time(),
            "status": "FAIL",
            "alert": True,
            "alert_code": exc.code,
            "error": str(exc),
        }
        log_target = (Path(args.work_dir).expanduser().resolve() / "test-backup-log.jsonl") if args.test_mode and args.work_dir else Path(args.log_file).expanduser().resolve()
        try:
            append_log(log_target, event)
        except Exception as log_exc:
            print("无法写失败日志：%s" % log_exc, file=sys.stderr)
        print("RESULT FAIL " + json.dumps(event, ensure_ascii=False, sort_keys=True), file=sys.stderr)
        return 1
    except Exception as exc:  # defensive boundary: unexpected failures must also alert
        event = {
            "timestamp": iso_time(),
            "status": "FAIL",
            "alert": True,
            "alert_code": "unexpected_error",
            "error": "%s: %s" % (type(exc).__name__, exc),
        }
        log_target = (Path(args.work_dir).expanduser().resolve() / "test-backup-log.jsonl") if args.test_mode and args.work_dir else Path(args.log_file).expanduser().resolve()
        try:
            append_log(log_target, event)
        except Exception as log_exc:
            print("无法写失败日志：%s" % log_exc, file=sys.stderr)
        print("RESULT FAIL " + json.dumps(event, ensure_ascii=False, sort_keys=True), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
