# P1-5 巡检规则

## 范围与原则
只巡检 `vileosbot-bot/lapis-rebuild` 登记表中的 `in_progress`、`awaiting_review` 任务。使用 Python 标准库只读 `docs/agent-ops/task-registry.yml`，用公开 GitHub REST API 查询 PR 与 check-runs；不登录、不用浏览器、不调用大模型、不产生模型 Token。登记表只读；不修改 `tools/agent_ops/task_registry.py`。巡检只写 `alert-log.md` 与 `patrol-state.json`。

## 七类异常（试点初值）
| 类型 | 条件 | 级别 |
|---|---|---|
| 任务卡住 | 最后输出时间严格超过 30 分钟 | 高 |
| 上下文耗尽 | 轮数达到预算 80%（30 轮即 24 轮），或上下文占用 >=85%，或元数据明确提示耗尽 | 高 |
| CI 失败 | PR 已完成 check-run conclusion 为 failure/cancelled/timed_out/action_required/startup_failure/stale | 中 |
| 任务超时 | 活跃任务 deadline 已过期 | 高 |
| 登记表过期 | last_updated 超过 48 小时 | 中 |
| 依赖阻塞 | depends_on 上游未完成，且其 PR 未合并或未登记 | 中 |
| 方向疑似错误 | 至少两次重试仍 gate 失败，或最近两次 retry_history 均失败 | 高 |

第一周先收集误报、漏报、处理耗时，再校准阈值，不先降低 30 分钟巡检频率。

## 时间与元数据口径
- 卡住检测读取可选字段 `last_output_at`、`last_activity_at`、`last_event_at`、`last_updated_at`，或带时分秒的 `updated_at/last_updated`。只有日期的 last_updated 不用于 30 分钟判断。
- 日期型 deadline 按 UTC 当日 23:59:59；带时区 ISO-8601 转 UTC。
- 当前登记表 schema 未强制 last_output_at；缺字段时无法证明“30 分钟无输出”，不作猜测。这是已知观测缺口，后续由总管在冲突窗口结束后按正常登记表变更流程补数据；本任务不改登记表。
- 轮数读取 rounds_used/round_count 或 cost_budget.cost_record；无记录不猜测。脚本无法读取 ChatGPT 隐藏上下文用量，只看登记表显式元数据。

## CI 与输出
对每个登记的 pull_request_url，先 GET PR 读取 head SHA，再 GET `/commits/{head_sha}/check-runs`。只将已完成失败结论告警；queued/in_progress 不告警。API 网络错误、限流、权限或格式异常必须以退出码 2 和 stderr `PATROL_FATAL` 明示，不静默跳过。

命令：`python3 tools/agent_ops/patrol.py run`。stdout 为 JSON，含任务、类型、严重度、观测详情、真实登记的对话/PR 链接、建议、is_new/action。
- exit 0：无异常。
- exit 1：发现异常（业务状态，不是脚本崩溃）。
- exit 2：巡检自身失败，stderr 含 PATROL_FATAL。
首次高告警 action=notify_manager；重复告警更新 occurrences，不重复唤醒；中告警追加告警日志。状态文件损坏时失败关闭，不覆盖损坏文件。日报：`python3 tools/agent_ops/patrol.py report --date YYYY-MM-DD`；可传 `--memory-report <json>` 纳入记忆检查状态。

## 现有 lapis-watchdog 接线方案（仅方案）
继续扩展 `~/hooks/scripts/lapis-watchdog.sh`，不另建看门狗。本任务不修改 ~/hooks/，不声称已配置 Cron。
1. hook 调用 patrol.py run，捕获 stdout/stderr/退出码。
2. exit 0 记录完成；exit 1 解析 JSON，仅将 severity=high 且 is_new=true 的告警送入现有唤醒路径；medium 留在告警清单。
3. exit 2 或 PATROL_FATAL 视为巡检器故障，立即通过现有 watchdog 唤醒总管。
4. 不由 patrol.py 直接发消息，不增加付费通知服务。

若总管为现有 hook 增加 --patrol-only 入口，30 分钟 Cron 正文模板（需先实现入口并设置真实 LAPIS_REPO；未执行）：
```cron
*/30 * * * * /usr/bin/env bash -lc 'test -n "$LAPIS_REPO" && cd "$LAPIS_REPO" && "$HOME/hooks/scripts/lapis-watchdog.sh" --patrol-only'
```
若现有 15 分钟 watchdog Cron 已运行，更推荐保留原 Cron，由同一 hook 内部按上次巡检时间做 30 分钟节流，不创建独立 watchdog。

## 04:00 记忆完整性检查接线方案
复用已有 `tools/agent_ops/memory_check.py`，不重建、不修改。总管在现有备份完成后把备份脚本实际产生的归档路径写入环境变量，不猜文件名：
```bash
: "${AGENT_MEMORY_REPO:?set the existing local agent-memory checkout}"
: "${AGENT_MEMORY_ARCHIVE:?set the exact archive produced by backup}"
REPORT="$LAPIS_REPO/tools/agent_ops/memory-check-$(date +\%F).json"
python3 "$LAPIS_REPO/tools/agent_ops/memory_check.py" --repo "$AGENT_MEMORY_REPO" --archive "$AGENT_MEMORY_ARCHIVE" --report "$REPORT"
python3 "$LAPIS_REPO/tools/agent_ops/patrol.py" report --memory-report "$REPORT"
```
仅为接线方案；不改 04:00 备份配置、不改 agent-memory、不配置 Cron。归档缺失或检查非零退出必须让备份作业失败并由 watchdog 告警。

## 第一周与迭代
每日记录告警数、误报、漏报、总管处理耗时。总管复核后更新 patrol-state.json 的 false_positive_count、missed_alert_count、manager_handling_minutes_total、manager_handling_samples，再运行 report。重复失败两次以上，评估转成硬规则或 CI 检查；每月复盘一次。第一周只巡检+告警，不启用重试。

## Change record
- request-id: `agent-7x24-p15-patrol-20261118-01`
- source: P1-5 巡检简报（Day 3）及 2026-11-22 派活时效修订
- reason: 建立零 Token 巡检、告警和看门狗接线方案，保持 P1-4 与总管 hook 所有权边界。
