# M7.3 第一章野外遭遇 P0 前置核对记录

- request-id：`ch1-m73-wild-20261114-01`
- 仓库：`vileosbot-bot/lapis-rebuild`
- 执行分支：`feat/ch1-m73-wild-encounters`
- 基线：`0155c439ee9fde157ae700da9fbcabdca484abb5`
- 状态：P0 部分完成；地图碰撞资源缺失，P0 gate 暂停。未进入 P1，不含运行时代码。

## 1. 权限、基线与分支

- GitHub 登录账号读回：`vileosbot-bot`。
- 仓库权限：Admin。
- main HEAD 读回：`0155c439ee9fde157ae700da9fbcabdca484abb5`，与审批基线一致。
- 新分支 `feat/ch1-m73-wild-encounters` 已从该完整 SHA 创建。
- 没有修改 main、创建 PR、合并或访问 `ViLeo06/lapis-rebuild`。

## 2. 已核对的探索数据

探索报告：
- 分支：`docs/ch1-wild-monster-explore-20261113`
- HEAD：`e336e0f2`（任务输入）
- 文件：`docs/research/ch1-wild-monster-exploration.md`
- Git blob：`7a2a144df5f56f35a4d72bbcb86c4f89ad8e0e7c`

map 1020 六条放置数据逐项读回：

| Entity ID | 放置名称 | Model ID | xy | approach | HP/MP | Gold/EXP | Drop |
|---:|---|---:|---|---|---:|---:|---|
| 22020 | 普罗首领B | 4006 | (4,144) | (3,143) | 150/100 | 40/150 | item 4002 |
| 22720 | 雷德普罗 | 4001 | (12,142) | (11,141) | 100/100 | 40/100 | item 4002 |
| 22721 | 普罗首领B | 4006 | (37,153) | (36,152) | 150/100 | 40/150 | item 4002 |
| 22022 | 雷德普罗 | 4001 | (37,139) | (36,138) | 100/100 | 40/100 | item 4002 |
| 22023 | 普罗首领B | 4006 | (54,130) | (53,129) | 150/100 | 40/150 | item 4002 |
| 22024 | 雷德普罗 | 4001 | (49,121) | (48,120) | 100/100 | 40/100 | item 4002 |

六条记录均只标记 `RECOVERED_SECONDARY`；本表不表示原版零售服务端事实。

## 3. 已核对的现有运行时基础

- `web/src/world/ch1-world-policy.ts` 已含 CH1 地图 1000、1020、1030、1060。
- route 040 为 1000→1020；route 048 为 1020→1030。
- `web/src/m4-runtime-integration.ts` 当前 `onSnapshot()` 先处理空间路线切换，再处理剧情 gate；野怪接入应排在这些处理之后，并显式要求 route 完成、routeLength 为 0。
- `web/src/scene.ts` 的 `enterBattle()`、`applyBattleEntry()` 可复用；`web/src/battle.ts` 的 `ReconstructionBattleSetup` 可传入敌人数组。
- `trainingAiBinding()` 明确返回 `RECONSTRUCTION_POLICY` 默认 AI。
- `web/src/progression/rewards.ts` 的 `applyBattleReward()` 可发金币、物品、EXP，并使用 receipt 防重。
- `web/src/progression/attribute-points.ts` 与 M7.2 的 `reconcileM7Attributes()` 可复用升级属性点逻辑。
- `SaveV2.quest` 当前保存 `ch1ShopState`，可为野外状态增加独立 `ch1WildState` 命名空间；本轮尚未改存档结构。

## 4. item 4002 核对

从 main 的 `data/shops/ch1-shop-catalog.json` 读回：
- itemResourceId：4002
- 名称：便宜药草
- graphicId：1701
- 描述：到处都能获得的药草(生命力少量恢复)
- shopNumber：3
- sourceRecord lineNumber：1803
- evidenceLevel：`RECOVERED_SECONDARY`
- runtimeVerified：false

因此本次奖励可以引用既有 item 4002 物品身份；药草掉落 100%/每次 1 个仍是 D1 的 `RECONSTRUCTION_POLICY)，不属于 itemtbl 证据。

## 5. 地图资源与碰撞核验阻塞

P0 要求核对 map 1020 资源、地图边界和六个 approach 坐标是否可行走。当前 bot main 仓库树中没有可读的 `web/public/game-data/maps/map-1020.png` 或 `map-1020-collision.json`；`web/public/game-data/asset-index.json` 也不在已提交树中。当前会话没有可用的已派生私有地图包附件；容器网络无法解析 github.com，不能从仓库克隆取得本地副本。

因此以下项目均为 **未核验**，不能写成通过：
- map 1020 实际宽高及六个实体坐标是否在界内；
- 六个 approach 坐标是否 walkable；
- 六条放置坐标是否可落点；
- route 048 穿越六个野怪附近时的真实碰撞路径。

没有根据坐标数值或合成网格推断原地图 walkability，也没有自行移动坐标。按 P0 停止门，不进入 P1。

恢复 P0 所需材料：此前已派生的私有 Web 资源包，至少包含 map 1000/1020/1030/1060 的 PNG 与 collision JSON，以及 asset-index。可直接提供资源包附件；不需要运行原版客户端。

## 6. 模型与视觉资源边界

- 当前 S17 `monster-visual-catalog.ts` 仅有已人工审阅的视觉资源 4524、4525、4526、4544；没有 4001/4006 的可确认视觉绑定。
- 不把旧 model ID 数值相同或相近作为视觉绑定证据。
- 按 D7，4001/4006 没有可用动画时采用明确标记的重建 fallback（文本/占位外观），`RECONSTRUCTION_POLICY`。
- 本次没有检查或执行任何原版客户端。

## 7. 证据等级冻结

| 事项 | 标签 |
|---|---|
| 六条 map 1020 放置字段 | `RECOVERED_SECONDARY` |
| item 4002 静态物品身份 | `RECOVERED_SECONDARY` |
| Manhattan <4、唯一候选触发 | `RECONSTRUCTION_POLICY` |
| route 040/048 行走互斥 | `RECONSTRUCTION_POLICY` |
| 无技能、默认 AI | `RECONSTRUCTION_POLICY` |
| 独立野外奖励、100% 一份 item 4002、receipt 幂等 | `RECONSTRUCTION_POLICY` |
| battleZone 1020 fallback | `RECONSTRUCTION_POLICY` |
| 离图再入刷新 | `RECONSTRUCTION_POLICY` |
| 原版刷新节奏、掉落概率、原版 map→battleZone、map 1020 章节归属 | `UNKNOWN` |

ybcs 内容不会标记为 `VERIFIED`。

## 8. P0 结论

P0 已完成账号/仓库/基线/分支、探索报告、六条数据、路线结构、item 4002 和现有代码接入点核对。P0 尚未通过的关键 gate 是缺少真实 map 1020 collision JSON，无法证明 approach 坐标可行走。

**停止位置：P0；未进入 P1；没有运行时代码修改。**
