# Patrol Skill

## 用途
使用确定性 Python 规则巡检 Lapis Agent Ops。只读登记表与 GitHub；不调用大模型、不发消息、不改任务、不启用重试。

## 命令
```bash
python3 tools/agent_ops/patrol.py run
python3 tools/agent_ops/patrol.py report --date YYYY-MM-DD
python3 tools/agent_ops/patrol.py self-test
python3 tools/agent_ops/retry.py self-test
```

## 七类异常
- task_stuck：超过 30 分钟无显式输出时间。
- context_exhaustion：轮数预算 >=80% 或上下文占用 >=85%。
- ci_failure：已完成 check-run 失败。
- task_timeout：deadline 过期。
- registry_stale：last_updated 超过 48 小时。
- dependency_blocked：上游未完成且 PR 未合并。
- direction_suspected_wrong：重复重试失败且门禁仍失败。

脚本只能读取登记表显式元数据，不能读取 ChatGPT 隐藏上下文。没有输出时间戳时，无法证明 30 分钟无输出；这是数据缺口，不等于正常。

## 处理流程
1. 检查退出码：0 无异常；1 发现异常；2 巡检器自身失败。
2. 解析 stdout JSON。新高告警由现有 lapis-watchdog 唤醒总管；中告警留在 alert-log.md。
3. 不修改 task-registry.yml、task_registry.py、P1-4 文件。
4. 不碰 ~/hooks/，不配置 Cron；这些由总管接线。
5. retry.py 只允许 self-test 和 dry-run simulate；不得启用。
6. 误报/漏报复核后更新指标并生成日报。
7. 第一周复盘，之后每月复盘；重复失败评估转为硬规则或 CI 检查。

## 重试边界
task_stuck、context_exhaustion、ci_failure 未来最多两次；direction_suspected_wrong 与 task_timeout 为 0 次。两次失败进入 dead-letter。任何启用都需要第一周数据可接受和总管单独批准。

## Change record
- request-id: `agent-7x24-p15-patrol-20261118-01`
- source: P1-5 巡检简报
- reason: 提供巡检 Skill 的命令、异常类型与处理流程。
