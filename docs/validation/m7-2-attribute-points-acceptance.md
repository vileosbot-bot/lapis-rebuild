# M7.2 / S43 属性成长与分配验收记录

## 当前验收状态

状态：`IN_PROGRESS`（不得据此标记 S43 完成，也不得进入 S44）。

本文件只记录本分支 S43 实际执行的结果。没有实际执行的项目保持 `NOT_RUN`，不以 CI 未触发、代码静态审阅或测试文件存在代替通过。

## 验收矩阵

| 项目 | 命令 / 方法 | 状态 | 结果 |
|---|---|---|---|
| TypeScript typecheck | `cd web && npm run typecheck` | NOT_RUN | 等待隔离沙箱完整工作树 |
| Unit tests | `cd web && npm test` | NOT_RUN | 等待隔离沙箱完整工作树 |
| Production build | `cd web && npm run build` | NOT_RUN | 等待隔离沙箱完整工作树 |
| Playwright E2E | `cd web && npm run test:e2e -- e2e/m7-2-attribute-allocation.spec.ts` | NOT_RUN | 等待隔离沙箱完整工作树 |
| S42 | 不运行 | STOPPED_BY_PLAN | 只允许在 S46 最终集成版运行一次 |

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
