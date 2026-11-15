#!/usr/bin/env python3
"""Dependency-free machine gate helpers for lapis-rebuild."""

from __future__ import annotations

import argparse
import ast
import json
import io
import os
import re
import struct
import subprocess
import sys
import tempfile
from contextlib import redirect_stdout
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]


class ReadbackMismatch(ValueError):
    """A successful GitHub API read returned facts that contradict the PR event."""
SECRET_PATTERNS = (
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{40,}\b"),
    re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b"),
    re.compile(r"-----BEGIN (?:(?:RSA|DSA|EC|OPENSSH|PGP) |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----"),
    re.compile(r"""(?i)\b(?:password|passwd|secret|api[_-]?key|client[_-]?secret|access[_-]?token)\b\s*[:=]\s*(?:"[^"\s]{12,}"|'[^'\s]{12,}'|[A-Za-z0-9_./+=-]{12,})"""),
)

FALLBACKS = {
    "unit_tests": ("web/package.json", 1),
    "build": ("web/vite.config.ts", 1),
    "typecheck": ("web/tsconfig.json", 1),
    "format": ("tools/gate/check_gate.py", 1),
    "static": (".github/workflows/web-ci.yml", 1),
    "secrets": ("tools/gate/check_gate.py", 1),
    "screenshot": ("web/index.html", 1),
    "github_readback": (".github/workflows/web-ci.yml", 1),
}


def annotation(path: str, line: int, message: str, level: str = "error") -> None:
    safe = message.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
    safe = safe.replace(":", "%3A").replace(",", "%2C")
    print(f"::{level} file={path},line={max(1, int(line))}::{safe}")


def write_json(path: str | Path, value: dict) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_json(path: str | Path, default: dict | None = None) -> dict:
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default or {}


def git_at(root: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args], cwd=Path(root), text=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False
    )
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or f"git {' '.join(args)} failed")
    return result.stdout


def git(*args: str) -> str:
    return git_at(ROOT, *args)


def diff_refs() -> tuple[str, str]:
    return os.environ.get("GATE_BASE_SHA", "main"), os.environ.get("GATE_HEAD_SHA", "HEAD")


def changed_paths(base: str, head: str) -> list[str]:
    output = git("diff", "--name-only", "--diff-filter=ACDMRT", f"{base}...{head}")
    return sorted({line.strip() for line in output.splitlines() if line.strip()})


def newline_issues(content: str) -> list[tuple[int, str]]:
    issues = []
    lines = content.splitlines()
    if content and not content.endswith("\n"):
        issues.append((max(1, len(lines)), "文件缺少末尾换行"))
    normalized = content.replace("\r\n", "")
    if "\r" in normalized:
        issues.append((1, "文件包含非 CRLF 配对的回车符"))
    if "\r\n" in content and "\n" in normalized:
        issues.append((1, "文件混用了 CRLF 与 LF 换行"))
    return issues


def format_issues(content: str) -> list[tuple[int, str]]:
    issues = newline_issues(content)
    for number, line in enumerate(content.splitlines(), 1):
        if line.endswith((" ", "\t")):
            issues.append((number, "行尾存在空格或制表符"))
    return issues


def detect_secret(text: str) -> bool:
    return any(pattern.search(text) for pattern in SECRET_PATTERNS)


def normalize_status(value: str | None) -> str:
    value = (value or "").strip().lower()
    if value in {"success", "passed", "pass", "true"}:
        return "PASS"
    if value in {"failure", "failed", "fail", "cancelled", "timed_out", "timeout", "false"}:
        return "FAIL"
    return "UNKNOWN"


def combine_statuses(*values: str | None) -> str:
    states = [normalize_status(value) for value in values]
    if "FAIL" in states:
        return "FAIL"
    if "UNKNOWN" in states:
        return "UNKNOWN"
    return "PASS"


def overall_status(statuses: list[str]) -> str:
    if "FAIL" in statuses:
        return "FAIL"
    if "UNKNOWN" in statuses or "NOT_RUN" in statuses:
        return "UNKNOWN"
    return "PASS"


def touches_gate_self(files: list[dict]) -> bool:
    return any(
        str(item.get("filename", "")).startswith((".github/workflows/", "tools/gate/"))
        for item in files
    )


def classify_review(files: list[dict], changed_lines: int, diff_text: str = "") -> str:
    if touches_gate_self(files):
        return "red"
    red_path = re.compile(
        r"(^|/)(payments?|billing|wallet|money|finance|economy|currency|gold|balance|price|transaction|delete|deletion|remove|removal|purge|deploy|deployment|release|publish|freeze|permissions?|access-control|auth)(/|[-_.]|$)",
        re.IGNORECASE,
    )
    red_change = re.compile(
        r"(?i)(?:\b(?:money|gold|balance|price|cost|wallet|billing|finance|financial|currency|economy|asset|transaction|payment|fee|delete|deletion|remove|removal|purge|truncate|deploy(?:ment)?|release|publish|rollout|freeze|frozen|permission|permissions|access[_-]?control|auth(?:entication|orization)?|token)\b|drop\s+(?:table|database|schema)|钱|余额|金币|价格|成本|资产|财务|计费|支付|交易|删除|移除|上线|部署|发布|冻结|权限)",
    )
    for item in files:
        if red_path.search(str(item.get("filename", ""))) or item.get("status") in {"removed", "renamed"}:
            return "red"
    for line in diff_text.splitlines():
        if line.startswith(("+", "-")) and not line.startswith(("+++", "---")):
            if red_change.search(line[1:]):
                return "red"
    if changed_lines <= 50 and files:
        safe = {".md", ".txt", ".css", ".scss", ".less"}
        if all(Path(str(item.get("filename", ""))).suffix.lower() in safe for item in files):
            return "green"
    return "yellow"


def review_decision(level: str, gate_status: str, blind_review: str = "missing",
                    opus_review: str = "missing", manager_review: str = "missing") -> dict:
    if gate_status != "PASS":
        return {"reviewed": False, "merge_allowed": False, "reason": "门禁未通过或未知"}
    if level not in {"green", "yellow", "red"}:
        return {"reviewed": False, "merge_allowed": False, "reason": "审查等级未知，按高一级阻断"}
    if level == "red":
        passed = opus_review == "passed" and manager_review == "approved"
        return {"reviewed": passed, "merge_allowed": passed, "reason": "红灯需要 Opus 盲审和总管最终批准"}
    if level == "yellow":
        passed = blind_review == "passed" and manager_review == "approved"
        return {"reviewed": passed, "merge_allowed": passed, "reason": "黄灯需要子代理盲审和总管逐项验收"}
    passed = blind_review == "passed"
    manager_ok = manager_review in {"not_selected", "sampled_approved", "approved"}
    return {"reviewed": passed, "merge_allowed": passed and manager_ok, "reason": "绿灯必须先完成子代理盲审"}




def ledger_matches(merged: set[int], ledger_rows: list[int]) -> bool:
    ledger_numbers = set(ledger_rows)
    return merged == ledger_numbers and len(ledger_rows) == len(ledger_numbers)


def annotate_log(log_text: str, fallback_file: str, fallback_line: int) -> None:
    patterns = (
        re.compile(r'File "([^"]+)", line (\d+)'),
        re.compile(r"([A-Za-z0-9_./-]+\.(?:py|ts|tsx|js|mjs|json|yml|yaml|css|html|md)):(\d+)(?::\d+)?"),
        re.compile(r"([A-Za-z0-9_./-]+\.(?:py|ts|tsx|js|mjs|json|yml|yaml|css|html|md))\((\d+),\d+\)"),
    )
    found = set()
    for pattern in patterns:
        for match in pattern.finditer(log_text):
            path = match.group(1).replace(str(ROOT) + "/", "")
            found.add((path, int(match.group(2))))
    if found:
        for path, line in sorted(found)[:20]:
            annotation(path, line, "门禁命令失败；请查看对应步骤日志")
    else:
        annotation(fallback_file, fallback_line, "门禁命令失败但工具未提供源码行号；回退定位，请查看日志")


def command_run(args: argparse.Namespace) -> int:
    command = list(args.command)
    if command and command[0] == "--":
        command = command[1:]
    if not command:
        print("missing command after --", file=sys.stderr)
        return 2
    log_path = Path(args.log)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("w", encoding="utf-8") as log:
        process = subprocess.Popen(
            command, cwd=ROOT / args.cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, errors="replace"
        )
        assert process.stdout is not None
        for line in process.stdout:
            sys.stdout.write(line)
            sys.stdout.flush()
            log.write(line)
        code = process.wait()
    if code:
        annotate_log(log_path.read_text(encoding="utf-8", errors="replace"), args.fallback_file, args.fallback_line)
    return code


def format_check(root: Path = ROOT, base: str | None = None, head: str | None = None) -> int:
    if base is None or head is None:
        base, head = diff_refs()
    root = Path(root)
    failed = False
    try:
        check = subprocess.run(
            ["git", "diff", "--check", f"{base}...{head}"],
            cwd=root, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False
        )
        if check.returncode not in {0, 2}:
            raise RuntimeError(check.stderr.strip() or f"git diff --check exited {check.returncode}")
        if check.stdout.strip():
            for line in check.stdout.splitlines():
                match = re.match(r"(.+?):(\d+):\s*(.*)", line)
                if match:
                    annotation(match.group(1), int(match.group(2)), match.group(3))
                else:
                    annotation(".github/workflows/web-ci.yml", 1, line)
                failed = True
        elif check.returncode == 2:
            annotation(".github/workflows/web-ci.yml", 1, check.stderr.strip() or "git diff --check returned 2 without detail")
            failed = True
        status_rows = git_at(root, "diff", "--name-status", f"{base}...{head}").splitlines()
    except RuntimeError as exc:
        annotation(".github/workflows/web-ci.yml", 1, f"格式检查无法读取 diff：{exc}")
        return 1
    for row in status_rows:
        parts = row.split("\t")
        if len(parts) < 2:
            continue
        status, name = parts[0], parts[-1]
        path = root / name
        if not path.is_file():
            continue
        try:
            content = path.read_bytes().decode("utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        issues = format_issues(content) if status == "A" else newline_issues(content)
        for number, message in issues:
            annotation(name, number, message)
            failed = True
    print(f"format_check: {'FAIL' if failed else 'PASS'}")
    return int(failed)


def static_check() -> int:
    base, head = diff_refs()
    try:
        paths = changed_paths(base, head)
    except RuntimeError as exc:
        annotation(".github/workflows/web-ci.yml", 1, f"无法计算静态检查范围：{exc}")
        return 1
    failed = False
    for name in paths:
        if name.endswith(".py") and (ROOT / name).is_file():
            try:
                ast.parse((ROOT / name).read_text(encoding="utf-8"), filename=name)
            except SyntaxError as exc:
                annotation(name, exc.lineno or 1, f"Python AST 解析失败：{exc.msg}")
                failed = True
    workflow_path = ROOT / ".github/workflows/web-ci.yml"
    if workflow_path.exists():
        workflow = workflow_path.read_text(encoding="utf-8")
        required = (
            "pull_request:", "branches: [main]",
            "id: parser-unit", "id: deps", "id: typecheck", "id: web-unit", "id: build",
            "id: playwright-install", "id: standalone-preview", "id: chromium-e2e",
            "id: s41-e2e", "id: m73-fixture", "id: m73-build", "id: m73-e2e",
            "id: gate-format", "id: gate-static", "id: gate-secrets", "id: gate-screenshot",
            "id: gate-readback", "id: gate-self-test", "id: synthetic-artifact", "id: gate-summary",
            "id: gate-summary-artifact", "gate-comment:", "needs: synthetic",
            "if: always() && github.event_name == 'pull_request'",
            "id: gate-comment-download", "id: gate-comment-prepare", "id: gate-comment-write", "id: gate-finalize",
        )
        lines = workflow.splitlines()
        for token in required:
            if token not in workflow:
                annotation(".github/workflows/web-ci.yml", 1, f"工作流缺少必需结构：{token}")
                failed = True
        for number, line in enumerate(lines, 1):
            match = re.match(r"^\s*uses:\s*([^\s#]+)", line)
            if match:
                action = match.group(1)
                if "@" not in action or not re.fullmatch(r"[0-9a-fA-F]{40}", action.rsplit("@", 1)[-1]):
                    annotation(".github/workflows/web-ci.yml", number, f"Action 未固定到完整 40 位 SHA：{action}")
                    failed = True
        step_ids = [token.split(": ", 1)[1] for token in required if token.startswith("id: ")]
        for step_id in step_ids:
            indexes = [i for i, line in enumerate(lines) if line.strip() == f"id: {step_id}"]
            if indexes:
                index = indexes[0]
                start = index
                while start > 0 and not re.match(r"^\s{6}- ", lines[start]):
                    start -= 1
                end = index + 1
                while end < len(lines) and not re.match(r"^\s{6}- ", lines[end]):
                    end += 1
                if not any("timeout-minutes:" in line for line in lines[start:end]):
                    annotation(".github/workflows/web-ci.yml", index + 1, f"{step_id} 缺少单项超时")
                    failed = True
        synthetic = workflow.split("  synthetic:\n", 1)[1].split("\n  gate-comment:", 1)[0] if "  synthetic:\n" in workflow and "\n  gate-comment:" in workflow else ""
        comment = workflow.split("  gate-comment:\n", 1)[1].split("\n  private-original:", 1)[0] if "  gate-comment:\n" in workflow and "\n  private-original:" in workflow else ""
        top_permissions = workflow.split("permissions:\n", 1)[1].split("\nconcurrency:", 1)[0] if "permissions:\n" in workflow else ""
        if "permissions:\n      contents: read" not in synthetic or "actions: read" in synthetic or "pull-requests: write" in synthetic or "issues: write" in synthetic:
            annotation(".github/workflows/web-ci.yml", 1, "synthetic job 必须仅有 contents: read")
            failed = True
        if "permissions:\n      issues: write" not in comment or "pull-requests: write" in comment or "actions: read" in comment:
            annotation(".github/workflows/web-ci.yml", 1, "gate-comment job 必须仅有 issues: write")
            failed = True
        if "actions: read" in top_permissions:
            annotation(".github/workflows/web-ci.yml", 1, "顶层 permissions 不应授予未使用的 actions: read")
            failed = True
    if (ROOT / ".github/workflows/ci.yml").exists():
        annotation(".github/workflows/ci.yml", 1, "检测到禁止另建的 ci.yml")
        failed = True
    print(f"static_check: {'FAIL' if failed else 'PASS'}")
    return int(failed)


def secret_scan(root: Path = ROOT, base: str | None = None, head: str | None = None) -> int:
    if base is None or head is None:
        base, head = diff_refs()
    root = Path(root)
    try:
        patch = git_at(root, "log", "-p", "--format=", "--no-ext-diff", "--unified=0", f"{base}..{head}")
    except RuntimeError as exc:
        annotation(".github/workflows/web-ci.yml", 1, f"无法读取提交历史 diff：{exc}")
        return 1
    filename = ".github/workflows/web-ci.yml"
    new_line = 1
    failed = False
    for line in patch.splitlines():
        if line.startswith("+++ b/"):
            filename = line[6:]
        elif line.startswith("@@"):
            match = re.search(r"\+(\d+)(?:,\d+)?", line)
            if match:
                new_line = int(match.group(1))
        elif line.startswith("+") and not line.startswith("+++"):
            if detect_secret(line[1:]):
                annotation(filename, new_line, "提交历史新增行疑似包含密钥/凭据，禁止提交")
                failed = True
            new_line += 1
    print(f"secret_scan: {'FAIL' if failed else 'PASS'}")
    return int(failed)


def screenshot_check(path_text: str) -> int:
    try:
        data = (ROOT / path_text).read_bytes()
    except OSError:
        annotation(path_text, 1, "截图文件不存在或不可读")
        return 1
    if len(data) < 512 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        annotation(path_text, 1, "截图不是有效 PNG 或文件过小")
        return 1
    width, height = struct.unpack(">II", data[16:24])
    if width < 640 or height < 360:
        annotation(path_text, 1, f"截图尺寸异常：{width}x{height}")
        return 1
    print(f"screenshot_check: PASS; bytes={len(data)}; dimensions={width}x{height}")
    return 0


def api_json(url: str, token: str, body: dict | None = None, method: str = "GET") -> object:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = Request(url, data=data, method=method, headers={
        "Accept": "application/vnd.github+json", "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json",
        "User-Agent": "lapis-agent-ops-gate",
    })
    with urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def paged_api(url: str, token: str) -> list[dict]:
    output = []
    page = 1
    while True:
        sep = "&" if "?" in url else "?"
        batch = api_json(f"{url}{sep}per_page=100&page={page}", token)
        if not isinstance(batch, list):
            raise RuntimeError("GitHub API did not return a list")
        output.extend(x for x in batch if isinstance(x, dict))
        if len(batch) < 100:
            return output
        page += 1


def parse_ledger_text(content: str) -> list[dict]:
    rows = []
    pattern = re.compile(r"^\|\s*#(\d+)\s*\|\s*([^|]+?)\s*\|\s*([0-9a-f]{40})\s*\|")
    fence_char = ""
    fence_len = 0
    in_comment = False
    for line in content.splitlines():
        if fence_char:
            if re.match(rf"^\s*{re.escape(fence_char)}{{{fence_len},}}\s*$", line):
                fence_char = ""
                fence_len = 0
            continue
        fence = re.match(r"^\s*(\x60{3,}|~{3,})", line)
        if fence and not in_comment:
            fence_char = fence.group(1)[0]
            fence_len = len(fence.group(1))
            continue
        while True:
            if in_comment:
                end = line.find("-->")
                if end < 0:
                    line = ""
                    break
                line = line[end + 3:]
                in_comment = False
            start = line.find("<!--")
            if start < 0:
                break
            end = line.find("-->", start + 4)
            if end < 0:
                line = line[:start]
                in_comment = True
                break
            line = line[:start] + line[end + 3:]
        if in_comment:
            continue
        match = pattern.match(line)
        if match:
            rows.append({
                "number": int(match.group(1)),
                "merged_at": match.group(2).strip(),
                "merge_sha": match.group(3).lower(),
            })
    return rows


def parse_ledger(path: Path) -> list[dict]:
    return parse_ledger_text(path.read_bytes().decode("utf-8"))


def normalize_timestamp(value: str) -> str:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


def timestamps_equal(left: str, right: str) -> bool:
    try:
        return normalize_timestamp(left) == normalize_timestamp(right)
    except (TypeError, ValueError):
        return False


def ledger_matches(merged: dict[int, tuple[str, str]], ledger_rows: list[dict]) -> bool:
    ledger_by_number = {}
    for row in ledger_rows:
        number = int(row["number"])
        if number in ledger_by_number:
            return False
        try:
            merged_at = normalize_timestamp(str(row["merged_at"]))
        except (TypeError, ValueError):
            return False
        ledger_by_number[number] = (merged_at, str(row["merge_sha"]).lower())
    merged_by_number = {}
    for number, facts in merged.items():
        try:
            merged_by_number[int(number)] = (normalize_timestamp(str(facts[0])), str(facts[1]).lower())
        except (TypeError, ValueError, IndexError):
            return False
    return ledger_by_number == merged_by_number


def readback(args: argparse.Namespace) -> int:
    token = os.environ.get("GITHUB_TOKEN", "")
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    number = os.environ.get("PR_NUMBER", "")
    head = os.environ.get("EXPECTED_HEAD_SHA", "")
    base = os.environ.get("EXPECTED_BASE_SHA", "")
    base_ref = os.environ.get("EXPECTED_BASE_REF", "main")
    if not all((token, repo, number, head, base)):
        write_json(args.output, {"status": "UNKNOWN", "reason": "PR/API 环境变量缺失"})
        print("github_readback: UNKNOWN")
        return 0
    try:
        root = f"https://api.github.com/repos/{repo}"
        pr = api_json(f"{root}/pulls/{number}", token)
        if pr.get("state") != "open" or pr.get("merged"):
            raise ReadbackMismatch("PR 不是 open 状态或已经合并")
        if pr.get("head", {}).get("sha") != head:
            raise ReadbackMismatch("GitHub PR head SHA 与事件 head SHA 不一致")
        if pr.get("base", {}).get("sha") != base or pr.get("base", {}).get("ref") != base_ref:
            raise ReadbackMismatch("GitHub PR base SHA/ref 与事件不一致")
        if pr.get("head", {}).get("repo", {}).get("full_name") != repo:
            raise ReadbackMismatch("PR head repo 不是 bot 目标仓库")
        files = paged_api(f"{root}/pulls/{number}/files", token)
        api_names = {str(x.get("filename")) for x in files}
        local_names = set(changed_paths(base, head))
        if api_names != local_names:
            raise ReadbackMismatch(f"PR changed files 与本地 diff 不一致：API={sorted(api_names)} local={sorted(local_names)}")
        merged_prs = paged_api(f"{root}/pulls?state=closed&base=main", token)
        merged = {
            int(x["number"]): (str(x.get("merged_at", "")), str(x.get("merge_commit_sha", "")))
            for x in merged_prs if x.get("merged_at")
        }
        ledger_rows = parse_ledger(ROOT / "docs/agent-ops/review-ledger.md")
        ledger_by_number = {int(x["number"]): x for x in ledger_rows}
        if not ledger_matches(merged, ledger_rows):
            merged_numbers = set(merged)
            ledger_numbers = set(ledger_by_number)
            mismatched = sorted(
                n for n in merged_numbers & ledger_numbers
                if not timestamps_equal(merged[n][0], ledger_by_number[n]["merged_at"])
                or merged[n][1].lower() != ledger_by_number[n]["merge_sha"].lower()
            )
            duplicate_rows = len(ledger_rows) - len(ledger_by_number)
            raise ReadbackMismatch(
                f"审查台账不一致（base=main）：merged={len(merged)} ledger_rows={len(ledger_rows)} "
                f"duplicate_rows={duplicate_rows} missing={sorted(merged_numbers-ledger_numbers)} "
                f"extra={sorted(ledger_numbers-merged_numbers)} sha_or_merged_at_mismatch={mismatched}"
            )
        changed_lines = sum(int(x.get("additions", 0)) + int(x.get("deletions", 0)) for x in files)
        diff_text = git("diff", "--unified=0", f"{base}...{head}")
        level = classify_review(files, changed_lines, diff_text)
        payload = {
            "status": "PASS", "repository": repo, "pr_number": int(number),
            "head_sha": pr.get("head", {}).get("sha"), "base_ref": pr.get("base", {}).get("ref"),
            "base_sha": pr.get("base", {}).get("sha"),
            "changed_files": sorted([{
                "filename": x.get("filename"), "status": x.get("status"),
                "additions": int(x.get("additions", 0)), "deletions": int(x.get("deletions", 0))
            } for x in files], key=lambda x: str(x["filename"])),
            "changed_lines": changed_lines, "review_level": level,
            "merged_pr_count": len(merged), "review_ledger_count": len(ledger_rows),
            "review_ledger_matches": True,
            "gate_self_modified": touches_gate_self(files),
        }
        write_json(args.output, payload)
        print(f"github_readback: PASS; PR=#{number}; level={level}; merged={len(merged)}; ledger={len(ledger_rows)}")
        return 0
    except ReadbackMismatch as exc:
        write_json(args.output, {"status": "FAIL", "reason": str(exc)})
        annotation(".github/workflows/web-ci.yml", 1, f"GitHub 独立读回不一致：{exc}")
        print(f"github_readback: FAIL; {exc}")
        return 0
    except (HTTPError, URLError, TimeoutError, RuntimeError, OSError, ValueError, KeyError, json.JSONDecodeError, AttributeError, TypeError) as exc:
        write_json(args.output, {"status": "UNKNOWN", "reason": f"API/读回不可用：{type(exc).__name__}"})
        annotation(".github/workflows/web-ci.yml", 1, "GitHub API 不可用；状态为门禁未知，不得视为通过")
        print(f"github_readback: UNKNOWN; {type(exc).__name__}")
        return 0


def init_test_repo(root: Path) -> None:
    subprocess.run(["git", "init", "--quiet"], cwd=root, check=True)
    subprocess.run(["git", "config", "user.email", "gate-test@example.invalid"], cwd=root, check=True)
    subprocess.run(["git", "config", "user.name", "Gate Self Test"], cwd=root, check=True)


def test_format_check_real_file() -> bool:
    with tempfile.TemporaryDirectory(prefix="lapis-gate-format-") as directory:
        repo = Path(directory)
        init_test_repo(repo)
        target = repo / "mixed.txt"
        target.write_bytes(b"alpha\nbeta\n")
        git_at(repo, "add", "mixed.txt")
        git_at(repo, "commit", "--quiet", "-m", "baseline")
        base = git_at(repo, "rev-parse", "HEAD").strip()
        target.write_bytes(b"alpha\r\nbeta\n")
        output = io.StringIO()
        with redirect_stdout(output):
            result = format_check(root=repo, base=base, head="HEAD")
        captured = output.getvalue()
        return result == 1 and "mixed.txt" in captured and "文件混用了 CRLF 与 LF 换行" in captured and "line=1" in captured


def test_secret_scan_commit_history() -> bool:
    with tempfile.TemporaryDirectory(prefix="lapis-gate-secret-") as directory:
        repo = Path(directory)
        init_test_repo(repo)
        target = repo / "credentials.env"
        target.write_text("MODE=test\n", encoding="utf-8")
        git_at(repo, "add", "credentials.env")
        git_at(repo, "commit", "--quiet", "-m", "baseline")
        base = git_at(repo, "rev-parse", "HEAD").strip()
        target.write_text("MODE=test\nAPI_KEY=synthetic-test-secret-value-12345\n", encoding="utf-8")
        git_at(repo, "add", "credentials.env")
        git_at(repo, "commit", "--quiet", "-m", "add temporary test credential")
        target.write_text("MODE=test\n", encoding="utf-8")
        git_at(repo, "add", "credentials.env")
        git_at(repo, "commit", "--quiet", "-m", "remove temporary test credential")
        output = io.StringIO()
        with redirect_stdout(output):
            result = secret_scan(root=repo, base=base, head="HEAD")
        return result == 1 and "credentials.env" in output.getvalue() and "line=2" in output.getvalue()


def reverse_tests() -> int:
    sha_a = "a" * 40
    sha_b = "b" * 40
    timestamp = "2026-11-07T10:18:04Z"
    ledger_sample = "\n".join([
        f"| #1 | {timestamp} | {sha_a} | historical |",
        "<!--",
        f"| #2 | {timestamp} | {sha_b} | commented example |",
        "-->",
        "\x60\x60\x60md",
        f"| #3 | {timestamp} | {sha_b} | fenced example |",
        "\x60\x60\x60",
    ])
    parsed_ledger = parse_ledger_text(ledger_sample)
    bot_comment = {"id": 2, "user": {"login": "github-actions[bot]"}, "body": "<!-- agent-ops-gate -->"}
    human_comment = {"id": 1, "user": {"login": "reviewer"}, "body": "<!-- agent-ops-gate -->"}
    secret_samples = (
        "AKIA" + "A" * 16,
        "-----BEGIN PGP PRIVATE KEY BLOCK-----",
        "-----BEGIN ENCRYPTED PRIVATE KEY-----",
        "-----BEGIN DSA PRIVATE KEY-----",
        "API_KEY=synthetic-test-secret-value-12345",
    )
    tests = [
        ("1 单元测试失败的 PR 返回阻断退出码", combine_statuses("failure", "success") == "FAIL" and final_exit_code("FAIL") == 1),
        ("2 PGP/ENCRYPTED/DSA/无引号凭据及逐提交扫描均拦截", all(detect_secret(value) for value in secret_samples) and test_secret_scan_commit_history()),
        ("3 真实文件 format_check 检出混合换行并输出行号", test_format_check_real_file()),
        ("4 全通过时放行并正确分为绿灯",
         overall_status(["PASS"] * 8) == "PASS" and final_exit_code("PASS") == 0 and
         classify_review([{"filename": "docs/agent-ops/example.md", "status": "modified"}], 10) == "green" and
         review_decision("green", "PASS", blind_review="passed", manager_review="not_selected")["merge_allowed"]),
        ("5 超时明确归为失败", normalize_status("timed_out") == "FAIL" and final_exit_code("FAIL") == 1),
        ("6 CI/API 不可用显示未知且不放行", normalize_status(None) == "UNKNOWN" and status_label("UNKNOWN") == "门禁未知" and final_exit_code("UNKNOWN") == 1),
        ("7 钱/删除/门禁自身变更归红灯且缺少 Opus 不得合并",
         classify_review([{"filename": "web/src/player-state.ts", "status": "modified"}], 4, "+player.gold += 20") == "red" and
         classify_review([{"filename": "web/data/catalog.json", "status": "removed"}], 10) == "red" and
         classify_review([{"filename": ".github/workflows/web-ci.yml", "status": "modified"}], 10) == "red" and
         classify_review([{"filename": "tools/gate/check_gate.py", "status": "modified"}], 10) == "red" and
         not review_decision("red", "PASS", opus_review="missing", manager_review="approved")["merge_allowed"]),
        ("8 绿灯缺少子代理盲审不得标记已审查，且只更新 Actions bot 评论",
         not review_decision("green", "PASS", manager_review="not_selected")["reviewed"] and
         find_bot_comment([human_comment, bot_comment]) == bot_comment),
        ("9 台账忽略代码块/HTML 注释并逐项核对 PR/SHA/merged_at",
         len(parsed_ledger) == 1 and parsed_ledger[0]["number"] == 1 and
         ledger_matches({1: (timestamp.replace("Z", ".000Z"), sha_a)}, parsed_ledger) and
         not ledger_matches({1: (timestamp, sha_b)}, parsed_ledger) and
         not ledger_matches({1: (timestamp, sha_a), 2: (timestamp, sha_b)}, parsed_ledger)),
    ]
    failed = 0
    for name, passed in tests:
        print(f"[{'PASS' if passed else 'FAIL'}] {name}")
        failed += int(not passed)
    print(f"reverse_tests: {len(tests)-failed}/{len(tests)} passed")
    return int(failed > 0)




def local_file_rows() -> list[dict]:
    base, head = diff_refs()
    try:
        names = changed_paths(base, head)
    except RuntimeError:
        return []
    rows = []
    for name in names:
        try:
            parts = git("diff", "--numstat", f"{base}...{head}", "--", name).strip().split("\t")
            additions = int(parts[0]) if parts[0].isdigit() else 0
            deletions = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
        except (RuntimeError, ValueError, IndexError):
            additions, deletions = 0, 0
        rows.append({"filename": name, "status": "changed", "additions": additions, "deletions": deletions})
    return rows


STATUS_LABELS = {"PASS": "通过", "FAIL": "未通过", "UNKNOWN": "门禁未知", "NOT_APPLICABLE": "不适用"}


def status_label(value: str) -> str:
    return STATUS_LABELS.get(value, "门禁未知")


def summarize(args: argparse.Namespace) -> int:
    is_pr = os.environ.get("IS_PR", "false").lower() == "true"
    readback_data = read_json(args.readback, {})
    dependencies = normalize_status(os.environ.get("GATE_DEPS"))
    build = combine_statuses(dependencies, os.environ.get("GATE_BUILD"), os.environ.get("GATE_M73_BUILD"))
    screenshot = combine_statuses(
        os.environ.get("GATE_SCREENSHOT"), os.environ.get("GATE_CHROMIUM_E2E"),
        os.environ.get("GATE_M73_E2E"), os.environ.get("GATE_PLAYWRIGHT_INSTALL"),
        os.environ.get("GATE_STANDALONE_PREVIEW"), os.environ.get("GATE_M73_FIXTURE"),
        os.environ.get("GATE_S41_E2E", "success")
    )
    readback_status = str(readback_data.get("status", "UNKNOWN")).upper() if is_pr else "NOT_APPLICABLE"
    gates = [
        ("单元测试", combine_statuses(dependencies, os.environ.get("GATE_PARSER_UNIT"), os.environ.get("GATE_WEB_UNIT")), "unit_tests"),
        ("构建", build, "build"),
        ("类型检查", combine_statuses(dependencies, os.environ.get("GATE_TYPECHECK")), "typecheck"),
        ("格式检查", normalize_status(os.environ.get("GATE_FORMAT")), "format"),
        ("静态检查", normalize_status(os.environ.get("GATE_STATIC")), "static"),
        ("敏感信息扫描", normalize_status(os.environ.get("GATE_SECRETS")), "secrets"),
        ("截图自检", screenshot, "screenshot"),
        ("GitHub 独立读回", readback_status, "github_readback"),
    ]
    reverse = normalize_status(os.environ.get("GATE_SELF_TEST"))
    artifact = normalize_status(os.environ.get("GATE_SYNTHETIC_ARTIFACT"))
    overall = overall_status([x[1] for x in gates] + [reverse])
    if artifact == "FAIL":
        overall = "FAIL"
    elif artifact != "PASS" and overall == "PASS":
        overall = "UNKNOWN"
    rows = readback_data.get("changed_files") or local_file_rows()
    gate_self_modified = bool(readback_data.get("gate_self_modified")) or touches_gate_self(rows)
    level = readback_data.get("review_level", "未判定")
    if gate_self_modified:
        level = "red"
        if overall == "PASS":
            overall = "UNKNOWN"
    base_sha = readback_data.get("base_sha") or os.environ.get("GATE_BASE_SHA", "")
    head_sha = readback_data.get("head_sha") or os.environ.get("GATE_HEAD_SHA", "")
    lines = [
        "<!-- agent-ops-gate -->", f"## 机器门禁结果：{status_label(overall)}", "",
        "| 门禁 | 状态 |", "| --- | --- |",
    ]
    for title, status, _ in gates:
        lines.append(f"| {title} | {status_label(status)} |")
    lines += [
        f"| 九项反向测试 | {status_label(reverse)} |",
        f"| 验证产物上传 | {status_label(artifact)} |",
        "", f"**审查等级：** {level}", "", "**改动清单：**",
    ]
    if is_pr:
        lines.append(f"**PR：** #{readback_data.get('pr_number', os.environ.get('PR_NUMBER', 'unknown'))}；base={base_sha or 'unknown'}；head={head_sha or 'unknown'}")
    if rows:
        for item in rows:
            lines.append(f"- {item.get('filename')}（{item.get('status')}，+{item.get('additions', 0)} / -{item.get('deletions', 0)}）")
    else:
        lines.append("- 无法取得改动清单；按门禁未知处理。")
    if gate_self_modified:
        lines += ["", "**可信度警告：** 本 PR 修改了门禁自身，结果不可信；不得仅凭本次门禁结果放行。"]
    if level == "red":
        lines += ["", "**审查路径：** 红灯；须先取得 Opus 盲审，再由总管作最终决定。在此之前不得合并。"]
    elif level == "yellow":
        lines += ["", "**审查路径：** 黄灯；须子代理盲审，再由总管逐项验收。"]
    elif level == "green":
        lines += ["", "**审查路径：** 绿灯；须子代理盲审，总管每 5 个抽查 1 个。"]
    lines += ["", "本门禁当前为参考模式，没有启用 required-check 分支保护，也不会自动合并。缺失/不可用的检查不得推断为通过。"]
    markdown = "\n".join(lines) + "\n"
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(markdown, encoding="utf-8")
    write_json(args.json_output, {
        "overall": overall, "gates": {key: status for _, status, key in gates},
        "reverse_tests": reverse, "evidence_upload": artifact, "review_level": level,
        "gate_self_modified": gate_self_modified, "changed_files": rows, "readback": readback_data,
    })
    step_summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if step_summary:
        with open(step_summary, "a", encoding="utf-8") as handle:
            handle.write(markdown)
    for title, status, key in gates:
        if status in {"FAIL", "UNKNOWN"}:
            path, line = FALLBACKS[key]
            annotation(path, line, f"{title}：{status_label(status)}；查看对应日志/读回证据")
    if reverse != "PASS":
        annotation("tools/gate/check_gate.py", 1, "九项反向测试未通过或未执行")
    print(f"gate_summary: {overall}")
    return 0


def find_bot_comment(comments: list[dict], marker: str = "<!-- agent-ops-gate -->") -> dict | None:
    return next((
        item for item in comments
        if (item.get("user") or {}).get("login") == "github-actions[bot]"
        and marker in str(item.get("body", ""))
    ), None)


def post_comment(args: argparse.Namespace) -> int:
    token = os.environ.get("GITHUB_TOKEN", "")
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    number = os.environ.get("PR_NUMBER", "")
    if not all((token, repo, number)):
        write_json(args.output, {"status": "UNKNOWN", "reason": "PR 评论环境变量缺失"})
        print("pr_comment: UNKNOWN")
        return 0
    body = Path(args.summary).read_text(encoding="utf-8")
    marker = "<!-- agent-ops-gate -->"
    try:
        root = f"https://api.github.com/repos/{repo}"
        comments = paged_api(f"{root}/issues/{number}/comments", token)
        existing = find_bot_comment(comments, marker)
        if existing:
            result = api_json(f"{root}/issues/comments/{existing['id']}", token, {"body": body}, "PATCH")
            action = "updated"
        else:
            result = api_json(f"{root}/issues/{number}/comments", token, {"body": body}, "POST")
            action = "created"
        write_json(args.output, {"status": "PASS", "action": action, "comment_id": result.get("id")})
        print(f"pr_comment: PASS; {action}")
        return 0
    except HTTPError as exc:
        try:
            detail = exc.read().decode("utf-8", errors="replace")[:600]
        except OSError:
            detail = ""
        reason = f"GitHub comment API HTTP {exc.code}: {detail}"
        write_json(args.output, {"status": "UNKNOWN", "reason": reason})
        annotation(".github/workflows/web-ci.yml", 1, "PR 门禁结果无法写回评论；门禁未知，请查看 API 状态与响应")
        print(f"pr_comment: UNKNOWN; HTTP {exc.code}; {detail}")
        return 0
    except (URLError, TimeoutError, RuntimeError, OSError, json.JSONDecodeError, AttributeError, TypeError) as exc:
        write_json(args.output, {"status": "UNKNOWN", "reason": f"评论写回不可用：{type(exc).__name__}"})
        annotation(".github/workflows/web-ci.yml", 1, "PR 门禁结果无法写回评论；门禁未知")
        print(f"pr_comment: UNKNOWN; {type(exc).__name__}")
        return 0


def final_exit_code(overall: str) -> int:
    return 0 if overall == "PASS" else 1


def finalize(args: argparse.Namespace) -> int:
    summary = read_json(args.summary_json, {})
    overall = str(summary.get("overall", "UNKNOWN")).upper()
    if os.environ.get("IS_PR", "false").lower() == "true":
        comment = read_json(args.comment_json, {})
        if str(comment.get("status", "UNKNOWN")).upper() != "PASS" and overall == "PASS":
            overall = "UNKNOWN"
    message = f"最终门禁状态：{status_label(overall)}。"
    step_summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if step_summary:
        with open(step_summary, "a", encoding="utf-8") as handle:
            handle.write("\n" + message + "\n")
    print(message)
    return final_exit_code(overall)


def main() -> int:
    parser = argparse.ArgumentParser(description="lapis-rebuild machine gate")
    sub = parser.add_subparsers(dest="command_name", required=True)
    run_p = sub.add_parser("run")
    run_p.add_argument("--log", required=True)
    run_p.add_argument("--cwd", default=".")
    run_p.add_argument("--fallback-file", default=".github/workflows/web-ci.yml")
    run_p.add_argument("--fallback-line", type=int, default=1)
    run_p.add_argument("command", nargs=argparse.REMAINDER)
    sub.add_parser("format")
    sub.add_parser("static")
    sub.add_parser("secrets")
    sub.add_parser("self-test")
    shot = sub.add_parser("screenshot")
    shot.add_argument("--path", required=True)
    rb = sub.add_parser("readback")
    rb.add_argument("--output", required=True)
    sm = sub.add_parser("summarize")
    sm.add_argument("--output", required=True)
    sm.add_argument("--json-output", required=True)
    sm.add_argument("--readback", default=os.environ.get("GATE_READBACK_FILE", ""))
    cm = sub.add_parser("comment")
    cm.add_argument("--summary", required=True)
    cm.add_argument("--output", required=True)
    fin = sub.add_parser("finalize")
    fin.add_argument("--summary-json", required=True)
    fin.add_argument("--comment-json", default="")
    args = parser.parse_args()
    actions = {
        "run": lambda: command_run(args),
        "format": format_check,
        "static": static_check,
        "secrets": secret_scan,
        "self-test": reverse_tests,
        "screenshot": lambda: screenshot_check(args.path),
        "readback": lambda: readback(args),
        "summarize": lambda: summarize(args),
        "comment": lambda: post_comment(args),
        "finalize": lambda: finalize(args),
    }
    return actions[args.command_name]()


if __name__ == "__main__":
    raise SystemExit(main())
