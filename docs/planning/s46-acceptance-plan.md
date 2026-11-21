# S46 第一章综合验收方案（合并草稿，待总管审阅）

- request-id：trial-s46-acceptance-plan-20261121（合并草稿）
- 仓库：vileosbot-bot/lapis-rebuild
- 方案基线：main@4876866507930b85c97da3f67828b288f264ac32
- 文档状态：合并草稿；以 Chat 路方案为骨架，并入 CLI 路已验实的增量；待总管审阅，不代表已批准、已冻结或已执行。
- 来源：Chat 路分支 `trial/s46-acceptance-plan-chat` 提交 `a8856cee`；CLI 路 `s46-acceptance-plan-cli.md`。
- 本文只定义验收方案，不记录任何本轮实测通过结果。

## 1. S46 范围定义

### 1.1 定义边界

S46 在当前 main 的 Plan.md 中没有独立条目。本文件提出的 S46 范围是综合验收提案，不是 Plan.md 已批准的里程碑，也不把 S46 写成既定计划。范围须由卫勒拍板。

**建议纳入 S46：**

1. S42 第一章剧情首战：最终集成版只运行一次，包含开战前 G0 同战斗身份门禁、真实 20 敌阵容、战斗胜利、结算边界和返回地图。
2. S43 属性成长：升级、自动成长、属性点发放/分配、存档迁移；DEX/REG 单独实测并保留证据边界。
3. S44 装备：武器/防具/饰品三槽、职业适配、属性贡献、装备切换和 SaveV2 往返。
4. S45 商店：武器店、防具店、药店的目录、购买、库存、交易幂等、背包上限、存档恢复和 UNKNOWN 药水使用保护。
5. 集成回归：新建角色金币、第一章地图/路线、Quest1 窄边界、M7.3 野外遭遇、存档读档、错误日志和构建回归。

**建议排除：**

- 运行原版 NeoDark 客户端、验证 ybcs 离线包购买流程，或把离线包验证结果当作 S46 证据。
- 原版服务端战斗公式、零售 AI、零售掉落/刷新规则等尚未恢复的语义。
- 三家商店 NPC 的真实地图可达性和原版对话闭环；当前目录明确为 reachability=UNKNOWN、runtimeEnabled=false。
- 药水实际恢复量、B4524 替身贴图的零售身份、占位对话文案的原版真实性。
- 第一章以外章节、公开部署和非本方案列出的新功能。

S46 的通过结论只能表述为“网页重构版在已声明的 RECOVERED_SECONDARY / RECONSTRUCTION_POLICY 范围内通过综合验收”，不能表述为原版零售行为已 VERIFIED。

### 1.2 与既有阶段的关系

| 阶段 | 与 S46 的关系 |
|---|---|
| S42 | 第一章剧情首战的最终集成验收；按既有约束只在 S46 最终集成版运行一次，不提前跑、不失败后重跑。 |
| S43 | PR #11 已合并（d87f4d4）；S46 验证属性成长链在最终运行时、装备和存档中的集成，并完成 DEX/REG 证据门。 |
| S44 | PR #13 已合并（bec5b2d）；S46 验证三槽装备、职业属性贡献、购买/装备状态与存档恢复的集成。 |
| S45 | PR #16 已合并（0155c43）；S46 验证三店运行时交易和存档恢复，但不把尚未启用的 NPC 路线说成已打通。 |
| 队列 0–6 | 已自动验收完成，作为既有基线；S46 不重开、不把队列完成记录冒充本轮 S42 证据。 |

### 1.3 证据等级和数值比较规则

- 原始静态表、随包资源和可追溯提取记录：按各文件现有标签记录为 RECOVERED_SECONDARY；不因此声称零售运行时已验证。
- 重建的成长、装备、商店库存、野怪触发、AI、波次和奖励规则：按 RECONSTRUCTION_POLICY 记录。
- 没有足够证据的字段：UNKNOWN；不得用推测补齐。
- ybcs 离线包相关内容只允许标 RECOVERED_SECONDARY 或 RECONSTRUCTION_POLICY，绝不标 VERIFIED。

数值比较统一采用以下口径：

- 整数、ID、数量、HP、金币、EXP、属性点、阶段号、布尔状态：必须精确相等，不设容差。
- 比较浮点派生值时，参考值非零且相对差小于 0.1%，标记为“一致（舍入级）”，同时保留原值、绝对差和相对差；相对差达到或超过 0.1% 标记为“不一致”。
- 参考值为 0 时必须精确相等；不得用除零或任意 epsilon 掩盖差异。
- “一致（舍入级）”只用于数值舍入判断，不代表未知的 DEX/REG 效果已被证明为零。

## 2. 验收项清单

### 2.1 S42：第一章剧情首战

入口：web/e2e/s42-ch1-end-to-end-acceptance.spec.ts。只允许在最终 S46 候选版本执行一次。S42 的剧情首战与 M7.3 map 1020 野外遭遇是两条不同验收链，不得混用。

**历史失败基线（不是通过标准）：** 2026-11-13 的 A09 记录为真实战斗 6 个行动、0/20 击杀、玩家 HP 125→0、金币 0、EXP 0/500。该结果只能作为失败基线；在 G0 证明遭遇身份和存档来源一致之前，不得拿它与新结果作因果比较。

**首战阵容固定值：**

- 1001 步兵 ×16，每只 HP 100。
- 1003 枪兵 ×3，每只 HP 100。
- 1010 十步长 ×1，HP 150。
- 敌方总数 20，总 HP = 16×100 + 3×100 + 1×150 = 2050。
- 原始依据为 Set.lib::ability.atr 的字段 2，SHA-256：0bab4c622336378e52fb0d13b6e5d50a78f2c514d687332d47042c416a07c04b，原始行 263/265/272。2026-11-21 重读后的 ID→HP 口径为 1001=100、1003=100、1010=150。
- 离线包中 1001=13、1003=13、1010=19 的数值不得替代上述原表 HP。
- 这三类怪物没有技能；敌方 AI 属重建策略，不得描述为恢复了零售 AI。

| 验收项 | 入口/路径 | 通过标准 | 证据 |
|---|---|---|---|
| G0 同战斗身份门禁 | S42 文件中的 Story source 1 入口；战斗开始、玩家第一次行动之前读取一次 runtime/scene 原子快照 | sourceId=story-source-1；fieldMapId=1030；gateCell=(72,30)；battleZoneId=1；战斗场景 mapId=1；入口 provenance 与 authority 原样记录。敌方必须恰好 20 只，ID 计数为 1001×16、1003×3、1010×1，逐只 maxHp 与原表相符，总 HP=2050；不得出现 dummy-melee、dummy-ranged 代替真实阵容。若 runtime 无法把每个敌人追溯到来源 ID 和 HP，G0 不通过。视觉资源若使用 fallback，必须单独标 RECONSTRUCTION_POLICY，不得把视觉资源 ID 当成怪物来源 ID。 | 战斗入口原子快照 JSON、阵容签名、每只敌人的来源 ID/runtime entity ID/HP/位置、当前候选 commit SHA、运行 ID、SaveV2 版本/来源/金币；与 2026-11-13 A09 历史记录的遭遇身份对照表。 |
| A08 剧情入口 | S42 spec 的地图移动与剧情门入口 | 从 map 1000 经既有路线进入 map 1030；sourceId、fieldMapId、gateCell、battleZoneId 与 G0 预期一致；Quest1 的 SELECT 状态不得被误当作剧情首战奖励或服务端接受。 | 路线/地图快照、剧情入口快照、Quest1 状态。 |
| A09 真实战斗 | G0 通过后，沿 S42 spec 的实际玩家行动路径战斗；不得调用设置玩家 HP、设置敌人 HP、强制胜利或跳过战斗的 acceptance fixture | 1–40 个玩家行动内 phase=won；明确记录并核对 20/20 敌人 HP 均归零；玩家最终 HP>0；至少有一次真实攻击事件。每次行动槽等待沿用 spec 的最多 40 个模拟步、12,000ms 超时边界。若 40 个行动仍未胜利、玩家 HP 归零或出现未解释的战斗状态，判失败。 | 完整战斗事件日志、行动计数、每次行动前后 HP、敌方剩余数曲线、胜利快照、浏览器录像/截图。 |
| A10 胜利结算和返回 | S42 spec 的胜利后返回流程 | 返回 map 1060，坐标 (20,120)，story-victory-return-01 成立；route 052 不得被误触发。Story source 1 的 rewardSettlement 必须为 not-applied；金币、EXP/成长状态、Quest 状态与战前基线不变，不发剧情首战金币/EXP/物品奖励。 | 战前/战后 runtime 快照、SaveV2/奖励收据差异、地图坐标、route 状态。 |
| A11 证据完整性 | S42 spec 的最终 checkpoint | 原 spec 的 11 项断言全部通过；6 张截图全部采集并记录 SHA-256/字节数；1 个测试用例通过、无跳过；pageErrors=0。consoleErrors 必须完整记录并逐条判定，不得静默忽略。 | Playwright 原始输出、checkpoint JSON、6 张截图及 SHA-256、page/console error 清单。 |

G0 是 A09 的前置硬门禁，不得用“最终 phase=won”反向推断 G0 通过。现有 S42 spec 的 A09 尚未断言 20 敌人的数量、来源 ID 和 HP；因此在 S46 执行前，必须确保 G0 以可审计方式成为阻断条件。若不改测试文件就无法执行 G0，应在后续 S46 实施阶段先补足门禁；本方案本轮不改代码。

### 2.2 S43：属性成长与存档

入口：

- web/tests/m7-2-attribute-points.test.ts
- web/tests/m7-2-attribute-save-migration.test.ts
- web/e2e/m7-2-attribute-allocation.spec.ts
- web/src/progression/attribute-stat-policy.ts
- docs/integration-notes/m7-2-attribute-points.md
- docs/validation/m7-2-attribute-points-acceptance.md

| 验收项 | 通过标准 | 证据 |
|---|---|---|
| 自动成长 | STR、CON、INT、WIS、DEX、REG 六项每升一级自动成长 +1；到 Lv6 时六项各累计 +6。 | Lv1 与 Lv6 progression 快照、成长前后差值。 |
| 属性点发放 | Lv1–5 每级 1 点，Lv6 起每级 2 点；Lv6 未分配点数为 7；Lv65 累计发放 125 点；Lv66–100 不继续发放运行时属性点。 | progression 快照、纯函数单测输出、逐级累计表。 |
| 属性点分配 | Lv6 状态分配 1 点 STR 后未分配点数 7→6；取消/非法分配不得改变属性和点数；分配不能超过余额。 | 分配前后快照、单测输出、UI 截图。 |
| 已有映射 | 每点 STR：物理攻击 +1、防御 +1；每点 INT：魔法攻击 +1、魔法防御 +1；每点 CON：最大 HP +50；每点 WIS：最大 MP +50。 | attribute-stat-policy 单测中的 before/after 和 delta。 |
| 存档迁移 | 旧 SaveV2 与新 schema 往返后保留等级、EXP、HP/MP、技能、装备、金币、属性点和已分配属性；迁移不得重复发点。 | migration 测试输出、迁移前后 JSON、再次加载快照。 |
| 等级转职 | 当前 M7 重建策略的前段阈值为 Lv6、Lv16、Lv26；逐一验证阈值前不转、达到阈值后按策略转入下一阶段、重复处理不重复转职。基线冲突：s29-m6-integration.spec.ts 在阈值点击 m6-promote（:21/:50/:79），S43 E2E 到 Lv6 仍断言原职业 ID 100/109，与简报“6/16/26 级自动转职”冲突；正式候选须在 S46 前消解冲突并重新对齐 S43 检查点，基线不能以“按钮可点”交自动转职（来源：CLI 路 §6，已验实）。 | 阈值前/后 stageId、promotion receipt 和测试输出。该规则标 RECONSTRUCTION_POLICY，不声称恢复了零售服务端转职条件。 |

S43 浏览器 E2E 当前覆盖剑士/巫师两条角色路径；按现有 spec 的 2 个用例、每个角色 3 张截图，共 6 张截图验收。DEX/REG 不得套用 STR/CON/INT/WIS 的已知映射，单独按第 4 节实测。

### 2.3 S44：装备与战斗属性

入口：

- web/tests/m7-2-equipment.test.ts
- web/tests/m7-2-equipment-stat-policy.test.ts
- web/e2e/m7-2-equipment.spec.ts
- 装备目录和 M7.2 装备运行时源码

| 验收项 | 通过标准 | 证据 |
|---|---|---|
| 目录和槽位 | 装备目录 612 条记录可唯一索引；武器、防具、饰品 3 个槽位均可表示；重复装备 ID、错误槽位、未拥有物品不得装备。 | 目录计数、唯一 ID 断言、槽位状态和单测输出。 |
| 数值贡献 | 剑士代表武器 item 1 的物理攻击贡献为 +90；巫师代表武器 item 10 的魔法攻击贡献为 +60；代表防具 item 16 的防御贡献为 +3；三槽组合样例的汇总为 attack +90、defense +3、magicDefense +3。 | policy 测试的原值、装备后值、delta；装备目录原始记录。 |
| 装备切换 | 装备、卸下、换装不消耗物品所有权；职业不适配、槽位不适配、属性/等级条件不满足时拒绝；不能出现同一物品重复占槽。 | 8 项装备单测、5 项 stat-policy 单测及背包/槽位快照。 |
| 存档 | 装备槽、背包、派生战斗属性在 SaveV2 保存/读档后保持一致，不重复扣物品。 | SaveV2 前后 JSON、读档后的装备和 combatStats。 |

现有装备 E2E 有剑士/巫师 2 个用例，每个用例覆盖装备前、装备后、存档读档后等 4 个截图点，共 8 张。现有浏览器 E2E 主要以武器为代表；防具/饰品的完整槽位规则由单测覆盖，不得把武器 E2E 说成三槽均已浏览器实测。装备目录中的 stageRestriction 若无原始 stage ID，必须保留 UNKNOWN，不得自行补造等级/阶段限制。

### 2.4 S45：三家商店运行时

入口：

- data/shops/ch1-shop-catalog.json
- web/src/shops/shop-catalog.ts
- web/src/shops/shop-runtime.ts
- web/tests/ch1-shop-runtime.test.ts
- web/e2e/ch1-shop-flow.spec.ts

目录核对值：

| 商店 | 程序号 | shopNumber | NPC ID | 地图标识 | 目录条数 |
|---|---:|---:|---:|---|---:|
| 武器店 | 13 | 1 | 21200 | map:old:2000 | 120 |
| 防具店 | 14 | 2 | 21210 | map:old:2100 | 120 |
| 药店 | 15 | 3 | 21230 | map:old:2300 | 9 |

三店合计 249 条目录记录。目录限额为每店最多 120 条；价格必须等于 itemtbl 原始 numericColumns[17]（第 18 列），shopNumber 必须与原始 numericColumns[2] 一致。样例核对：武器 item 1 价格 80；防具 item 16 价格 100；红药 item 4001 价格 50；蓝药 item 4006 价格 100。

药店统计口径差：itemtbl 实际 shopNumber=3 的原始记录为 103 项，不是 105；105 口径为 103 项消耗品 + 2 件采矿工具，采矿工具不属于药店商品，不进入 Program 15 目录；以 105 为分母约 1.90%，属实质口径差；实际验收按 9 个红蓝药目录候选（来源：CLI 路 §6，已验实）。

| 验收项 | 通过标准 | 证据 |
|---|---|---|
| 三店目录 | 三店 ID、程序号、shopNumber、NPC ID 和目录条数与上表一致；目录 ID 不重复、价格非负、每条记录 shopNumber 匹配；药店 9 个药水候选完整。 | 目录 JSON、过滤 trace、catalog 单测输出。 |
| 购买 | 购买数量只能为 1；成功后金币精确减少目录 price、背包数量增加 1、对应商品库存移除；余额不足返回 insufficient-gold，不改变金币/背包/库存。 | 购买前后快照、交易 receipt、item 价格来源。 |
| 幂等和库存 | 同一 transactionId、同一商店/商品重放时 applied=false，不重复扣款或发物；换 transactionId 再买已耗尽商品时返回 stock-exhausted；交易 ID 冲突必须拒绝。 | 两次请求的交易结果、金币、数量和 availableItemIdsByShop。 |
| 背包边界 | 最多 28 个不同物品行；第 29 个不同物品行购买被拒；已有物品堆叠不新增行，仍可购买。 | 28 行/29 行边界快照和 inventory-full 结果。 |
| 交易收据边界 | shop runtime 最多保留 128 条 transaction；第 129 条必须拒绝为 receipt-capacity，不得丢弃或覆盖旧收据。 | 128/129 边界测试、SaveV2 JSON。若当前测试未覆盖该边界，列为待补测试，不得仅凭常量存在判通过。 |
| 药水使用 | 恢复量 UNKNOWN 时使用返回 effect-unknown；药水数量仍为 1，HP/MP/maxHP/maxMP 完全不变；战斗中使用返回 in-battle；空背包返回 empty-inventory。 | 使用前后 vitals/背包快照、notice 文案、单测输出。 |
| 存档恢复 | SaveV2 往返后保留金币、背包数量、商店可售库存、transaction receipts 和 vitals。 | 保存前后 JSON、重新加载后的 runtime 快照。 |
| 三店 UI | 三店面板能正确显示目录；120/120/9 条记录可滚动访问，名称/价格/购买目标不串行、不遮挡；选中商品与交易记录一致。 | 三店截图、滚动到首尾的截图、购买 checkpoint。 |

现有 ch1-shop-flow.spec.ts 有 3 个用例：药店购买与 UNKNOWN 使用保护、路线仍为 UNKNOWN 的边界、武器店购买/装备。现有文件没有防具店完整浏览器购买用例；S46 必须增加一个防具店验收步骤（建议用 caosia-armor 的 item 16，价格 100），或明确标记防具店浏览器覆盖未完成（来源：Chat 路 §2.4）。现有 E2E 的 acceptance bridge 购买不等于真实 NPC 路线已打通。

### 2.5 集成回归

| 回归项 | 入口/路径 | 通过标准 | 证据 |
|---|---|---|---|
| 新建角色金币 | web/tests/m4-runtime-integration.test.ts；docs/m7-2-shops-acceptance.md | 新角色/新游戏初始金币恰好 20,000，不是 22,000；不得叠加离线教程的 2,000 银行员奖励。SaveV2 restore/migrate 必须保留已有金币，不重新套用新角色默认值。 | 单测输出、创建/读档前后金币；迁移覆盖 0、2,000、4,321、20,000、22,000。 |
| Quest1 和 NPC 路线 | web/e2e/ch1-npc-quest1-integration.spec.ts | 2 个用例通过；NPC 21003 只在 map 1000 显示；路线 1000→1020→1000 后可见性正确；pointer 与 E 键均能打开 SELECT；记录只到 transient selection，不声称 serverAcceptance、recruitment 或 reward 已实现；SaveV2 不持久化 chapter1Quest1。 | 运行输出、runtime 快照、导出的 SaveV2、pageErrors=0。 |
| M7.3 野外遭遇 | web/e2e/ch1-wild-encounters.spec.ts；docs/validation/m7-3-wild-encounters-acceptance.md | 六条 map 1020 目录记录完整；P6 的 11 项断言全过、5 张截图齐全；Manhattan 距离严格小于 4 且唯一候选才触发；routeLength>0 时野怪触发必须被抑制；失败/撤退无奖励；胜利按重建策略结算 40 金币、100 EXP、item 4002×1；离开 map 1020 再进入刷新，读档/战斗返回不刷新。基线冲突：ch1-wild-encounters.spec.ts:265 仍把胜后余额写死为绝对值 40，而 acceptancePrimeWildGrowth 只注入 EXP、基线新档默认 20,000；验收比较胜前/胜后 +40，冲突须前置处理，不得删掉断言或把出生余额置零（来源：CLI 路 §6，已验实）。 | P6 checkpoint、六条记录表、5 张截图 SHA-256、胜利/失败/撤退/重生快照。 |
| route 040/048 互斥 | 同上 | route 048 的重建 BFS 路径 180 步；经过实体 22022 的第 34 步、实体 22023 的第 63 步；路线移动期间不得插入野怪战斗，路线转换先提交并提前返回。 | 路线 trace、routeLength、map transition 和野怪触发日志。 |
| 全局质量 | typecheck、单测、构建及上述目标 E2E | typecheck exit 0；全量单测 exit 0、失败 0；production build exit 0；每个目标 E2E 的用例、断言、截图数符合各自标准；无未解释 page error。 | 命令原始输出、退出码、测试报告、构建产物摘要、截图与 checkpoint 清单。 |

M7.3 的 E2E 使用 acceptanceSetEnemyHp / acceptanceSetPlayerVitals 等 fixture 快速覆盖野怪触发、奖励、失败和存档路径；它不是 S42 的自然战斗证据，也不能替代 S42 的 20 敌 G0/A09。

## 3. S42 只运行一次的执行方案

### 3.1 批 1 的四项实查发现（必须进入最终执行记录）

1. **Story 战斗配置可能被清空。** 当前代码中，prepareReconstructionBattle 的非 M5 world 分支会把 reconstruction battle setup 设为 undefined；Story gate 路径直接进入战斗。web/src/battle.ts 的 beginBattle 在没有 setup 时会生成 dummy-melee 与 dummy-ranged 两个训练占位敌人。因此，进入战斗画面或最终 phase=won，都不能证明实际运行了 20 敌首战。行号：web/src/m4-runtime-integration.ts:548 战斗适配器走通用准备路径，:1807 非 M5 分支清空 setup；web/src/battle.ts:184 无 setup 分支生成 dummy-melee/dummy-ranged，各 90 HP（来源：CLI 路 §3，已验实）。
2. **现有 A09 没有阵容门禁。** web/e2e/s42-ch1-end-to-end-acceptance.spec.ts 当前 A09 的胜利/行动/玩家存活断言，没有明确核对 20 个敌人的来源 ID、数量和逐只 HP。G0 必须补在第一次玩家行动之前，成为阻断条件。
3. **金币基线不可直接比较。** 当前 main 新建角色初始金币为 20,000；历史失败记录为 0。SaveV2 restore/migrate 保留已有金币，故历史记录可能来自不同存档来源/版本。必须记录历史失败记录和最终候选的 commit、SaveV2 版本、存档来源、新建/旧档属性和战前金币；没有同源依据，不得把 0 与 20,000 直接解释为战斗结果差异。
4. **Story source 1 不发战斗奖励。** S42 规格的 Story source 1 rewardSettlement 为 not-applied，金币和 EXP 不变。因此 0 金币、0 EXP 本身是预期边界，不能作为“玩家被打死”或“成长链是根因”的证据。

### 3.2 G0 同战斗身份门禁

G0 必须在 S42 唯一一次运行中、进入 battle view 后、第一次玩家行动之前完成。至少记录：

- 本次候选 commit SHA、Playwright run ID、测试用例 ID；同一 run ID 必须贯穿入口快照、战斗日志、胜利/失败快照和截图。
- SaveV2 schema/version、存档来源（新建角色或导入旧档）、角色 ID、等级、战前金币、EXP、属性点、装备和背包摘要。
- Story 身份：sourceId=story-source-1、fieldMapId=1030、gateCell=(72,30)、battleZoneId=1、battle scene mapId=1；保留 runtime 原始 provenance、authority、runtimeVerified 字段。
- 敌方 roster signature：总数 20；1001×16、1003×3、1010×1；逐只记录来源 ID、runtime entity ID、HP/maxHP、位置和 encounterGroup；逐只 HP 与原表相符，总 HP=2050。
- 记录每只怪物 abilities 为空；AI 来源明确标 RECONSTRUCTION_POLICY。波次/encounterGroup 的分组总数必须等于 20，不能重复、漏怪或在战斗中静默换阵容。
- 将最终运行的遭遇身份与 2026-11-13 A09 历史失败记录逐项对照。commit 可以不同，但故事来源、地图/入口、战斗区、敌方 roster 和 HP 必须是同一遭遇定义；历史记录的存档来源也必须可追溯。若历史 artifact 不足以证明可比性，标记 G0_HISTORICAL_COMPARABILITY_UNKNOWN，不得声称“同一场战斗”。

G0 失败条件：只出现两个训练占位敌人；出现 dummy-melee/dummy-ranged；不是 20 敌；ID 计数或 HP 不符；总 HP 不为 2050；缺少来源 ID/HP 映射；Story source、地图、入口或 battleZone 不一致；存档来源不可追溯且影响比较。任一发生，立即停止，不执行 A09 玩家战斗动作，标记 BLOCKED_G0。

### 3.3 前置条件

以下条件必须全部满足，才允许启动唯一一次 S42：

1. S46 候选 commit 已冻结，分支/commit SHA、工作树状态、资源清单和 SaveV2 基线已记录；候选版本在 S42 运行后不得再改动。
2. typecheck、全量单测、production build 均通过；S43、S44、S45 和第 2.5 节集成回归全部通过。
3. DEX/REG 已完成可测量的证据记录，或已由卫勒明确接受 UNKNOWN 的范围处理；未获接受时，S46 不得宣告完整通过。
4. G0 有可审计的入口快照和阻断能力。若当前 spec 不能在第一行动前读取并判定 roster，先在后续 S46 实施阶段补门禁；本方案不授权本轮改代码。
5. S42 所需 map 1000、1020、1030、1060 的 PNG 与 collision JSON 成对存在；资源索引不得是 SYNTHETIC。当前 spec 所需的 B4524_00.ani/.spr 也必须在资源清单中明确记录，但其存在不证明 B4524 的零售身份。浏览器使用网页资源包，不启动原版客户端。若资源缺失或测试被 skip，记 NOT_RUN/BLOCKED_ENVIRONMENT，不算通过。
6. 最终 S42 使用新建角色时，战前金币应为 20,000；若经批准使用旧档，必须记录实际值及来源，不得套用新建角色默认值。
7. 正式运行前须在同构建、同配置的生产入口做只读入战预检（0 个玩家行动），取得 map1030 → zone 1、玩家格及每敌 ID/HP/初始格/组别、技能和 AI binding、玩家职业/等级/EXP/六维/已分配/技能可用性/装备/HP/MP、实际 damagePolicy 与 combatPlayerStats、行动槽上限与成本；无可核证绑定即 BLOCKED，正式 S42 运行次数仍为 0。预检与正式运行使用隔离 runner；选定端口若被占用则启动前阻断（来源：CLI 路 §3）。

### 3.4 执行顺序

1. 冻结候选版本和 B0 基线，先完成第 2 节全部非 S42 检查。
2. 启动一次 web/e2e/s42-ch1-end-to-end-acceptance.spec.ts。不要单独再运行 web/e2e/s42-ch1-story-gate-entry.spec.ts 或其他 S42 专项来替代/重复本次综合验收。
3. 按 A01–A08 的实际地图和剧情路径进入 Story source 1。
4. 在 battle view 出现后立即执行 G0；保存入口快照。G0 通过才允许继续；G0 失败立即停止，不执行任何战斗动作。
5. G0 通过后按 A09 实际玩家行动战斗，不修改玩家/敌人 HP，不强制胜利，不调用设置敌方 HP 的 fixture。最多 40 个玩家行动；行动槽等待沿用每次最多 40 个模拟步、12,000ms 的边界。
6. 胜利后核对 A10 的不发奖励和返回 map 1060 (20,120)，再完成 A11 的 checkpoint 与截图采集。
7. 立即冻结本次输出；不再重跑 S42，不以重跑后的通过结果覆盖第一次失败。

正式运行使用 S42_TESTED_COMMIT_SHA 指定冻结的实际 SHA，命令为 `npm run test:e2e -- e2e/s42-ch1-end-to-end-acceptance.spec.ts --workers=1 --retries=0 --repeat-each=1`（来源：CLI 路 §3）。

### 3.5 失败停止和记录

- 前置条件未满足：不启动 S42，标记 STOPPED_BY_PREREQUISITE；S42 仍为 NOT_RUN。
- 已启动但 G0 不通过：停止在第一行动之前，标记 BLOCKED_G0；本候选的唯一 S42 机会已消耗，不重跑。
- G0 通过但 A09 战斗失败：标记 FAIL_S42_A09，保存最后状态、行动日志、HP 曲线、剩余敌人数和所有截图；不重跑刷过。
- A10/A11 失败：保留战斗结果，按具体断言标记 FAIL_S42_POST_BATTLE 或 FAIL_S42_EVIDENCE；不重跑。
- 测试 skip、资源缺失、浏览器环境中断：标记 NOT_RUN 或 BLOCKED_ENVIRONMENT，不得写 PASS；不得通过更换合成资源后把它改成真实资源验收。
- 本次之后若代码或候选 commit 改变，原 S42 证据不再代表新候选；不得自动重跑，须由卫勒重新决定后续验收策略。

### 3.6 B0 与成长链/分波受控诊断边界

B0 定义为：同一个冻结候选 commit 下的新建 SaveV2 角色；记录角色职业/ID、Lv1 progression、六维自动成长值、未分配属性点、默认装备和背包、初始金币 20,000、地图起点、随机种子、Story source 1 入口以及完整 20 敌 roster。B0 的默认装备/背包内容须从实际新建快照读取，不在本方案编造。每次实验均从新鲜 B0 复位，不沿用上一实验的存档或战斗状态。

S42 唯一 E2E 之前，若要判断成长链/分波是否足以改善首战，只能使用独立、可复位的受控实验，不得重复运行 S42 E2E：

- 固定原表 HP：1001=100、1003=100、1010=150；不得切换到离线包 13/13/19。
- G 实验只改变玩家成长链变量；敌人 HP、敌人数量、AI 和波次不变。
- W 实验只改变 encounterGroup/波次安排；玩家成长、装备、敌人总数和每只 HP 不变。各波数量之和必须为 20；具体波数、每波数量和释放时机目前没有足够依据，必须在实验前由设计/卫勒批准并记录，不能在本方案里编造。
- 若另做 G+W 组合实验，也必须从全新 B0 开始，不能沿用 G 或 W 实验已经改变的存档。
- 结论只写“在本次固定 HP、固定阵容和指定配置下，成长链/分波是否足以使战斗通过”；不得写成“已证明唯一根因”或“已证明原版公式”。
- 每个实验都保存变量清单、B0 快照、唯一变量差异、完整结果和退出状态。

（本节 B0/G/W 受控实验设计来源：Chat 路 §3.6。）

## 4. DEX/REG 实测方案

当前 web/src/progression/attribute-stat-policy.ts 明确只把 STR、CON、INT、WIS 映射到战斗属性；DEX/REG 暂不进入战斗数值，直到 S46 有证据。现有代码返回 DEX/REG 零贡献，只能证明当前重建策略如此，不能证明原版零售效果为零。

**受控方法：**

1. 冻结同一角色、等级、自动成长、装备、背包、HP/MP、战斗区、目标、行动序列和随机种子，保存 B0。
2. DEX 单变量实验：从 B0 派生一份状态，只增加 1 点 DEX；与 B0 对照。
3. 完全重置 B0 后做 REG 单变量实验：只增加 1 点 REG；不得把 DEX 和 REG 一起加点。
4. 对照两组的所有实际暴露字段：CombatantStats 的 maxHp、maxMp、attack、defense、magicAttack、magicDefense；以及运行时确实暴露的命中/闪避/暴击/行动准备度/恢复事件等字段。字段不存在或没有可观察事件时，明确记录 NOT_EXPOSED，不得自行补造字段。
5. 每个字段记录 before、after、delta、随机种子、输入状态 SHA 和原始事件日志。若变化只来自当前重建代码，标记为 IMPLEMENTATION_OBSERVATION，不升级为零售事实。
6. 若发现稳定、可重复且有独立来源支持的非零变化，记录候选映射和证据，交卫勒批准；本方案不授权直接改 attribute-stat-policy.ts。
7. 若可观测字段均无变化，只能记 NO_EFFECT_OBSERVED_IN_TESTED_FIELDS；不能写“DEX/REG 已证明无效”，策略仍保持未映射/UNKNOWN。
8. 若缺少可观察字段、独立来源或可复现输入，记 UNKNOWN_NOT_MEASURABLE。由于 DEX/REG 是 S46 明确的证据门，未获卫勒接受范围豁免前，UNKNOWN_NOT_MEASURABLE 阻止 S46 完整 PASS。

另用 STR +1 的物攻/物防各 +1 作正对照；在相同实战读取位置看不到正对照时，该观察位置判 BLOCKED（来源：CLI 路 §4）。

## 5. 已知未验证项

| 未验证项 | 当前状态 | 是否阻挡本方案 S46 | 边界 |
|---|---|---|---|
| 药水 HP/MP 恢复量 | UNKNOWN；catalog 的 restoreAmount=null，使用返回 effect-unknown。 | 不阻挡安全购买/存档验收；阻挡任何“药水恢复量已恢复/使用已打通”的结论。 | 购买数量、金币、库存和 UNKNOWN 使用保护必须通过；不得编造恢复量。 |
| 店主 B4524 替身贴图 | 视觉代理，零售 NPC 身份/模型映射未验证。 | 不阻挡商店运行时交易逻辑；若卫勒要求 S46 同时验收原版视觉身份，则阻挡该视觉子项。 | 只记录代理资源和截图，不声称 B4524 就是原版店主。 |
| 店主对话占位“欢迎。” | 文案真实性 UNKNOWN。 | 不阻挡通过 acceptance bridge 验收购买逻辑；阻挡真实 NPC 对话内容验收。 | 不把占位文案当作原版台词。 |
| 商店列表排版 | 完整视觉排版尚未形成独立验收证据。 | 若所有目录可滚动访问、无裁切/遮挡且可选购，不阻挡；若商品行不可见、价格/按钮重叠或无法选中，则阻挡 UI 验收。 | 需保留三店首尾滚动截图和购买截图。 |
| 三店真实 NPC 路线 | reachability=UNKNOWN、runtimeEnabled=false。 | 不阻挡本方案定义的隔离商店运行时验收；若范围改为“玩家从地图真实走到店主并开店”，则阻挡。 | 不能把 acceptanceOpenShop bridge 当成地图路线已打通。 |
| 怪物 4001/4006 视觉绑定 | 当前没有可确认的零售视觉绑定；允许明确标记的重建 fallback。 | 不阻挡阵容 ID/HP/战斗逻辑验收；阻挡原版怪物美术还原结论。 | 视觉 fallback 只能标 RECONSTRUCTION_POLICY。 |
| DEX/REG 战斗影响 | 当前未映射，真实效果 UNKNOWN。 | 阻挡 S46 完整 PASS，除非卫勒明确接受 UNKNOWN 的范围豁免。 | 按第 4 节测量，不从当前零贡献代码反推零售事实。 |
| S42 波次数量/时机 | 未给出足够证据。 | 若最终战斗采用分波，具体波次必须在 S42 前冻结；未冻结则阻挡 G0/最终运行。 | 只要求总数 20、无重复/漏怪；不在本方案编造分波数字。 |
| 胜利回场 HP/MP 语义 | 原版应否补满 UNKNOWN。 | 本身不挡；记录胜利瞬间和返回后实际 HP/MP；若网页无明确一致规则、可重复利用回场异常回血或合法后续操作受阻，交总管裁决后放行（来源：CLI 路 §5）。 | 历史疑点见前述阵容验收分支记录。 |
| 首战历史 AI 与野怪原版刷新节奏 | 原版细节 UNKNOWN。 | 不挡原版细节未知；重构 AI 实际运行、分波不删怪、网页野怪重生及属性隔离仍须验（来源：CLI 路 §5）。 |  |

## 6. 风险与未知项

1. **最高风险：Story source 1 可能未传入 20 敌 setup。** 当前 beginBattle 在 setup 缺失时有两个训练占位敌人的 fallback；这是 S42 G0 的硬阻断项，不是可以在报告里轻描淡写的视觉问题。
2. **A09 现有断言不足。** phase=won、行动数和玩家存活不能单独证明打的是 20 敌首战；必须先核对 G0 的 roster signature。
3. **历史 A09 的存档来源待核。** 历史失败金币 0 与当前新建角色 20,000 不同；若无法追溯历史 SaveV2 和 commit，不得把两次结果当成严格同条件对照。
4. **首战没有奖励结算。** Story source 1 rewardSettlement=not-applied；0 金币/EXP 是预期行为，不能作为战斗根因证据。
5. **战斗数值和 AI 仍是重建策略。** 20 敌原表 HP 固定；其他攻击、防御、行动、AI 和波次规则若无来源，必须标 RECONSTRUCTION_POLICY 或 UNKNOWN。
6. **原版服务端边界未恢复。** M6 转职触发、成长公式、命中/闪避/暴击/伤害、装备最终资格等服务端语义不能因网页测试通过而升级为零售 VERIFIED。
7. **S45 浏览器覆盖有缺口。** 当前 ch1-shop-flow.spec.ts 未覆盖防具店购买；商店路线仍关闭，三店 UI 排版尚需独立截图验收。
8. **合成 E2E 证据有边界。** 合成地图/角色截图只证明重建逻辑在合成 fixture 下运行，不证明原版地图/美术；私有派生资源的使用也不等于运行了原版客户端。
9. **S42 只允许一次。** 一次失败、G0 阻断、环境 skip 或证据缺失都必须如实保留；不得重跑覆盖第一次结果。
10. **转职基线冲突。** 简报要求 6/16/26 级自动转职，但基线 s29-m6-integration.spec.ts 在阈值点击 m6-promote（:21/:50/:79），S43 E2E 到 Lv6 还断言原职业 ID 100/109；基线不能以“按钮可点”交自动转职，正式候选须在一次性验收前消解冲突并重新对齐 S43 检查点（来源：CLI 路 §6，已验实）。
11. **野怪胜后金币绝对值冲突。** ch1-wild-encounters.spec.ts:265 仍把胜后余额写死为绝对值 40，而 acceptancePrimeWildGrowth 只注入 EXP、基线新档默认 20,000；验收比较胜前/胜后 +40，冲突须前置处理，不得删掉断言或把出生余额置零（来源：CLI 路 §6，已验实）。
12. **药店 103/105 口径差。** itemtbl 实际 shopNumber=3 的原始记录为 103 项，不是 105；105 口径为 103 项消耗品 + 2 件采矿工具；以 105 为分母约 1.90%，属实质口径差；实际验收按 9 个红蓝药目录候选（来源：CLI 路 §6，已验实）。
13. **首战合法入场配置尚无证据。** 首战实际可行的合法成长路线、目标等级、配装、波次数量、验收所需行动裕量尚无证据，不预填；若批准分波，也需先确认最初候选用同一战斗身份和同一 HP 口径（来源：CLI 路 §6）。

### S46 总体判定建议

- PASS：五组验收全部达到数字标准；G0 通过；DEX/REG 有可审计测量结果或卫勒明确批准了 UNKNOWN 豁免；无未关闭阻断项；证据包完整。
- PASS_WITH_KNOWN_LIMITS：所有纳入范围的功能通过，且剩余 UNKNOWN 均属于第 5 节明确列出的非阻断项；报告不得扩大结论。
- BLOCKED_G0：首战身份/20 敌 roster/HP/历史可比性任一无法证明。
- BLOCKED_DEX_REG：DEX/REG 无法测量且没有卫勒的范围豁免。
- FAIL：任一已纳入的功能验收未通过，或出现数据丢失、重复奖励、错误扣款、存档不一致、战斗状态错误等实质缺陷。
- NOT_RUN：前置条件未满足或环境导致未执行；不得写 PASS。

（本节六档判定量表来源：Chat 路 §6。）

最终执行报告必须附：分支与候选 commit SHA、各测试命令原始输出/退出码、G0 和 A01–A11 结果、SaveV2 前后差异、截图及 SHA-256、所有 UNKNOWN 与阻断项，并以以下五项结束：

1. **复用了什么**：两路产出（Chat 路方案与 CLI 路方案）及 main 上已有的 S42、S43、S44、S45 验收文档、源码与测试，批 1 的 G0 门禁和四项实查结论。
2. **改动量**：0 代码、1 文档草稿（本合并草稿）；未改任何仓库文件。
3. **跳过/未检查**：未运行测试、typecheck、build、E2E；未运行原客户端；未执行部署；未复核原始私有文件字节或原版单机流程。
4. **风险**：G0 阵容配置仍是关键阻断项；转职按钮、金币绝对值两处基线冲突须前置消解；DEX/REG 仍待实测；防具店浏览器 E2E 覆盖不足；首战合法入场配置尚无证据。
5. **捷径账本**：只使用两路已交付的方案文档与只读历史记录合并；未使用 Remote Desktop，未操作用户笔记本；未修改 main；未创建 PR、未合并；未花钱、未公开部署、未将 ybcs 标记为 VERIFIED。

本文件是验收方案合并草稿，不执行代码修改、测试、原客户端、公开部署或任何付费操作。
