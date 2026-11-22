# P1-5 分型重试规则

## 当前状态：硬关闭
本轮只做 dry-run 模拟，不发送消息、不重新派活、不执行修复、不调用大模型。`tools/agent_ops/retry.py` 的 `DEFAULT_ENABLED = False` 是硬关闭；即使传入 `--enable`，此版本仍返回 disabled。未来如经第一周复盘批准，必须另行提交代码开放开关，并同时提供 `--enable` 和总管批准记录。本试点没有实际执行适配器；即使审批门通过也只返回 not_executed，不产生副作用。

| 异常 | 计划方式 | 上限 |
|---|---|---:|
| task_stuck | dry-run 计划发送“继续”，从已核验检查点恢复 | 2 |
| context_exhaustion | 缩小范围，拆成更小任务 | 2 |
| ci_failure | 将 CI 原始失败输出附入重试提示 | 2 |
| direction_suspected_wrong | 停止并等总管判断 | 0 |
| task_timeout | 通知总管，不重试 | 0 |

未知类型 fail-closed。CI 没有原始错误文本时不生成重试计划。两次仍失败进入 dead-letter，不再消耗。

每次尝试记录原因、方式、结果、序号和 budget_rounds_charged；每次重试计入 P1-4 任务预算。本任务不修改登记表、`task_registry.py` 或 P1-4 文件。

未来批准记录至少包括 status=approved、approved_by=总管、approved_at、匹配的 request_id、first_week_review_accepted=true、max_attempts<=2。方向错误和任务超时始终为 0 次，不得被审批覆盖。

## 验证命令
```bash
python3 tools/agent_ops/retry.py self-test
python3 tools/agent_ops/retry.py simulate --type task_stuck --outcomes failed,failed
python3 tools/agent_ops/retry.py simulate --type ci_failure --outcomes failed,recovered --error-text "CI failure output"
python3 tools/agent_ops/retry.py run --type task_stuck
```
最后一条应输出 disabled 与 side_effects=false。
