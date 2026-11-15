# Agent 任务检查点制度

- request-id：agent-7x24-p03-registry-20261117-01

## 总原则

1. 检查点必须写入 task-registry.yml，不能只留在聊天消息里。
2. CP0 与 dispatched 同时完成；不得先派活、后补链接或 SHA。
3. CP1 必须在第一次代码/文档修改之前记录。
4. CP2 必须在提交后记录 GitHub 实际 HEAD、变更范围和测试结果。
5. CP3 必须在 PR 创建后记录 PR 链接、head/base、检查状态和待办。
6. 重要操作先保存检查点，再进行下一项高风险操作。
7. 未读回的链接、SHA、检查结果不得写成已确认。

## CP0：派活完成

必须记录 request-id、真实 GPT 对话 URL、目标 repository、branch、base_sha 和 GitHub 实际读回证据。创建分支后读回分支 ref，确认起点等于 base_sha。

当且仅当 conversation_url、branch、base_sha 三项核心字段齐全且实际核实，状态才能从 created 变为 dispatched。CP0 完成时间就是派活完成时间。

新建空仓库的根提交没有父提交时，base_sha 留空，并在 base_sha_note 写明“新库建库，首批提交无父提交”。不得用根提交 SHA 伪造 base_sha。

## CP1：开始修改

在首次修改前记录精确授权文件范围、禁止触碰范围、计划步骤、验证方式、并行名额、conflict_group、write_files/shared_files、depends_on、blocked_by，以及放行状态和来源。

只有 CP0 完成、approval_status=granted、CP1 授权范围和计划齐全，才允许 dispatched → in_progress。

## CP2：提交代码

提交后记录 repository、branch、base_sha、GitHub 实际最新任务代码 HEAD、commit SHA、提交信息、变更文件、测试命令与实际结果、通过/失败/跳过数量、失败原因和 next_action。测试不得只写“通过”；必须能追溯实际运行记录。失败或跳过不得伪造通过。

## CP3：创建 PR

记录 PR 编号和真实 URL、head branch/head SHA、base branch/base SHA、PR Open/merged 状态、必需检查名称/运行号/结论，以及审查意见和 TODO。PR 已创建但 CI pending/failed/unknown 时，CP3 可记录事实，但任务仍保持 in_progress；只有必需检查成功才可进入 awaiting_review。只开 PR、不合并。

## head_sha 的自引用边界

Git commit SHA 由提交内容决定。登记表不能在同一提交内写入该提交自身 SHA。head_sha 表示本次登记表更新提交之前，最近一次从 GitHub 实际核实的分支 HEAD；它可以包含此前的登记表元数据提交。每次写入登记表检查点时，先把 head_sha 设为该次登记提交的父提交 SHA，不得猜测或写入尚未生成的自身 SHA。

检查器只允许一种登记滞后：当前 HEAD 是登记表记录的 head_sha 的直接子提交，且该提交唯一改动文件为 docs/agent-ops/task-registry.yml。此时标记 REGISTRY_ONLY。下一次登记表更新前，先从 GitHub 实际读取当前 HEAD，并将该 SHA 作为新登记提交的父提交记录。若 HEAD 不是直接子提交，或该提交还改动其他文件，必须标记 HEAD_MISMATCH/UNREGISTERED_COMMIT 并停止写入，调查后由操作者更新登记表。脚本不得自动把 head_sha 改成当前 HEAD。

## 缺失检查点告警

- dispatched 缺 CP0：错误，不能视为已派活；
- in_progress 缺 CP0 或 CP1：告警；
- awaiting_review 缺 CP0–CP3：错误；
- completed 缺 CP0–CP3 或验收记录：错误；
- 历史导入任务使用 legacy_import=true，缺失历史检查点标注“历史未提供”，不得补造；新任务不得使用此豁免。

## 预算记录

每个任务保留 max_rounds、timeout_minutes、cost_record。未获总管指定的预算值保持 null，不擅自编数字。每次执行记录实际轮数、耗时和可核实成本；达到任一上限时停止并按规则转 dead_letter。
