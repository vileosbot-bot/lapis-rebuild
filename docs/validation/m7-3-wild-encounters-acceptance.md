# M7.3 第一章野外遭遇验收计划

- request-id：`ch1-m73-wild-20261114-01`
- 分支：`feat/ch1-m73-wild-encounters`
- 状态：M7.3 运行时实现已提交；本轮 E2E/CI 收尾修复已移植并读回。总管提供的本地第 9 次验收为 P6 11/11、截图 5/5、胜利金币 40 到账；S45 商店 E2E 回归 3/3（标准 fixture）通过。本轮没有重新运行浏览器 E2E 或原版客户端；GitHub push 自动触发的合成 CI 结果单独记录，不冒充总管本地结果。
- 证据标签：所有规则性决策均为 `RECONSTRUCTION_POLICY`，YBCS 放置数据为 `RECOVERED_SECONDARY`，原版未知项为 `UNKNOWN`。

## 1. P0 gate

- [x] GitHub 账号为 vileosbot-bot。
- [x] main 基线为 0155c439ee9fde157ae700da9fbcabdca484abb5。
- [x] 分支 feat/ch1-m73-wild-encounters 从指定基线创建。
- [x] 探索报告与六条 map 1020 数据读回。
- [x] route 040/048 现有路由定义读回。
- [x] item 4002 便宜药草元数据读回。
- [x] 原始 ybcs-offline.zip 大小 192,893,156 bytes、SHA-256 与 README 完全匹配。
- [x] map 1000/1020/1030/1060 的 IMF/SMF/MMF 已抽取并静态解析，地图尺寸与 route 记录已读回。
- [x] 六个实体坐标位于 map 1020 边界内，且 IMF grid value=1。
- [x] 六个 approach 坐标均在边界内，且 IMF grid value=1。
- [x] route 040/048 activation cells 与 map collision 已交叉核对；route 048 的重建 BFS 路径与实体 22022、22023 坐标相交，必须落实 D4 抑制规则。

P0 坐标核验使用从原始 IMF 静态派生的 collision JSON，不使用 synthetic grid。地图 PNG 尚未生成，列为 P6 E2E/截图 fixture 准备项；不得公开部署原版资源。

## 2. 已批准策略及路由互斥要求

- 距离：Manhattan distance 严格小于 4。
- 触发：有效候选恰好 1 条；0 条或多条均不触发。
- 触发时机：移动路线完成后；不在 routeLength 大于 0 时触发。
- route 040/048：路线移动期间野怪触发必须被抑制；具体实现为 routeLength>0 时完全跳过野怪 authority，且 onSnapshot 先处理 handleChapter1Spatial；路线转换处理优先于野怪检查，抵达路线目标后提前返回，不得插入野怪战斗。route 048 路径从 (3,173) 到最近可达激活格 (67,13) 的 BFS 计算为 180 步，经过实体 22022 (37,139) 与 22023 (54,130)，因此该互斥是硬性验收项。
- 只有玩家在 map 1020 完成普通移动、routeLength 归零且路线转换未提交时，才检查野怪候选。
- 一条野外目录记录对应一名战斗敌人（D2，`RECONSTRUCTION_POLICY`）。
- 野怪战斗使用 BattleEntry / ReconstructionBattleSetup；battleZone 1020 是重建 fallback（D3，`RECONSTRUCTION_POLICY`）。
- 怪物无技能，AI 使用现有重建默认 AI（`RECONSTRUCTION_POLICY`）。
- 除目录明确给出的 HP/MP 外，其他战斗属性使用现有默认重建战斗模型；不把 YBCS basic/enemy=10/8 解释为攻击/防御数值（D8，`RECONSTRUCTION_POLICY`）。
- 胜利独立结算金币、EXP、100% 掉落 1 个 item 4002，并使用 generation/entity 唯一 receipt。
- 失败/撤退不结算奖励；离开触发范围后可再挑战。
- 离开 map 1020 再进入时刷新；战斗返回与读档不刷新。
- map 1020 章节归属、零售战斗区、零售掉落概率和零售刷新节奏继续 UNKNOWN。

## 3. P6 的 11 行验收范围

| 验收类别 | 主要检查 |
|---|---|
| 数据 | 六条野怪完整性 |
| 触发 | Manhattan 小于 4、唯一候选 |
| 战斗 | 入口、敌人数量、HP/MP、AI、无技能 |
| 胜利 | 金币、EXP、药草 |
| 幂等 | 重复结算不重复发放 |
| 失败 | 不结算奖励 |
| 撤退 | 不结算奖励、离开范围后可再挑战 |
| 成长 | EXP、升级、属性点、技能点 |
| 存档 | 保存、读档、状态恢复 |
| 重生 | 地图重新进入后刷新 |
| UI | HUD、战斗画面、奖励结果 |

另设 route 040/048 行走互斥专项断言：行走期间不进入战斗，路线到达后完成场景切换。

## 4. P6 E2E fixture 双模式

E2E 文件：`web/e2e/ch1-wild-encounters.spec.ts`。测试要求 map 1000、1020、1030、1060 的 PNG 与 collision JSON 成对存在；两种模式共用同一套 P6 断言与 checkpoint 结构，但截图和地图证据必须保留各自标记。

### 4.1 私有原包模式

- 由私有原包准备流程生成真实派生资源与 `asset-index.json`；资源清单不得含 `SYNTHETIC` 标记。
- `M73_WILD_SYNTHETIC_ACCEPTANCE` 不设置为 `1`。
- E2E 记录 `environment_kind=private_original`、`map_evidence=RECOVERED_SECONDARY`、截图 `image_kind=real_browser`。
- 该模式只在明确授权的私有原包验收任务中运行；本次收尾修复没有触发下载安装器路径，也没有运行原版客户端。
- 工作流中的私有任务已移除 `[m73-wild-only]` 分流；如未来按既有 `[private-smoke]` 机制触发，私有实机任务将执行完整 real-resource browser/offline E2E，不再跳过其他测试。

### 4.2 合成标注模式

- CI 先运行 `tools/testing/make_ch1_wild_fixture.py`，生成仅用于测试的合成 Chapter 1 地图与碰撞资源，不含原版地图美术。
- 设置 `M73_WILD_SYNTHETIC_ACCEPTANCE=1` 后运行本 E2E。
- E2E 记录 `environment_kind=synthetic_browser`、`map_evidence=SYNTHETIC`、截图 `image_kind=synthetic_browser`。
- 合成地图、合成角色视觉代理和合成截图只证明重建逻辑在该 fixture 下的行为，不升级为原版地图/美术证据，不得标记为 `VERIFIED`。
- 两种模式均输出 `test-results/m7-3-wild-encounters-checkpoints.json`；五张截图分别记录 SHA-256、字节数及对应 E2E checkpoint。

## 5. 五张截图

| 文件 | 目标 | 必须记录 |
|---|---|---|
| wild-01-field-nearby.png | 野外 HUD 显示名称、等级门槛、距离和状态 | SHA-256、字节数、E2E checkpoint |
| wild-02-battle-entry.png | 野怪进入战斗画面 | SHA-256、字节数、E2E checkpoint |
| wild-03-victory-reward.png | 胜利后金币、EXP、药草结算 | SHA-256、字节数、E2E checkpoint |
| wild-04-save-load-state.png | 保存/读档后击败状态和 receipt 保持 | SHA-256、字节数、E2E checkpoint |
| wild-05-map-entry-respawn.png | 离开 map 1020 再进入后的刷新 | SHA-256、字节数、E2E checkpoint |

## 6. 执行命令

P0 gate 已通过；以下命令在实现完成后执行：

```bash
cd web && npm run typecheck
cd web && npm test
cd web && npm run build
cd web && npm run test:e2e -- e2e/ch1-wild-encounters.spec.ts
```

S42 本阶段不运行；S42 只在 S46 最终集成版上运行一次。

## 7. 交付证据

实现阶段需提供：
- 分支最终 HEAD 完整 SHA，并从 GitHub 读回；
- typecheck、单测、生产构建、野怪 E2E 的实际结果；
- P6 11 行逐项结果；
- 五张截图的 SHA-256、字节数及对应 checkpoint；
- 对审批条件逐项符合性说明。

未实际执行的测试必须标记未执行，不得以静态审阅或 CI 旧结果代替。


## 8. 总管裁决与 E2E 修复根因

### 8.1 三项总管裁决

1. **地图重生：** 离开 map 1020 再进入后刷新六条野怪，是 `RECONSTRUCTION_POLICY` 重建规则，不是原版零售客户端实测节奏。原版刷新节奏仍为 `UNKNOWN`。
2. **固定掉落：** 六条 map 1020 野怪的放置表均关联 item 4002，与探索报告 map 1020 全表一致，不是数据偏差。原始放置关联为 `RECOVERED_SECONDARY`；D1 的 100% 概率、每次 1 个仍是 `RECONSTRUCTION_POLICY`，不是原版掉落概率证据。
3. **E2E 修复范围：** 本轮仅六项字母修复 A/C/D/E/F/G；没有 B 项。B 是总管中途撤销的 fixture 尝试，不属于本次修复。

### 8.2 A/C/D/E/F/G 根因记录

| 修复 | 根因（按补丁注释） | 修复方式 |
|---|---|---|
| A | 慢速虚拟机（约 9 FPS）上，分别执行 runtime 与 scene 两次 Playwright evaluate 可能跨越一个格子的状态切换，错过短暂的单格窗口。 | 增加 `fieldState()`，在同一次 evaluate 中读取 runtime 与 scene；五处轮询统一使用该原子快照。 |
| C | 从 route-049 到达点 (66,4) 直接走向 (48,120) 时，八方向 BFS 会优先选择穿过 route-048 activation cluster 的 131 步捷径，而不是 133 步回程走廊；踩到 activation cell 会触发 route-048 转场回 map 1030。 | 使用 `approachWild22024()` 两段走法：先到 (64,4)，再走向 (48,120)，使第二段选择回程走廊；初次遭遇与刷新后再遭遇共用。 |
| D | 奖励 receipt 写死 generation=1；离开 map 1020 再进入后 generation 会增加，固定字符串不再匹配真实 receipt。 | 三处胜利/收据断言统一使用 `generationBefore` 构造 receipt。 |
| E | 产品运行时不允许战斗中途导出存档；撤退和失败段在战斗期间调用 `exportJson()` 会触发保存边界问题。 | 删除战中导出；改为与胜利后已保存的 `wonSave.rewardReceipts` 比较，验证撤退/失败没有新增收据。 |
| F | nearby 轮询在移动中首次命中可遭遇格时距离为 3；后续读取前玩家可能继续前进一步，因此精确断言距离等于 2 不稳定。 | 保留实体、名称、等级与 eligible 状态断言；距离改为严格小于 4。 |
| G | (48,125) 在合成 fixture 中不可行走；(53,120) 虽可行走，但奇数 parity 的等距投影往返会落到 (53,121)，该格不可行走。 | 改用偶数 parity、位于回程走廊的 (52,120)；其到实体 22024 (49,121) 的 Manhattan 距离为 4，可清除距离小于 4 的压制状态。 |

## 9. 主文档实际位置

本任务保留唯一主文档：`docs/integration-notes/m7-3-wild-encounters.md`。验收记录为本文件：`docs/validation/m7-3-wild-encounters-acceptance.md`。仓库中没有另建 `docs/m7-3-wild-encounters.md`，避免出现两份主文档。
