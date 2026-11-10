# Feature Map Schema

## 1. Purpose

Feature Map 是功能验收索引，不是玩法设计文档，也不是来源事实的替代品。每个 Feature 必须回答：

1. 功能在什么地图、场景、NPC 或 UI 位置。
2. 从可复现的起点如何到达。
3. 预期状态是什么。
4. 哪些截图、运行时断言、状态快照或日志足以证明结果。
5. 哪些绑定尚未核实，阻塞在哪里。

Feature Map 中的静态来源证据与网页运行时验收状态必须分开记录。

## 2. 顶层结构

Feature Map 文件使用 YAML，顶层必须包含：

| 字段 | 类型 | 规则 |
|---|---|---|
| \`schema_version\` | integer | 当前为 \`1\` |
| \`map_id\` | string | 稳定地图标识 |
| \`repository\` | string | 必须是目标 bot 仓库 |
| \`baseline_commit\` | string | 完整 Git commit SHA |
| \`integration_dependency\` | object | 外部验收任务与绑定状态 |
| \`evidence_policy\` | object | 来源等级、运行状态和未知值规则 |
| \`features\` | array | 一个或多个 Feature 条目 |

## 3. Feature 条目必填字段

每条 Feature 必须包含：

| 字段 | 类型 | 说明 |
|---|---|---|
| \`feature_id\` | string | 稳定 ID；第一章使用 \`CH1-NN\` |
| \`flow_order\` | integer | 主链顺序，从 1 开始 |
| \`name\` | string | 功能名称 |
| \`feature_status\` | enum | \`READY_FOR_TEST / BLOCKED / NOT_RUN / PASS / FAIL / PARTIAL\` |
| \`runtime_status\` | enum | \`NOT_RUN / PASS / FAIL / BLOCKED\` |
| \`location\` | object | 地图、场景、NPC 或 UI 位置；未核实字段必须显式写状态 |
| \`code_anchors\` | array | 相关源码/数据文件路径及其用途 |
| \`source_records\` | array | 静态来源记录、定位符及来源证据等级；无来源时使用空数组 |
| \`bindings\` | object | 运行时身份、路线、地图、遭遇、返回等绑定 |
| \`entry_path\` | array | 从启动到目标功能的操作步骤 |
| \`expected_observations\` | array | 可观察的预期结果 |
| \`assertions\` | array | 稳定断言 ID、方法、通过条件和当前状态 |
| \`screenshots\` | array | 计划截图节点、文件名和捕获状态 |
| \`state_snapshots\` | array | 需要保存的状态字段及采集状态 |
| \`known_gaps\` | array | 未解决的问题和解除条件 |

### 3.1 Binding 对象

每个绑定字段都必须具有可读值和状态。未知值不得省略、猜测或用空字符串代替。

允许的未知状态值：

- \`BLOCKED\`：当前缺少必要证据或前置绑定，不能可靠执行。
- \`NOT_RUN\`：绑定定义已明确，但尚未执行验证。

已知静态候选值可以照实填写，但必须同时注明来源证据等级和运行时状态。例如，静态候选地图 ID 不等于已确认的网页 runtime map ID。

### 3.2 Entry Path 步骤

每一步至少包含：

- \`step_id\`
- \`action\`
- \`expected_observation\`
- \`status\`

若到达路径依赖尚未确认的路线、地图或 NPC 绑定，该步骤必须为 \`BLOCKED\`，并在 \`known_gaps\` 说明缺失内容。

### 3.3 Assertion 条目

每项断言至少包含：

- \`assertion_id\`：跨版本稳定且唯一。
- \`method\`：\`runtime_assertion / state_snapshot / screenshot / log / source_reference\` 之一。
- \`expected\`：可观察、可判定的通过条件。
- \`status\`：\`BLOCKED / NOT_RUN / PASS / FAIL\`。
- \`evidence_artifact\`：证据文件名或显式状态值。

测试用例数量不能冒充断言数量。只有实际执行并记录的 assertion ID 才计入执行断言数。

### 3.4 Screenshot 条目

每张截图至少包含：

- \`screenshot_id\`
- \`planned_filename\`
- \`capture_point\`
- \`status\`：未执行时为 \`NOT_RUN\`；因绑定缺失不能到达时为 \`BLOCKED\`。

截图必须来自对应的真实网页/浏览器状态。使用 \`page.setContent()\` 构造的 synthetic harness 截图必须明确标为 synthetic，不得用作真实游戏截图。

## 4. 证据等级与运行状态

来源证据等级与运行状态是两个独立维度。

来源证据等级允许值：

- \`RECOVERED_SECONDARY\`
- \`INFERRED\`
- \`RECONSTRUCTION_POLICY\`
- \`UNVERIFIED\`
- \`NOT_APPLICABLE\`

ybcs-offline 来源内容只能标记 \`RECOVERED_SECONDARY\` 或 \`INFERRED\`，不得标记 \`VERIFIED\`。即使网页 E2E 通过，也不得升级其来源等级。

运行状态允许值：

- \`NOT_RUN\`
- \`PASS\`
- \`FAIL\`
- \`BLOCKED\`

\`PASS\` 只表示本 Feature 对应的网页行为按所列断言通过，不代表原版服务端语义已恢复。

## 5. 状态裁定规则

1. 任一关键身份/路线/地图/遭遇/返回绑定为 \`BLOCKED\` 时，依赖该绑定的 Feature 不得标记 \`PASS\`。
2. 仅有静态数据、源码引用或 synthetic 页面时，runtime status 不得标记 \`PASS\`。
3. Feature 的所有必需断言都执行并通过，所需截图/状态快照均可读回，且没有阻塞绑定时，才可申请 \`PASS\`。
4. 断言失败标记 \`FAIL\`，不得通过删断言、降低覆盖或更换证据类型消除失败。
5. 证据不足标记 \`BLOCKED\`；测试尚未执行标记 \`NOT_RUN\`。
6. Feature Map 更新必须绑定实际基底和实现提交 SHA；不能混用不同提交的测试结果。

## 6. 第一章主链覆盖要求

第一章端到端主链至少拆分为：

1. 探索切图。
2. NPC 对话。
3. 接取 Quest1 并推进一环。
4. 对应遭遇战斗取胜。
5. 胜利后返回正确探索场景。

每一环分别记录到达路径、状态断言、截图/日志证据及绑定缺口。整条主链通过要求 5 个 Feature 全部通过；不得以其中一个训练场景或旧版本验收替代第一章主链。


### 3.5 Code Anchor 状态

\`code_anchors[].status\` 使用以下值：

- \`REFERENCE_ONLY\`：当前仅作为实现/数据阅读入口，不证明该 Feature 已绑定。
- \`ACTIVE_IMPLEMENTATION\`：已核实该源码路径参与当前 Feature 的实际运行。
- \`BLOCKED\`：源码路径或职责仍待核实。

仅引用现有控制器、训练 harness 或相似功能时使用 \`REFERENCE_ONLY\`，不得据此将 Feature 标记为可通过。
