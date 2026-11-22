# Agent Ops 成本预算规则

版本：P1-4 试点版（2026-11-22）

## 1. 目的与适用范围

每个新派任务必须在 CP0（created → dispatched）前登记最大轮数和超时时间。预算是停止线和诊断触发器，不是质量豁免，也不是工人自行缩减交付范围的理由。

Chat 模式尚未并入额度池期间，不填写虚构的金钱预算；成本字段采用“记基线”。当前先记录真实轮数、耗时、PR 数、重试次数和超限情况。试点完成前，不将本规则推广到所有项目。

## 2. 三级预算（试点初值）

| 级别 | 典型范围 | 最大轮数 | 超时时间 | 门禁联动 |
|---|---|---:|---:|---|
| 小任务（绿灯） | 改文案、修样式、小幅调整 | 15 轮 | 60 分钟 | 上限较低；达到停止线立即停止并进入死信，不自动重试 |
| 中任务（黄灯） | 新增功能、较核心逻辑 | 30 轮 | 120 分钟 | 达到停止线后进入死信，由总管诊断分型后决定下一步 |
| 大任务（红灯） | 多模块改动、复杂重构 | 50 轮 | 240 分钟 | 总管逐轮关注；建议在轮数或时间达到 80% 时提前预警；达到上限仍须停止并进入死信 |

轮数定义：一次“总管发消息—工人回复”算一轮。轮数与耗时从真实对话计数；PR 数只统计实际合并的 PR，不把仅创建或仍打开的 PR 计为合并 PR。

三级数值是总管已批准的试点初值。`set-budget --tier` 只映射到此表。自定义数字或对既有预算的任何调整，必须同时提供 `--approved-by` 与 `--approval-basis`，并记录审批依据；工人不得自行放宽预算。数值必须为正整数。

## 3. 命令与派活门禁

### 3.1 设置预算

```text
python tools/agent_ops/task_registry.py set-budget --request-id X --tier small|medium|large
python tools/agent_ops/task_registry.py set-budget --request-id X --max-rounds N --timeout-minutes M --approved-by total-manager --approval-basis "总管明确批准的依据"
```

`tier` 与显式数字二选一。显式数字必须同时提供轮数和分钟数。初次给 created 任务设置已批准的固定 tier 可直接使用 tier；自定义值、对现有预算的变更、或对非 created 任务设置预算，均须提供总管审批人和依据。写入前执行 `validate_task`、capacity 与 conflict 校验；任何校验失败都不得保存。

### 3.2 派活检查

created → dispatched（CP0）时，`cost_budget.max_rounds` 与 `cost_budget.timeout_minutes` 必须都已设置。任一为 null，拒绝派活。该检查只约束派活动作，不追溯阻断已经 dispatched、in_progress 或 completed 的历史任务。

### 3.3 每轮继续前的停止检查

开始新一轮工作消息前，用当前已完成轮数与已耗时执行：

```text
python tools/agent_ops/budget_tracker.py guard --request-id X --current-rounds N --elapsed-minutes M
```

退出码 0 表示仍在预算内；退出码 2 或输出 `STOP` 表示达到或缺少预算，必须停止，不得发送下一条工作消息或提交新代码。`current-rounds` 是已经完成的轮数；达到 max_rounds 后不再开始下一轮。超时达到 timeout_minutes 时同样停止。

## 4. 超限处理与死信

超限后严格按以下顺序执行：

1. **停止**：不再发新消息、不再提交新代码；不以重试、换标题或新会话规避上限。
2. **记录**：保存实际轮数、耗时、已完成进度、卡住原因、相关日志/提交/测试证据。
3. **进入死信**：使用现有 `transition --to dead_letter --dead-letter-evidence JSON`。证据必须包含 `limit_type`（`max_rounds` 或 `timeout_minutes`）、`actual_value`（严格大于对应预算）和非空证据说明。原有 `validate_transition` 负责校验，不重建死信机制。
4. **生成超限报告**：状态转换时登记 `dead_letter_report`，包括完成进度、卡点、上限、实际值、证据和停止动作；工人同时向总管提交可读的超限报告。
5. **等待总管诊断**：总管选择继续（明确问题并批准有限追加轮数）、缩小范围、换方法或放弃。没有明确批准，不得追加轮数。

`dead_letter` 默认禁止重跑。未经总管诊断，`transition --to in_progress` 必须被拒绝。若总管诊断后决定有限继续，须先用带总管审批人和审批依据的 `set-budget` 提高对应上限，再使用 `transition --to in_progress --retry-approved --approved-by total-manager --manager-diagnosis "诊断结论与追加范围"`；程序核对新上限必须高于死信报告记录的旧上限，并将旧报告、审批人和诊断结论归档到 `dead_letter_history`。没有这些条件，死信任务不得重跑。缩小范围、换方法或放弃则由总管另行安排；不得原样重跑。

## 5. 成本记录与基线

`docs/agent-ops/cost-baseline.md` 是按月汇总的基线表。每个任务结束后，使用 `budget_tracker.py record` 将真实测量值追加到该任务的 `cost_budget.cost_record`；使用 `budget_tracker.py report` 按级别计算记录数、平均轮数、平均耗时、合并 PR 数、重试次数和超限数。

P5 Routine 成本审计日志（自 2026-11-13 开始记录）是基线来源和同一本账。`cost_record` 是登记表中的结构化记录/汇总入口，不另造一份独立成本账，不重复计算同一任务。记录时不得猜测缺失数字；无法核实的字段先查原始对话或 P5 台账，仍无法确认则标为待总管核对，不写假数。

每月汇总一次；每个级别至少积累 3 个真实任务后再评估该级别预算。3 个试点任务一天跑不完是正常情况。

## 6. 12 月额度并入后的校准

Chat 并入额度池后再确定真正的额度预算，不在当前阶段填写金额。初始校准方法：

- 对每个级别分别计算试点任务平均轮数、平均耗时。
- 以平均值 × 1.5 作为下一阶段预算初值，保留缓冲。
- 连续运行一个月后统计超限率：高于约 30% 表示可能定得过紧，评估放宽；低于约 5% 表示可能定得过松，评估收紧；中间区间先维持并继续观察。
- 每月复盘轮数、耗时、重试、PR、超限原因分类和预算调整依据。所有调整须由总管批准并留痕。

## 7. 试点边界

P1-4 与 P1-5 是中任务级别的前两个试点。机制上线并开始记录即为本阶段目标；不要求当天完成全部九个试点任务。每级至少 3 个真实任务后再提出预算校准建议。并行上限保持 10，不迁 Docker、不挂 VPS、不购买新平台。
