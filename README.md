# Nomination Atlas · 参考应用 v0.5

源码仓库：[xuxiaang0-prog/nomination-atlas](https://github.com/xuxiaang0-prog/nomination-atlas)。React / TypeScript 前端、ASP.NET Core 后端、官方资料及来源记录均保留在源码中。Vercel 静态发布配置位于根目录 `vercel.json`。

公开网站：[Nomination Atlas](https://nomination-atlas-sam-xu.xuxiaang0.chatgpt.site)。2026-10-09 已通过 Sites 发布静态数据版，访问权限为公开，无需登录。线上版内嵌已核验的 API 快照，资料不会自动更新。

这是按现有州提名说明书制作的可运行参考版本，供 Sam 先体验，再和 Codex 从空项目复建。它用官方资料比较澳洲八州/领地的具体职业、公开分数与数量，并保留来源、统计阶段和缺口。它展示数据契约、可信计算、前后端连接与交互验收，不预测个人成功率。

## 先体验

打开交付包旁的 `NominationAtlas_Preview.html`。它包含同一套 React 应用和本地 PostgreSQL / C# API 实际导出的响应，可直接打开，不需要账号或密钥。八州默认展示 2026 年 6 月末 EOI 持邀快照，也可切换 9 月末最新快照和 2025–26 完整财年的职业主申请量。原配额与 Demo 页面仍以 2025–26 为入口。

建议按这个顺序体验：

1. 打开就是澳洲地图。点八州/领地任一位置，再点“完整职业榜”；真实模式与 Demo 均保留地图入口。
2. 每州使用相同的职业榜，默认按 190 最低快照分数高→低排列；可改为低→高或按 190/491 的 EOI 条数多→少。选择 491 后，分数排序仅使用 491。职业搜索不预选蓝领、IT 或任何行业。
3. 八州默认是 2026-06-30 月末持邀快照，覆盖 242 个不同六位职业：NSW 120 个、VIC 122 个。展开一个职业，看每个签证、每个分数档的数量和原表定位。职业总数与分档分别来自官方公开表，不从隐藏分档推算。
4. 切换至 2026-09-30 最新快照，日期、分数与数量一起更新。该月全八州有 88 个不同职业，所有分档计数为 `<20`；持邀状态随月份变化，因此不把快照相加，也不把记录少解释为当月发邀少。
5. 切换至 2025–26 完整财年主申请量，查看 372 个不同具体职业、190/491 递交数量。它不含家属，也不是新发邀请或获签量。原表没有分数，页面明确显示“未公布”，小额计数保留 `<5`。
6. “州邀请披露”保留 WA 的 181 个已收录职业、ACT Matrix、SA 全部 17 个职业子大类及 TAS 轮次信息。分数体系与人数粒度分别说明；ABS 分类目录不是该轮获邀名单。“历史档案”单独保存 2019 官方 FOI，八州默认入口不再使用旧年档案。
7. 职业榜下方解释各州邀请机制，并分别列出通道总量与州级提名累计。邀请申请州提名、获提名后的签证申请邀请、最终获签，分别处理。
8. 点每条明细的“原表”检查官方来源、页码、统计方法与SHA-256。切换Demo仍只显示合成测试素材。

## 运行完整本地应用

当前资料已通过 Sites 发布静态数据版。源码包含 Vercel 配置及手动触发的 GitHub Pages 工作流，`npm run build:pages` 生成可托管的 `dist/pages`。发布步骤、更新流程及与完整后端的区别见 [`docs/PUBLISHING.md`](docs/PUBLISHING.md)。Pages 工作流尚未在远程执行。

需要 .NET SDK 10（本次使用 10.0.100；global.json 允许同一主版本的后续 feature band）、Node.js 24、npm 和 PostgreSQL 18。Compose 配置只绑定本机地址。原生 PostgreSQL / Docker 路线在本次环境未执行，需在你的电脑上验证。

在解压后的 `NominationAtlas` 根目录执行：

```bash
npm ci
dotnet restore src/Api --locked-mode
docker compose up -d --wait
dotnet run --project src/Api -- --seed
dotnet run --no-build --project src/Api --urls http://127.0.0.1:5080
```

另开终端：

```bash
cd apps/web
npm ci
npm run dev
```

浏览器打开 `http://localhost:4173`。API 健康检查为 `http://localhost:5080/health/ready`；OpenAPI 为 `http://localhost:5080/openapi/v1.json`。

本地默认连接是 `Host=127.0.0.1;Port=5432;Database=atlas;Username=atlas;Password=local-atlas-only`，可用环境变量 `ATLAS_DB` 替换。种子命令需建表和角色权限。API 每次打开连接切换到 SELECT-only 的 `atlas_reader`，并启用只读事务默认值。源码没有写入型公共 API。

## 复验

本次实际完成的是 PostgreSQL WASM 引擎与 Npgsql TCP 适配器上的 EF 迁移、C# 种子和 API 集成。它能验证 PostgreSQL SQL 和触发器行为；原生服务运行需要另外验收。验证器先建立空的 EF 迁移记录表，以避开适配器对初次表不存在异常的协议恢复限制；业务表仍由 EF 迁移创建。

```bash
dotnet run --project tests/ContractChecks
npm run verify:local
cd apps/web
npx openapi-typescript ../../artifacts/openapi.json -o src/generated/api.d.ts
npm test
npm run build
```

`verify:local` 会创建全新临时数据库、应用迁移、加载已核对样本、启动只读 API、运行错误和隔离检查、导出快照，最后关闭服务。不会连接默认的本机业务数据库。`ATLAS_DOTNET` 可指定 dotnet 可执行文件路径。

本地验证记录在 `artifacts/verification.json`。前端生成类型由后端 OpenAPI 导出。公开仓库包含 GitHub Actions 校验流程，远程执行结果以仓库 Actions 页为准。

## 项目入口

| 文件 | 用途 |
|---|---|
| `apps/web/src/App.tsx` | 地图、州详情、职业、问答、覆盖与来源弹窗 |
| `apps/web/src/DecisionViews.tsx` | 地图入口、统一八州详情、流程和州级统计 |
| `apps/web/src/AustraliaMap.tsx` | 真实/演示共用的可点击、可键盘操作地图 |
| `apps/web/src/OccupationBoard.tsx` | 全职业/职业组榜、分数与人数排序、范围筛选、分档展开 |
| `apps/web/src/RecentActivityBoard.tsx` | 八州近期职业、EOI 分档与独立总数、财年主申请量及三个资料入口 |
| `apps/web/src/occupation-names.ts` | 中文展示名称；英文原名及历史代码始终保留 |
| `apps/web/src/History.tsx` | 真实历史表、过滤、人数范围和覆盖页面 |
| `apps/web/src/HistoryEvidence.tsx` | 官方记录与原始证据弹窗 |
| `apps/web/src/history-data.ts` | 历史响应、职业/组匹配与指标口径 |
| `apps/web/src/api.ts` | 请求、完整查询缓存键、离线快照范围检查 |
| `apps/web/src/generated/api.d.ts` | OpenAPI 生成的前端契约类型 |
| `src/Api/Contracts.cs` | 强类型响应、事实、来源与缺失状态 |
| `src/Api/Program.cs` | 路由、只读连接、限流与 ProblemDetails |
| `src/Api/Queries.cs` | 参数化 SQL、排名、分布与年度聚合 |
| `src/Api/schema.sql` | 表、约束、版本成员关系、不可变触发器 |
| `src/Api/Seed.cs` | 快照哈希、16 个来源单元格校验与发布 |
| `src/Api/OfficialHistory.cs` | 校验原始来源、幂等导入、发布不可变与只读历史接口 |
| `src/Api/official-schema.sql` | 允许多种官方粒度的独立历史证据模型 |
| `data/official/history.json` | 9,719 条历史证据行、5,299 条近期职业单元格、55 个来源及 16 个州/年度提名条目 |
| `data/official/sources/` | 官方 PDF / HTML 原始快照和 ACT 官方检索文本 |
| `data/official/research-v05/` | 近期 EOI 原始表、完整财年申请量抽取、独立总数、交叉核对与解析器 |
| `docs/DATA_COVERAGE.md` | 统计粒度、已知缺口、冲突与版本说明 |
| `data/verified/manifest.json` | 官方样本来源、时间、哈希和定位 |
| `data/demo/fixture-v*.json` | 明确标记为合成的测试素材 |
| `docs/CONTRACT_ADDENDUM_v1.1.md` | 原说明书的独立契约修订附录 |
| `docs/REBUILD_GUIDE.md` | 从头复建的阶段与交付标准 |
| `docs/ACCEPTANCE.md` | 实际验收及未完成项 |

EF Core 执行 SQL DDL 迁移和参数化查询；PostgreSQL 负责旧接口的排名、百分比和年度总量计算。职业榜从不可变证据包中筛选并排序。近期 EOI 优先显示官方独立发布的职业总数；只在同资料、同期间且所有计数明确公开时汇总分档。历史 FOI 每次只汇总选定单份资料的非重叠 EOI 行，不估算成功率。

## 数据边界

本版保留 9,719 条历史证据行，另接入 5,299 条近期职业单元格，共 55 个来源。`records` 与 `recentActivity` 独立保存；这些条数不是移民人数。近期资料包括：

| 官方资料 | 统计范围 | 职业单元格 | 不同具体职业 | 计数隐藏规则 |
|---|---|---:|---:|---|
| SkillSelect Invited 快照 | 2026-06-30 月末 | 2,809 | 242 | 1–19 条显示 `<20` |
| SkillSelect Invited 快照 | 2026-09-30 月末 | 325 | 88 | 1–19 条显示 `<20` |
| Home Affairs DA26/07/00344 | 2025-07-01 至 2026-06-30，190/州提名491主申请递交 | 2,165 | 372 | 小额显示 `<5` |

Invited 是统计日仍持有邀请的 EOI 状态，不是当月新发邀请，也不是去重人数或获签人数。Nominated State 是申请人填写的州提名意向，不证明该州发出了邀请。分数是快照记录，可能在持邀/递交阶段变化，不一定等于获邀时分数。默认 6 月末是最近完整财年的年末比较点；9 月末最新数据可独立选择。不同月份不能相加。

主申请量是已递交签证申请，原表不含分数。`<20` 与 `<5` 的数值字段保持 null，缺席的职业和空白单元格不补为 0。不用分档减法还原隐藏值；职业和州级总数使用另行取得的官方公开表。

历史 FOI 独立保存：NSW190 全年2019、VIC/QLD/NT/TAS190 的2019-01-01至09-07、五州491的2019年末，合计 6,529 条原始公开 EOI 签证邀请记录，规范化为 5,875 条证据行。原 PDF、逐行抽取、校验报告及可重跑解析器在 `data/official/sources` 和 `data/official/research-v04`。旧发布 v1/v2/v3 分别保留；当前版本为 `official-2026-10-09-v4`。

州级提名量另存`nominations`，计获得州提名的EOI，不并入职业邀请数。旧配额表另行保留。2025–26提名表截至2026-05-31，仅保留官方历史检索正文；2026–27截至2026-07-31，保留原始HTML，小额隐藏值`<5`不当成0。

`GET /api/history?mode=verified_historical` 返回一个不可变历史发布版本；可用 `datasetVersion` 精确选择版本。历史模型保留六位职业、四位职业组、两位职业大类及全职业合计，且独立保存 `pointsBasis`、`countScope`、空值原因和来源。接口返回的记录由前端筛选和分页，不在浏览器计算跨范围总人数。早期 `/top-occupations` 接口仍限于其精确签证契约；不得用它强行拆分 WA 职业记录。

WA 州邀请职业表没有具体职业人数，也未按职业拆分 190 / 491。ACT Matrix 和 TAS 优先属性分不是联邦 EOI 分。SA 州邀请人数通常只到两位职业子大类。八州现有近期六位职业 EOI 快照和主申请量；这些不能替代“州新发邀请轮次 × 职业 × 获邀时分数 × 数量”的完整表，后者本次仍未取得全国同口径资料。具体轮次、冲突与缺口见 `docs/DATA_COVERAGE.md`。

ACT 2026-06-11 原始 PDF 已取得，105 个职业组的 420 个分数单元格与此前抽取逐格核对一致，当前发布指向原 PDF。其余已录入 ACT 轮次仍保留官方检索文本，哈希对应文本而非原 PDF。2025-12-10 的 3129 行四列位置无法可靠恢复，全部保留空值并标记待核对。原始来源随源码保存，种子导入会核验字节哈希。

Demo 仍有七个教学职业候选，分布、排名和修订均为合成示例。真实职业查询使用已录入官方记录，不再受七个示例职业限制。问答先识别并确认范围：配额由旧接口回答，职业问题打开对应官方档案筛选；自由问句仍依赖有限规则，离线预览仅包含已导出的示例。

界面以中文为主，职业名称和官方通道名称保留英文；完整英文界面仍是后续工作。已公开发布静态数据版，完整后端尚未上线，未接入任何个人申请数据。实际浏览器视觉验收和原生 PostgreSQL / Docker 验收尚未执行，自动化结果见 `docs/ACCEPTANCE.md`。地图许可见 `docs/MAP_LICENSE.md`。
