# M7.2 / S45 第一章三店运行时集成

- Request: `ch1-attr-s45-20261113-01`
- Branch: `feat/ch1-s45-shops`
- Scope: Program 13 武器店、Program 14 防具店、Program 15 药店；购买闭环，不做出售。
- Provenance: 商品与 program/map/NPC 对应关系均为 `RECOVERED_SECONDARY`；运行时库存、交易幂等与交互规则为 `RECONSTRUCTION_POLICY`。

## Catalog

统一目录 `data/shops/ch1-shop-catalog.json`。武器店 120 项、防具店 120 项、药店 9 项。各店按 shop number → 非负价格 → NPC 专属过滤 → itemtbl 源行排序 → 120 项上限处理。有限库存为每条目录商品一份可售 token；购买数量暂限制 1，因为原始库存数量未恢复。背包上限按 28 个不同物品行实施。

S4 消耗品原始 shopNumber=3 记录实际为 103 项；目录只从中选取 9 个可确认红/蓝药候选，不把 105 项描述误当作 shopNumber=3 记录数。探索报告中的 105 = 103 项消耗品 + 2 件采矿工具；两件采矿工具不属于药店库存，因此不进入药店目录。两种统计口径不同，不是数据丢失。

## Potion effect boundary

9 个药品的 `itemtbl numericColumns[18]` 是效果引用 ID，不是 HP/MP 恢复数值。九项恢复量全部 UNKNOWN；不猜测 effectRef 与数值的对应关系。使用未知恢复量的药品时，运行时拒绝使用，药品数量、HP、MP 均不改变；UI 显示拒绝原因。战斗中使用药品不支持。

## Route and NPC boundary

三店 map interiors 分别为 2000/2100/2300，NPC 分别为 21200/21210/21230。路线均未验证，authority 保持 `runtimeEnabled=false`。不向第一章世界图接入 NPC，不声称真实地图可达。自动化 acceptance bridge 只用于隔离验证目录/交易逻辑，不模拟或冒充真实路线。

NPC 21200 的 Quest2 与 shop intent 必须是独立选择；NPC 21230 的 Quest9（商人 5018 单次圣药提供）与 shop intent 也必须独立。Quest9 的单次性由原任务领取/奖励回执语义约束；商店入口不能改变 Quest9 状态或重复发放圣药。

## SaveV2

商店有限库存与交易回执保存在现有 `SaveV2.quest.ch1ShopState` 命名空间，不新增顶层版本字段。金币和物品仍写入 SaveV2 原有 `gold` 与 `inventory`。恢复存档时验证并还原商店状态。

## Verification

- `cd web && npm run typecheck`
- `cd web && npm test`
- `cd web && npm run build`
- `cd web && npm run test:e2e -- e2e/ch1-shop-flow.spec.ts` (240 seconds per test)

本沙箱 npm registry / github.com DNS 不可用时，命令状态必须记为 NOT_RUN，不得报告 PASS。
