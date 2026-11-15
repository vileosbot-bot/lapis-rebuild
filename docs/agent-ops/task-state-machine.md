# Agent 任务状态机

- request-id：agent-7x24-p03-registry-20261117-01
- 并行上限：10 个同时活跃执行任务

## 状态定义

| 状态 | 含义 | 是否占并行名额 |
|---|---|---:|
| created | 已登记，尚未派活 | 否 |
| dispatched | CP0 已完成，真实对话链接、分支、基线 SHA 齐全 | 否 |
| in_progress | 已获明确放行，CP1 已记录，正在执行 | 是 |
| awaiting_review | 已具备审查条件，等待总管/审查人处理 | 是 |
| completed | 总管验收完成；不代表 PR 已合并 | 否 |
| blocked | 存在明确阻塞项，等待解除 | 否 |
| paused | 人工暂停，等待恢复指令 | 否 |
| failed | 本轮失败并终止，不再活跃执行 | 否 |
| cancelled | 任务已取消 | 否 |
| dead_letter | 超过轮数或超时上限，进入终止死信队列 | 否 |

只有 in_progress 和 awaiting_review 占用并行名额。failed、dead_letter 均已终止，不占名额。created、dispatched、blocked、paused、completed、cancelled 不占名额。并行上限固定为 10，不得提高。

## 正常转换

| 当前状态 | 目标状态 | 必须满足的条件 |
|---|---|---|
| created | dispatched | CP0 同时完成；真实 conversation_url、已存在 branch、base_sha 均齐全；branch/base 已实际读回 |
| dispatched | in_progress | 总管明确放行；approval_status=granted；CP1 已记录授权范围和计划步骤 |
| in_progress | awaiting_review | CP2 已记录提交 SHA 和测试结果；CP3 已记录 PR URL、检查状态和待办；新任务必需测试与 CI 均成功 |
| awaiting_review | completed | CP0–CP3 完整；总管明确验收；记录 accepted_by、accepted_at、acceptance_note |
| awaiting_review | in_progress | 审查要求返工；记录 changes requested 与下一步，不覆盖历史证据 |

正常路径不得跳步。不得从 created 直接进入 in_progress，不得从 in_progress 直接 completed，不得缺少 CP2/CP3 就进入 awaiting_review。

## 异常转换

- created、dispatched、in_progress、awaiting_review 可按实际情况转为 blocked、paused、failed 或 cancelled；必须写明原因和下一步。
- in_progress 或 awaiting_review 可转 dead_letter，但必须记录达到的轮数/超时上限及最后证据。
- blocked 解除后，清空 blocked_by 并获明确恢复授权，才可回到 in_progress。
- paused 只有明确恢复授权后才能回到 in_progress。
- failed 只有明确重试授权才能回到 in_progress；超过预算或不再重试时转 dead_letter 或 cancelled。
- completed、cancelled、dead_letter 是终态；需要重做时创建新 request-id。

## CI 与审查门禁

新任务在 CP2 测试通过、CP3 已记录真实 PR URL 和明确 CI 状态（success/failure/pending/unknown）后，可由 in_progress 转为 awaiting_review。awaiting_review 表示等待人工审查；CI 状态必须按实际快照记录，failure/pending/unknown 不得声称通过。只有 CI 为 success 且总管明确验收，才可进入 completed。

P0-1 是导入的既有任务：其 awaiting_review 状态和门禁 FAIL 待查来自总管给定的历史事实。它标记 legacy_import=true，保留原状态但不构成新任务绕过 CI 门禁的先例；必须如实显示 FAIL，不得写成 PASS。

## 完成门禁

completed 必须同时满足：CP0–CP3 完整、CP2 测试通过、CP3 CI 状态为 success、总管明确验收并留名、不存在未解除的 blocked_by。工人不得自行标记 completed。PR 是否合并是独立事项；本任务只开 PR、不合并。

## 并行与冲突

- 转入活跃状态前先计数；若已有 10 个则拒绝第 11 个。
- 同一 repository + branch 不允许两个活跃任务同时写入。
- 两个活跃任务的 write_files 有交集时，必须登记 shared_files，并暂停其中一个。
- conflict_group 用于标识相关工作域，本身不等于文件冲突；以 branch 和实际文件路径交集为准。
- depends_on 记录先决任务；blocked_by 记录未解除的阻塞任务。
- 上游 PR 合并后，下游恢复前必须重新读取 main HEAD，核对 base_sha 和文件冲突。

## 登记脚本边界

脚本只允许登记任务、记录检查点、校验状态、检查并行/冲突/HEAD、生成恢复信息。不得修改游戏代码、测试用例或测试数据，不得创建/合并 PR，不得部署，不得自动改写任务分支。
