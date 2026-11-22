# P1-5 告警规则

## 告警对象与时限
- 接收人：总管。
- 高严重程度：首次发现后立即复用现有 lapis-watchdog 唤醒路径，不等日报。
- 中严重程度：写入 alert-log.md，由总管每天集中处理一次。
- 巡检自身失败（退出码 2、PATROL_FATAL、状态损坏、GitHub API 不可用）：按高严重程度处理，不得静默。
- 不新增付费通知服务，不由 patrol.py 直接发送消息；通知动作由总管维护的现有 hook 接线。

## 每条告警必须包含
1. 任务名、task_key、request-id；
2. 异常类型与严重程度；
3. 观测值、阈值、发现时间；
4. 登记表中的真实对话链接和 PR 链接；缺失写“未登记”，不猜造；
5. 建议处理方式；
6. 是否首次发现（is_new）及建议动作。

高告警示例：任务卡住 37 分钟，阈值 30 分钟；附登记的对话链接；建议核实最后检查点后再决定是否继续。
中告警示例：PR check-run web-ci conclusion=failure；附 PR 链接；建议总管查看 CI 原始日志后决定后续动作。

## 去重与升级
- 相同任务、相同异常类型使用稳定 fingerprint。
- 首次高告警 action=notify_manager；未解除的重复观测更新 last_seen_at/occurrences，不重复唤醒。
- 详情变化形成新告警。
- 中告警写入告警日志，不即时唤醒。
- 巡检器自身故障由 hook 根据非零退出码与 PATROL_FATAL 告警。

## 处理记录与日报
总管处理后在当日条目补充结果、误报/漏报判定与处理耗时，并更新 patrol-state.json 的：
- false_positive_count
- missed_alert_count
- manager_handling_minutes_total
- manager_handling_samples

随后运行 `python3 tools/agent_ops/patrol.py report --date YYYY-MM-DD`。日报包含告警数、误报率、漏报数、处理耗时和记忆完整性检查状态。

第一周复盘后再决定是否调整阈值或启用安全重试；之后每月复盘。告警日志不写回任务登记表。

## Change record
- request-id: `agent-7x24-p15-patrol-20261118-01`
- source: P1-5 巡检简报
- reason: 明确告警内容、分级、去重、处理时限及日报指标。
