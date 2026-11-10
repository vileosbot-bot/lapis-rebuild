# Harness Operations Reference

## 1. 核验基线与使用规则

本文件中的源码入口、命令、fixture 名称和输出位置，已在分支 `docs/verification-mvp`、提交 `2f21ae1d0186dc57e5772de9e6d16daa7519d524` 上逐项重新读取核对。本节列出读取版本的文件 SHA，后续源码改变时必须重新读取，不得沿用旧行号或假定 fixture 仍存在。

本文件是现有 harness 的操作索引，不代表任何测试在编写本文件时被执行。

| 文件 | 行数 | 本次读取的 blob SHA |
|---|---:|---|
| `web/package.json` | 2 | `c6174e0d99a7f51a37f2c6f5a459981833c0b6bc` |
| `web/playwright.config.ts` | 8 | `236f6a2673e602e9e9f6a3d5005faa854a69d86d` |
| `.github/workflows/web-ci.yml` | 234 | `4164b635cea6505927c846103414de13ceaae01b` |
| `tools/testing/make_web_fixture.py` | 55 | `eb88eb1ef9dd55134a2a5b57e5d62a3470ffeef3` |
| `web/src/main.ts` | 215 | `10afaea679101b061b207e6478d2a2d6a364e531` |
| `web/src/m4-main.ts` | 78 | `8e5c01ab05c1c88a0d1f213e701ee8b48e91a75a` |
| `web/src/m4-runtime-integration.ts` | 1650 | `c863111f3aeea8c22f78d997462a361c5fb7d80c` |
| `web/e2e/s14-m4-manual-acceptance.spec.ts` | 291 | `8094f5e10b788cfba1ae79cb3ce802bb8a998fd0` |
| `web/e2e/s18-world-transition-harness.spec.ts` | 65 | `f6ee6f7edb07c2eb41f9af6759c4fa82108ff72d` |
| `web/e2e/s34-m7-final-acceptance.spec.ts` | 443 | `cb17a7a54d0c3be997429c249500c273a802e3fb` |
| `web/e2e/m8-platform-acceptance.spec.ts` | 84 | `a85249853bb226ca71ca7dab385c115cea48170b` |
| `web/e2e/helpers/platform-acceptance.ts` | 71 | `db65cd019ec65c6420256ca999a7fa105ac7b925` |
| `web/e2e/s41-m7-1-acceptance.spec.ts` | 110 | `1086c9c8f394556fc17d14839a4c78753ef06e5a` |
| `web/soak.mjs` | 174 | `20a823421912334ecebda5e4be901116bee55231` |
| `.gitignore` | 51 | `3f3a27a3b398c3a934d7d30c409c33b58fe2c434` |

## 2. 命令索引

### 2.1 仓库根目录命令

| 命令 | 当前来源 | 用途 / 限制 |
|---|---|---|
| `python3 -m unittest discover -s tests/parsers -v` | `.github/workflows/web-ci.yml` | CI parser 单元测试；parser 相关改动时执行 |
| `python3 tools/testing/make_web_fixture.py --out web/public/game-data` | `.github/workflows/web-ci.yml`、`tools/testing/make_web_fixture.py` | 生成 synthetic Web 数据；输出标记 SYNTHETIC，不能当作原始游戏资源；目标目录已存在时生成器会拒绝覆盖 |

`make_web_fixture.py` 当前 CLI 只接受必填参数 `--out`。生成前确认输出目录不存在；不要删除或覆盖已有数据来绕过其保护。

### 2.2 Web 工作目录命令

先进入 `web/`。以下脚本均来自当前 `web/package.json`：

| 命令 | 实际脚本 | 用途 |
|---|---|---|
| `npm ci --ignore-scripts` | npm 锁文件安装 | 使用锁定依赖安装 |
| `npm run typecheck` | `tsc --noEmit` | TypeScript 类型检查 |
| `npm test` | `node --experimental-strip-types --test tests/*.test.ts` | Web 单元测试 |
| `npm run build` | `tsc --noEmit && vite build` | production build |
| `npm run test:e2e -- --workers=2` | `playwright test` | 当前 CI synthetic Chromium 全套 E2E 命令；CI 显式覆盖 worker 数为 2 |
| `npm run test:platform:smoke` | `playwright test e2e/m8-platform-acceptance.spec.ts --grep "M8 platform acceptance - fast smoke"` | M8 平台快速 smoke |
| `npm run test:platform` | `playwright test e2e/m8-platform-acceptance.spec.ts` | M8 平台验收 spec |
| `npm run resource-manifest:verify` | `node --experimental-strip-types scripts/resource-manifest.ts verify` | 仅在资源 manifest 相关任务中执行 |
| `npm run resource-manifest:generate` | `node --experimental-strip-types scripts/resource-manifest.ts generate` | 写操作；仅在任务明确要求生成 manifest 时执行 |

当前 `web/package.json` 要求 Node `>=22.12.0`。仓库根 `AGENTS.md` 规定 Python 3.12。

Playwright 配置位于 `web/playwright.config.ts`：

- `testDir: './e2e'`。
- 默认 `timeout: 60000`、`workers: 1\)、`fullyParallel: false`。
- reporter 为 list 和 JSON；JSON 输出 `test-results/e2e.json`。
- baseURL 为 `http://127.0.0.1:4173`，默认 viewport 为 1440×1080。
- `screenshot: 'only-on-failure'`、`trace: 'retain-on-failure'`。
- `webServer.command` 为 `npm run preview -- --port 4173`；E2E 会通过配置启动 production preview。运行前先完成 `npm run build`。

CI 的 Chromium 安装命令是 `npx playwright install --with-deps chromium`。CI 先生成 synthetic pack，再执行 typecheck、unit、build 和 E2E。不要将 CI 的 `--workers=2` 误写为 Playwright 默认值；本地配置默认 1。

CI 另有条件执行的命令 `npm run test:e2e -- e2e/s41-m7-1-acceptance.spec.ts`，仅在 workflow 指定 S41 分支条件成立时执行，并设置 `S41_M7_1_FINAL=1`。S41 spec 在该环境变量不为 `1` 时会 skip；被 skip 的运行不是验收证据。

### 2.3 指定 spec 的定向执行

当前 `web/package.json` 的 `test:e2e` 脚本为 `playwright test`，以下定向调用使用该现有脚本及已存在的 spec 路径：

- `npm run test:e2e -- e2e/s14-m4-manual-acceptance.spec.ts`
- `npm run test:e2e -- e2e/s18-world-transition-harness.spec.ts`
- `npm run test:e2e -- e2e/s34-m7-final-acceptance.spec.ts`
- `npm run test:e2e -- e2e/m8-platform-acceptance.spec.ts`

定向 spec 只能证明该 spec 所覆盖的功能。S14/S18/S34 是现有 M4、切图 harness 和 M7 训练验收样例，不能替代第一章主链验收。

### 2.4 30 分钟 wall-clock soak

`web/soak.mjs` 没有 package.json script。脚本要求环境变量 `LAPIS_OFFLINE_PREVIEW` 指向已存在的 preview HTML，并固定运行 `30*60*1000` 毫秒。可在 `web/` 目录以以下形式调用：

    LAPIS_OFFLINE_PREVIEW=/absolute/path/to/lapis-private.html node soak.mjs

该脚本交替执行剑士/巫师 M6 field soak，包含升级、装备、SaveV2 save/load、camera follow 和诊断状态检查；输出 `test-results/soak/end.png` 与 `test-results/soak/report.json`。它不是第一章 Quest1 → 遭遇战斗 → 胜利返回的 soak，不能替代该主链验收。只有获准使用对应私有 preview 时才执行；不得公开该 preview。

## 3. 运行时入口与状态快照

### 3.1 Diagnostics 与 M4 runtime

| 入口 | 源码位置 | 实际职责 |
|---|---|---|
| `window.lapisDiagnostics.snapshot()` | `web/src/main.ts` 第 146–148 行，`lapis-ready` 事件处理 | 返回 `LabScene.snapshot()`；供 E2E 读取地图、战斗、相机、角色等场景状态 |
| `window.lapisM4.snapshot()` | `web/src/m4-main.ts` 第 48–72 行的 M4 bridge | 返回 `M4RuntimeIntegration.snapshot()`；供 E2E 读取 quest、world、progression、inventory 等状态 |
| `window.lapisM4.exportJson()` | `web/src/m4-main.ts` 第 54–60 行的 M4 bridge | 导出 SaveV2 JSON；仅用于相应保存验收 |

M4 E2E 通常通过 `/?m4=1` 进入。原因是 `web/src/m4-main.ts` 在 `navigator.webdriver` 为真时默认不启用 M4，除非 URL 查询参数 `m4=1`；S14/S34 的 `ready()` 均使用该入口。

### 3.2 Webdriver acceptance fixtures

所有 acceptance fixture 都是自动化测试操作杆，不是玩家功能。不得在非 webdriver 环境调用，也不得将其注入状态当作真实用户路径证据。

**S14 fixtures：** `web/src/m4-runtime-integration.ts` 第 211–225 行的 `installS14AcceptanceBridge()` 在 `navigator.webdriver` 为真时挂载以下接口：

- `acceptanceSetBattlePaused(paused)`
- `acceptanceActionReady()`
- `acceptanceCanAct()`
- `acceptanceReachable()`
- `acceptanceIssueMoveTo(x, y)`
- `acceptanceIssueAttack()`
- `acceptanceAdvanceLiveBattleStep()`
- `acceptanceAdvanceUntilActionOrEnd(maxSteps)`

其中 `acceptanceAdvanceUntilActionOrEnd` 要求 `maxSteps` 为 1–40 的整数、处于暂停战斗且 document 可见。其他方法也有战斗状态或参数守卫；使用前读取对应方法实现，不得假设它们可在任意状态调用。

**M7/M6 fixtures：** `web/src/m4-main.ts` 第 61–71 行仅在 `navigator.webdriver` 为真时向 `window.lapisM4` 注册：

- `acceptanceStartTrainingBattle(id)`
- `acceptanceGrantLevel(targetLevel)`
- `acceptanceSetEnemyHp(targetId, hp)`
- `acceptanceSetPlayerMp(mp)`
- `acceptancePrimeEnemyAction(targetId)`
- `acceptanceRunEnemyAbility(targetId, abilityKind)`
- `acceptanceSelectEnemy(targetId)`
- `acceptanceAdvanceBattleTimeMs(deltaMs)`
- `acceptanceSetPlayerVitals(hp, mp)`

`acceptanceAdvanceBattleTimeMs` 当前接受 0–120000 ms；其他方法的前置状态、边界和用途以 `web/src/m4-runtime-integration.ts` 的对应实现为准。S34 spec 实际使用其中的 `acceptanceStartTrainingBattle`、`acceptanceSelectEnemy`、`acceptanceAdvanceBattleTimeMs`、`acceptanceRunEnemyAbility`，并在其他测试中使用 MP/HP 与敌人状态操作杆。

这两组接口注册位置不同：S14 操作杆由 runtime integration 的 S14 bridge 安装；M7/M6 操作杆由 m4-main 的 webdriver 条件对象展开注册。不得把其中一个注册位置写成另一个。

### 3.3 运行时入口的适用边界

`web/src/world/quest-runtime.ts` 与 `web/src/world/world-content.ts` 当前定义的是重构训练任务 `s9-training-run` 及 `RECONSTRUCTION_POLICY` 状态流；它们不是 Quest1 的正式 runtime ID 或服务端规则。第一章验收须等待 #3 提供真实绑定，不得复用训练任务 ID 伪装 Quest1。

## 4. 现有 E2E spec 与适用范围

### 4.1 S14 — M4 manual acceptance

文件：`web/e2e/s14-m4-manual-acceptance.spec.ts`（291 行；当前核验 blob `8094f5e10b788cfba1ae79cb3ce802bb8a998fd0`）。

测试名称：

- `S14 M4 swordsman completes the playable quest, rewards and SaveV2 path`
- `S14 M4 wizard uses authored vitals, visible magic and opt-in diagnostics`

使用 `window.lapisDiagnostics.snapshot()`、`window.lapisM4.snapshot()` 和 S14/M7 操作杆。剑士测试显式写出 8 个检查点截图及 checkpoint JSON；巫师测试再写出 2 张截图：

- `test-results/s14-01-m4-field.png`
- `test-results/s14-02-quest-accepted.png`
- `test-results/s14-03-swordsman-battle.png`
- `test-results/s14-04-swordsman-move.png`
- `test-results/s14-05-swordsman-attack.png`
- `test-results/s14-06-victory.png`
- `test-results/s14-07-returned.png`
- `test-results/s14-08-quest-complete.png`
- `test-results/s14-09-wizard-magic.png`
- `test-results/s14-10-developer-diagnostics.png`

剑士 checkpoint JSON：`test-results/s14-m4-swordsman-acceptance.json`。

S14 的剑士和巫师测试都会在 `playableRecovery===true` 时 skip，因为相应验收已由 M5/private-original 路径 supersede。必须检查实际 test result 中 PASS/FAIL/SKIP；不能仅因 spec 存在就认为其通过。

该 spec 是 M4 训练任务验收，不是第一章 Quest1 验收。

### 4.2 S18 — world transition harness

文件：`web/e2e/s18-world-transition-harness.spec.ts`（65 行；当前核验 blob `f6ee6f7edb07c2eb41f9af6759c4fa82108ff72d`）。

测试名称：

- `S18 browser harness visualizes automatic field -> interior -> return transition`
- `S18 browser harness keeps NPC interaction separate from automatic scene transition`

该 spec 直接构造 `createTrainingHousePolicy()` 与 `SceneTransitionController`，使用 `page.setContent()` 渲染 synthetic HTML，再截取：

- `test-results/s18-01-field-door.png`
- `test-results/s18-02-interior-arrival.png`
- `test-results/s18-03-interior-exit.png`
- `test-results/s18-04-npc-zone.png`

这些图片是 synthetic harness 可视化，不能证明生产网页真实地图、真实 NPC 或第一章运行行为。

### 4.3 S34 — M7 final acceptance

文件：`web/e2e/s34-m7-final-acceptance.spec.ts`（443 行；当前核验 blob `cb17a7a54d0c3be997429c249500c273a802e3fb`）。

该 spec 当前有 11 个测试，覆盖训练战斗 #1/#15、战斗 HUD、A 热键、QWER 与 1–6、剑士 Sacrifice、巫师 Poison/Ashes/Petrify、SaveV2、Stage 7 触屏技能和 private-original story battle zones。

测试名称：

- `S34 training battles #1 and #15 launch concrete fixed S30 rosters`
- `S34 battle deck keeps ordinary attack exposed and preserves skill scroll while combat HUD refreshes`
- `S34A A hotkey uses ordinary-attack authority without legacy WASD double trigger`
- `S34A recovery/rest, QWER + 1-6, automatic range and Esc share battle authorities`
- `S34 swordsman Lv36 Sacrifice is a real periodic non-lethal battle buff`
- `S34 wizard Lv6 Poison applies immediate damage then fixed DOT without target action`
- `S34 wizard Lv26 Ashes blocks the S30 healer production self-heal`
- `S34 wizard Lv36 petrify prevents action and ordinary attack targeting`
- `S34 normal M7 SaveV2 restores stage, seven-stage skill state and HP/MP`
- `wizard Stage 7 exposes seven touch skills plus Recovery and confirmed exit`
- `S34 private-original pack uses distinct fixed-client story battle zones`

最后一项在 `playableRecovery` 不可用时会 skip。该 spec 使用训练战斗与 M7/M6 webdriver fixtures；当前文件没有显式 `page.screenshot()` 调用。它不是第一章 Quest1 主链验收。

### 4.4 M8 platform acceptance 与 helper

文件：

- `web/e2e/m8-platform-acceptance.spec.ts`（84 行；当前核验 blob `a85249853bb226ca71ca7dab385c115cea48170b`）。
- `web/e2e/helpers/platform-acceptance.ts`（71 行；当前核验 blob `db65cd019ec65c6420256ca999a7fa105ac7b925`）。

M8 spec 有 5 个测试：desktop production smoke、multi-file Vite build、landscape viewport/touch、portrait rotation、service worker registration。service worker 测试含条件 skip，需以实际测试报告为准。

可复用 helper 名称：

- `captureRuntimeFailures(page)`
- `bootProductionApp(page)`
- `expectPageFitsViewport(page)`
- `expectTouchAccepted(page)`
- `productionAssetSnapshot(page)`

这些 helper 适用于启动、page error/console error 收集、画布可见性、viewport 溢出、touch 和 production asset 检查；不负责第一章任务语义。

### 4.5 S41 条件验收

文件：`web/e2e/s41-m7-1-acceptance.spec.ts`（110 行；当前核验 blob `1086c9c8f394556fc17d14839a4c78753ef06e5a`）。

CI 仅在 workflow 的 S41 分支条件成立时运行该 spec，并设置 `S41_M7_1_FINAL=1`。spec 在该变量不为 `1` 时整体 skip；被 skip 的 Phase-1 harness run 不是验收证据。该 spec 使用 `acceptanceStartTrainingBattle`，不属于第一章专用操作杆。

## 5. 证据产物与清理

| 产物 | 产生方式 | 注意事项 |
|---|---|---|
| `web/test-results/e2e.json` | Playwright JSON reporter | 记录测试用例结果；不能直接当作所有 expect 断言的精确计数 |
| `test-results/*.png` | spec 中显式 `page.screenshot()` | 记录实际路径、Feature ID、截图 SHA-256 和真实/synthetic 属性 |
| Playwright failure screenshot | config 的 `screenshot: 'only-on-failure'` | 失败时截图；不要与 spec 显式截图混为一类 |
| Playwright trace | config 的 `trace: 'retain-on-failure'` | 失败时保留，交卷前先归档 |
| `test-results/soak/report.json` | `web/soak.mjs` | 仅对应该脚本实际覆盖的 M6 field soak |
| `test-results/soak/end.png` | `web/soak.mjs` | soak 结束截图 |

当前 `.gitignore` 忽略 `node_modules/`、`web/public/game-data/`、`web/test-results/` 和 `web/playwright-report/`。这些忽略规则不代表可以在证据上传前删除内容。

CI workflow `.github/workflows/web-ci.yml` 的 synthetic job 使用 artifact 名 `web-synthetic-validation`，保留 7 天；CI 中的 private builder artifact `m7-private-pack-builder` 保留 3 天。提交证据前确认对应 artifact 实际上传成功且可读。

## 6. 第一章验收的明确边界

当前可复用的 S14、S18、S34、M8 操作杆均不等于第一章专用操作杆：

- S14 是 M4 训练任务与战斗操作。
- S18 是 synthetic scene-transition controller harness。
- S34 是 M7 训练战斗与技能验收。
- M8 helper 是平台启动/布局/touch 检查。

在 #3 提供第一章真实 acceptance spec 和专用操作杆、且经总管验收之前，依赖第一章真实操作的 Feature 一律标记 `BLOCKED`。不自创 fixture 名称、不把训练任务映射成 Quest1、不以 synthetic 页面或手工构造状态替代真实到达路径。
