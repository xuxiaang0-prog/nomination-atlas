# 公开访问 Nomination Atlas

2026-10-09 已发布静态数据版：[Nomination Atlas](https://nomination-atlas-sam-xu.xuxiaang0.chatgpt.site)。访问者通过 HTTPS 链接浏览地图、八州职业榜、筛选、排序、分档详情和来源；不用登录、安装软件或运行数据库。源码仍包含完整的 ASP.NET Core 与 PostgreSQL 应用。

## 已完成的 Sites 发布

当前网址由 Sites 托管，访问权限已设为公开。保存版本 1 的发布状态为 `succeeded`。部署提交为 `6592a29086d1e9d6ee6aa699c121b8a3e2b83205`，数据版本为 `official-2026-10-09-v4`。发布记录见 `artifacts/publication.json`。

该网站托管内嵌 React 应用和 API 导出数据的静态 HTML。Sites 的源码提交不等于 GitHub 项目仓库；公开 GitHub 仓库为 [xuxiaang0-prog/nomination-atlas](https://github.com/xuxiaang0-prog/nomination-atlas)，远程 Pages 工作流尚未执行。当前发布未运行在线 C# 服务或托管 PostgreSQL 数据库。

## GitHub + Vercel

源码包含根目录 `vercel.json`。导入 GitHub 仓库时选择项目根目录和 **Other** 框架；安装命令为 `npm ci --prefix apps/web`，构建命令为 `npm run build:pages`，输出目录为 `dist/pages`。构建只需要前端依赖及已经核验的快照，不需要在线数据库或生产密钥。

项目导入 Vercel 后，默认分支的后续提交可自动生成生产部署；资料本身仍需要先核查并更新快照。免费、非商业的个人展示可使用 Hobby 方案，本次配置没有收费资源或付费功能。部署地址和成功记录将在实际部署完成后补充。

## GitHub Pages：可选的发布方式

公开仓库可使用 GitHub Free 的 Pages 托管。源码包已带 `.github/workflows/pages.yml`，只接受手动运行，提交或推送不会自动公开网站。

如需另行使用 GitHub Pages：

1. 把解压后的 `NominationAtlas` 根目录内容放入 GitHub 项目仓库，保留 `artifacts/snapshot.json` 和 `data/official/`。不要把整个源码压缩包作为唯一文件上传。
2. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. 打开 **Actions → Publish Nomination Atlas → Run workflow**，选择默认分支。
4. 工作流安装前端依赖、运行交互测试、构建网页，发布 `dist/pages`。部署完成后，工作流的 `github-pages` 环境显示真实访问地址。
5. 项目网址通常是 `https://<GitHub用户名>.github.io/<仓库名>/`。这些是占位符，不是已经发布的地址。

应用使用 HashRouter，州详情链接的路由在 `#` 后。嵌套仓库路径和刷新详情页无需服务器路由回退。打包页面已内嵌应用代码、样式及核验后的 API 数据响应，不会访问本机的 `localhost:5080`。

本地重建网站包：

```bash
npm ci --prefix apps/web
npm run build:pages
```

输出目录为 `dist/pages`，首页为 `index.html`。交付的 `NominationAtlas_PublicSite.zip` 是该目录的可上传压缩包，不是源码包。也可使用支持静态 HTML 的其他主机上传这个目录。

## 静态版的范围

- 地图、近期职业资料、州邀请披露、历史筛选、分数与数量排序、职业明细和官方来源链接均来自已核验的数据包。
- 页面不是实时查询 Home Affairs。资料更新后，应重新核查、创建新的不可变资料版本、运行 `verify:local` 导出 API 快照，再重建并手动发布。
- 分数与数量的日期、阶段和隐藏值规则继续按原表显示。上线不会把 EOI 月末快照变成当月新发邀请数。
- 模板问答只支持已导出的示例；自由问题和未导出的旧接口范围需要在线 ASP.NET Core API。
- Sites 静态版已上线；GitHub Pages 配置与可上传网站包已准备，远程 Pages 工作流未执行。

## 完整后端：后续可使用 Azure

需要开放全部 API 范围和自由输入的模板解析时，可以把 ASP.NET Core API 放到 Azure App Service，把 PostgreSQL 放到独立的托管数据库，并托管或代理 React 前端。GitHub Pages 本身只托管静态内容，不运行 C# 或 PostgreSQL。

该路线还需准备生产连接字符串与专用只读数据库登录、同源前端/反向代理或 CORS 配置、数据库迁移与来源导入，以及线上健康检查。已有 Compose 仅用于本机 PostgreSQL，不能把其中的本地示例密码直接用作生产凭据。费用以所选服务方案为准；本次没有创建收费资源。

官方资料：

- [GitHub Pages 是什么](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Azure App Service 部署 ASP.NET Core](https://learn.microsoft.com/en-us/azure/app-service/quickstart-dotnetcore)
