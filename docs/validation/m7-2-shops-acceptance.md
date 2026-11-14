# S45 三店运行时验收与证据

- Request: `ch1-attr-s45-20261113-01`
- Branch: `feat/ch1-s45-shops`
- Status: implementation candidate; runtime verification pending.
- Evidence labels remain RECOVERED_SECONDARY / RECONSTRUCTION_POLICY; no YBCS VERIFIED promotion.

## Route UNKNOWN 清单

三家店的入口和第一章可达性均 UNKNOWN，runtimeEnabled=false，不接入第一章主流程。真实地图 E2E 的“从第一章路线到达 NPC”状态为 **NOT_VERIFIED**。缺少：
1. 从第一章道路到商店入口的准确接近坐标（approach cells）。
2. 商店内部出生点在实际客户端与地图资源中的验证。
3. 门标记/传送路线展开、可行走性与双向对齐验证。
4. 路线到达 NPC 位置与 NPC 实体资源的验证。
不能用 acceptance bridge、直接切地图或固定坐标替代真实路线证据。

## Source count reconciliation

itemtbl 实际 shopNumber=3 原始记录为 103，不是 105。探索报告的 105 口径为 103 项消耗品 + 2 件采矿工具；采矿工具不属于药店商品，不进入 Program 15 目录。S45 目录仅含 9 个有来源支持的红/蓝药候选，绝不补造缺失记录。

## Potion recovery UNKNOWN

九项药品恢复量全部 UNKNOWN。numericColumns[18] 是 effectRef 而非恢复数值；不推断引用 ID 到 HP/MP 数值的映射。UNKNOWN 时点击使用会得到可见拒绝提示，药品数量与 HP/MP 状态保持不变。此项替代本阶段“使用后 HP 上升”验收；待原始效果数值证据恢复后再做真实恢复验收。战斗中使用药品 NOT_SUPPORTED。

## NPC 双 intent 保护

- NPC 21200 / Program 13：商店入口与 Quest2（Davis / actor 101 同伴招募）是独立对话意图；Quest2 接取/进度/交付触发不得被商店选项覆盖。
- NPC 21230 / Program 15：商店入口与 Quest9（商人 5018 的单次圣药提供）是独立对话意图；Quest9 仅在其既有任务触发条件满足时提供一次，完成/领取回执后不得重复发放。商店购买不得写入 Quest9 状态或重置其单次回执。
- NPC 21210 / Program 14：本批仅商店意图。

## Executable scope

可通过 automation-only acceptance entry 隔离验证商品目录、价格、购买、有限库存、金币扣减、背包增加、SaveV2 持久化以及 UNKNOWN 药品拒绝保护。该入口不是 NPC 交互或地图路线证据。

| 验收项 | 状态 |
|---|---|
| 三店目录加载、过滤顺序、唯一 ID、每店 <=120 | TEST_DEFINED |
| 购买扣价、背包增加、有限库存、幂等 | TEST_DEFINED |
| SaveV2 保存/恢复 shop state | TEST_DEFINED |
| 药品恢复量 UNKNOWN 拒绝使用、不扣药、不改 HP/MP | TEST_DEFINED |
| 空背包药品不可使用 | TEST_DEFINED |
| 战斗中药品不可使用 | TEST_DEFINED |
| 从真实第一章路线到达三店 NPC | NOT_VERIFIED（路线未确认） |
| 红药使用后 HP 上升 | NOT_VERIFIED（恢复量 UNKNOWN） |
| Quest2 / Quest9 真实 NPC 双 intent E2E | NOT_VERIFIED（NPC/路线未接入；纯对话状态机测试另行覆盖） |
| typecheck / unit / build / browser E2E | NOT_RUN，需有网络的授权 runner 执行 |

## Screenshots and checkpoints

真实地图截图与交易 checkpoint 当前未生成。不得填写虚构文件路径、SHA-256 或字节数。验收 runner 应输出：
- shop-weapon-catalog.png
- shop-purchase-confirmed.png
- shop-inventory-after-purchase.png
- shop-quest2-intent.png
- shop-potion-use.png
并为每张截图记录 SHA-256、字节数、NPC/map/item IDs、交易 checkpoint。若只执行隔离 acceptance entry，必须在 checkpoint 中明确标注 `routeEvidence=NOT_VERIFIED`。

## Commands

- `cd web && npm run typecheck`
- `cd web && npm test`
- `cd web && npm run build`
- `cd web && npm run test:e2e -- e2e/ch1-shop-flow.spec.ts` (240 seconds per test)

No S42 run is authorized in S45.
