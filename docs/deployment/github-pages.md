# GitHub Pages 部署

## 访问地址

合并部署工作流后，站点地址为：

<https://vileosbot-bot.github.io/lapis-rebuild/>

这是公开静态站点。访问者直接打开链接即可使用，无需下载客户端。

## 部署触发方式

工作流：`.github/workflows/deploy-pages.yml`。

- **自动部署**：有提交推送到 `main` 时，自动构建并部署。
- **手动部署**：在 GitHub 仓库的 **Actions → Deploy GitHub Pages → Run workflow** 中选择 `main` 分支并运行。
- 工作流只允许 `main` 分支执行构建和部署。手动选择其他分支时，部署作业会跳过。

本次接线任务只新增工作流和本文档，不触发部署。第一次真正部署发生在改动合并到 `main` 后：合并产生的 `push` 会自动触发；也可以由仓库维护者在合并后从 `main` 手动触发。

## 重新部署

需要重新发布当前 `main` 内容时：

1. 打开仓库的 **Actions** 页面。
2. 选择 **Deploy GitHub Pages**。
3. 点击 **Run workflow**。
4. 分支选择 `main`，再点击运行。

也可以向 `main` 推送新的提交，让工作流自动运行。若只是重试同一提交的失败部署，可在对应工作流运行记录中选择 **Re-run jobs**。

## 构建配方

工作流在 GitHub Actions 的 `ubuntu-24.04` runner 上执行：

1. 使用 Node.js `22.16.0`。
2. 生成合成游戏数据：

   ```bash
   python3 tools/testing/make_web_fixture.py --out web/public/game-data
   ```

3. 在 `web/` 下安装锁定依赖并构建：

   ```bash
   npm ci --ignore-scripts
   npm run build -- --base=/lapis-rebuild/
   ```

4. 检查构建产物中的 JS、CSS 均使用 `/lapis-rebuild/` 子路径，并确认 `game-data/prototype.json` 与 `game-data/asset-index.json` 存在且数据来源标记为 `synthetic`。
5. 将 `web/dist/` 上传为 GitHub Pages artifact，再由部署作业发布。

## Vite base 子路径

本地开发配置 `web/vite.config.ts` 保持原样，仍使用 `base: './'`。

只有 GitHub Pages 生产构建通过 Vite CLI 参数覆盖 base：

```bash
npm run build -- --base=/lapis-rebuild/
```

因此部署后的 JS、CSS 资源从 `/lapis-rebuild/assets/` 加载。运行时资源加载器使用相对路径 `./game-data/...`；在站点根路径下会解析到 `/lapis-rebuild/game-data/...`，不会错误请求域名根目录的 `/game-data/`。

## 合成数据与美术资源边界

`web/public/game-data/` 被仓库 `.gitignore` 排除，不提交生成物。每次部署构建都在临时 runner 上调用 `tools/testing/make_web_fixture.py` 重新生成，并由 Vite 复制进 `web/dist/game-data/`。

公开站点只包含该脚本生成的合成地图、角色动画、特效和合成文本，用于可运行的测试版本；**不包含原版客户端、原版美术包或从原版客户端提取的资源**。本工作流不下载、解包或上传原版客户端，也不改变现有资源证据等级。

Cloudflare Pages 配置和工作流不在本次改动范围内。
