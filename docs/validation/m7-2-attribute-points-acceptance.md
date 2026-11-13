# M7.2 / S43 属性成长与分配验收记录

## 当前验收状态

状态：`PARTIAL_BLOCKED`（单元测试已通过；typecheck / production build / E2E 因沙箱依赖网络 DNS 故障阻塞；不得据此标记 S43 完成，也不得进入 S44）。

本文件只记录本分支 S43 实际执行的结果。没有实际执行的项目保持 `NOT_RUN`，不以 CI 未触发、代码静态审阅或测试文件存在代替通过。

## 验收矩阵

| 项目 | 命令 / 方法 | 状态 | 结果 |
|---|---|---|---|
| TypeScript typecheck | `cd web && npm run typecheck` | BLOCKED_ENVIRONMENT | npm 依赖安装因 `EAI_AGAIN registry.npmjs.org` 失败；本地 Phaser 包缺失，系统全局 TypeScript 5.8.3 检查无法解析 `phaser`，不能视为项目 typecheck 通过 |
| Unit tests | `cd web && npm test` | PASS | Node 22.16.0：384 tests，377 pass / 0 fail / 7 skipped，exit 0；跳过项为既有需要真实资源的测试 |
| S43 focused unit tests | `node --experimental-strip-types --test tests/m7-2-attribute-points.test.ts tests/m7-2-attribute-save-migration.test.ts` | PASS | 11 tests，11 pass / 0 fail / 0 skipped，exit 0 |
| Production build | `cd web && npm run build` | BLOCKED_ENVIRONMENT | tsc 阶段因缺少 Phaser 类型包失败，未到达 Vite build 阶段；不标记通过或代码失败 |
| Playwright E2E | `cd web && npm run test:e2e -- e2e/m7-2-attribute-allocation.spec.ts` | BLOCKED_ENVIRONMENT | Node Playwright CLI 未安装；PATH 命中 Python Playwright 命令，返回 `error: unknown command 'test'`；剑士/巫师流程均未运行 |
| 截图与 checkpoint | E2E `capture()` | NOT_RUN | 三张目标截图、SHA-256、字节数、视口与 checkpoint 均未生成；保持 UNKNOWN |
| S42 | 不运行 | STOPPED_BY_PLAN | 只允许在 S46 最终集成版运行一次 |


## 沙箱执行记录（2026-11-13）

### 工作树恢复

- ZIP：`feat-ch1-s43-attribute-growth.zip`，1,714,179 bytes，SHA-256 `1e07cb28b26e9294e0231dff9115de40ef125f40542b37c6738ccd29b8b2d2a0`。
- ZIP comment 标识 HEAD：`f03a6a2989e5c734dc92d7cb0f6b0f2477ea2187`；该 HEAD / 两提交历史 / main 基线 `95c07edad560729c965941a961fb666b47c29197` 已由 bot GitHub 插件独立核验。
- ZIP 共 615 个条目：548 个普通文件 + 67 个目录；未包含 `.git` 元数据。
- 解压目录：`/tmp/lapis-s43/lapis-rebuild-feat-ch1-s43-attribute-growth`。

### 本轮修正

- `web/src/progression/attribute-stat-policy.ts`：只保留 CON→HP +50、WIS→MP +50、STR→物攻/物防各 +1、INT→魔攻/魔防各 +1；DEX/REG 从 mappings 移除，明确标记 `unmapped` / `UNKNOWN` / `RECONSTRUCTION_POLICY`，不产生战斗数值贡献。
- `web/tests/m7-2-attribute-points.test.ts`：断言 DEX/REG 未映射，并验证增加 DEX/REG 不改变战斗投影。
- `docs/integration-notes/m7-2-attribute-points.md`：同步修正属性映射表。
- `web/src/ui/attribute-allocation-panel.ts`：修复模板字符串反引号与插值前多余的反斜杠；该语法问题原先使两个既有测试文件无法加载，修复后全套单测可运行。

### 依赖安装阻塞

- `npm ci --ignore-scripts`：120 秒后超时；日志显示访问 `registry.npmjs.org` 返回 `EAI_AGAIN`。
- `npm ci --ignore-scripts --no-audit --fetch-retries=0 --fetch-timeout=20000`：exit 1；npm 报 `Exit handler never called!`，日志仍显示多个 tarball 请求 `EAI_AGAIN`。
- 没有可用的本地 Node 项目依赖缓存；未安装到完整的 Phaser、Vite、TypeScript 5.9.3、Node Playwright 依赖。
- `npm run typecheck` 已尝试，使用系统全局 TypeScript 5.8.3；由于 Phaser 依赖缺失而产生 `Cannot find module 'phaser'` 与 Phaser Scene 类型连带错误，故归类为环境阻塞，不作为代码 typecheck 结果。
- `npm run build` 已尝试；在 tsc 阶段因缺少 Phaser 依赖终止，Vite build 未运行。
- `npm run test:e2e -- e2e/m7-2-attribute-allocation.spec.ts` 已尝试；Node Playwright CLI 不存在，命中 Python Playwright 命令并返回 `error: unknown command 'test'`。E2E 未运行。

### 单元测试实际结果

- 命令：`npm test`
- Node：`v22.16.0`
- 结果：384 tests；377 pass、0 fail、7 skipped；exit 0。
- S43 focused 命令：`node --experimental-strip-types --test tests/m7-2-attribute-points.test.ts tests/m7-2-attribute-save-migration.test.ts`
- 结果：11 tests；11 pass、0 fail、0 skipped；exit 0。

截图 `attribute-before-allocation.png`、`attribute-after-allocation.png`、`attribute-after-save-load.png` 未生成，截图哈希/字节数/视口/checkpoint 均为 `UNKNOWN / NOT_RUN`。本轮未运行 S42。

## 必须通过的行为

- Lv1 创建即有 1 个未分配属性点；六维自动成长各 +1。
- Lv1–5 每级发 1 点，Lv6–65 每级发 2 点；多级升级按每个跨越等级逐行发点。
- 相同 reward receipt 重放不重复发点。
- 余额不足、负数、小数、未知属性、超额分配、过期 draft 均拒绝。
- 取消不改变已提交属性；确认后余额和属性值一致。
- 剑士与巫师均验证等级、查看余额、取消、确认、存档和 reload。
- schema 1 M7 extension 和没有 M7 extension 的旧 SaveV2 均迁移至 schema 2；旧技能、HP/MP、EXP、M6 装备不得丢失。
- Lv66–100 不进入 runtime；本阶段不改怪物数据。

## 截图与 checkpoint

至少需要以下截图：
- `attribute-before-allocation.png`
- `attribute-after-allocation.png`
- `attribute-after-save-load.png`

每张截图记录：
- SHA-256
- 字节数
- 浏览器视口宽 × 高
- 职业与角色等级
- 对应状态 checkpoint

当前截图 SHA-256 / 字节数 / 视口：`UNKNOWN / NOT_RUN`，不得编造。

## 执行环境与限制

- 工作空间：0718 (EN)，Business（由用户浏览器侧核实）。
- 模型：GPT-6，Extra High，第 4/5 档；非 Pro；Chat 模式。
- 测试运行环境：独立隔离沙箱。
- GitHub 写操作：仅 `vileosbot-bot` 插件。
- 本任务不登录用户电脑、不使用云端 gh、不访问 ViLeo06 写权限。
- 不运行原版客户端、不部署、不消费付费服务。
- `.github/workflows/web-ci.yml` 当前 push 过滤为 `codex/**`；本分支不触发该 workflow。本轮不创建 PR、不创建额外触发分支、不使用其他触发方式。
