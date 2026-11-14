# M7.3 第一章野外遭遇验收计划

- request-id：`ch1-m73-wild-20261114-01`
- 分支：`feat/ch1-m73-wild-encounters`
- 状态：验收计划；尚未实现、尚未执行测试。
- 证据标签：所有规则性决策均为 `RECONSTRUCTION_POLICY`，YBCS 放置数据为 `RECOVERED_SECONDARY`，原版未知项为 `UNKNOWN`。

## 1. P0 gate

- [x] GitHub 账号为 vileosbot-bot。
- [x] main 基线为 0155c439ee9fde157ae700da9fbcabdca484abb5。
- [x] 分支 feat/ch1-m73-wild-encounters 从指定基线创建。
- [x] 探索报告与六条 map 1020 数据读回。
- [x] route 040/048 现有路由定义读回。
- [x] item 4002 便宜药草元数据读回。
- [ ] map 1020 PNG / collision JSON 可用。
- [ ] 六个实体坐标位于地图边界内。
- [ ] 六个 approach 坐标均经真实 collision JSON 验证为 walkable。
- [ ] route 048 真实路径与野怪触发区域的空间关系已验证。

P0 最后四项受缺少派生地图资源阻塞。不得用 synthetic fixture 代替原地图验证，不得猜测或移动坐标。

## 2. 已批准策略及路由互斥要求

- 距离：Manhattan distance 严格小于 4。
- 触发：有效候选恰好 1 条；0 条或多条均不触发。
- 触发时机：移动路线完成后；不在 routeLength 大于 0 时触发。
- route 040/048：路线移动期间野怪触发必须被抑制；路线转换处理优先于野怪检查；抵达路线目标后由路线控制器完成地图转换，不得插入野怪战斗。
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

## 4. 五张截图

| 文件 | 目标 | 必须记录 |
|---|---|---|
| wild-01-field-nearby.png | 野外 HUD 显示名称、等级门槛、距离和状态 | SHA-256、字节数、E2E checkpoint |
| wild-02-battle-entry.png | 野怪进入战斗画面 | SHA-256、字节数、E2E checkpoint |
| wild-03-victory-reward.png | 胜利后金币、EXP、药草结算 | SHA-256、字节数、E2E checkpoint |
| wild-04-save-load-state.png | 保存/读档后击败状态和 receipt 保持 | SHA-256、字节数、E2E checkpoint |
| wild-05-map-entry-respawn.png | 离开 map 1020 再进入后的刷新 | SHA-256、字节数、E2E checkpoint |

## 5. 执行命令

仅在 P0 gate 解除、代码实现完成后执行：

```bash
cd web && npm run typecheck
cd web && npm test
cd web && npm run build
cd web && npm run test:e2e -- e2e/ch1-wild-encounters.spec.ts
```

S42 本阶段不运行；S42 只在 S46 最终集成版上运行一次。

## 6. 交付证据

实现阶段需提供：
- 分支最终 HEAD 完整 SHA，并从 GitHub 读回；
- typecheck、单测、生产构建、野怪 E2E 的实际结果；
- P6 11 行逐项结果；
- 五张截图的 SHA-256、字节数及对应 checkpoint；
- 对审批条件逐项符合性说明。

未实际执行的测试必须标记未执行，不得以静态审阅或 CI 旧结果代替。
