# 站内投稿服务

公开网页仍由 GitHub Pages 托管。两个 Cloudflare Workers 共用一座 D1 数据库：`public.mjs` 接收投稿和私密状态查询；`review.mjs` 提供审核页面并发布到 GitHub。两个 Worker 必须分开部署，只给审核 Worker 配置 GitHub 写入凭证。

## 网络受限时的备用投稿

读者投稿页可选填作品日期、合集和子分类，信息会保存在待审稿件并带入审核表单；合集既可选择已有名称，也可自由填写。留空日期由维护者审核时填写（默认为北京时间的发表日期），分类由维护者确认。预览、会话草稿和备用邮件均保留这些字段，草稿仍不保存联系方式。

主页的“最近更新”和“最近的诗”按实际发表或修改时间排列。审核发表、`/admin` 新建及有效修改、`/poems` 有效修改会在诗歌 JSON 中记录 `publishedAt` / `updatedAt`；未修改内容的保存和排序不重置时间。历史作品缺少记录时使用数字编号中的收录时间，无法恢复过去未记录的修改时间。日期显示使用北京时间，作品本身的日期及目录排序保持原义。直接在 GitHub 修改作品时，应同时维护 `updatedAt`（ISO 时间字符串），否则无法自动识别该次修改。

Cloudflare 官方说明 Turnstile 在中国大陆不受支持，部分读者可能无法完成验证或连接公开 Worker。`submit.html` 在验证失败、超时或提交网络异常时给出明确提示，并始终提供“邮件投稿”备用入口。读者先复制诗题、笔名、正文和自愿填写的联系方式，再由自己的邮箱发至 `zhege712@gmail.com`。邮箱地址会暴露给邮件服务和维护者；**邮件稿不会自动进入 D1 审核箱，不提供站内私密状态链接**，须由维护者在邮箱中手工处理。若提交请求超时，读者应在邮件中说明可能已通过站内表单提交，以免重复收录。备用入口不绕过公开 Worker 的 Turnstile 验证。

参考：<https://developers.cloudflare.com/china-network/faq/#is-turnstile-available-in-mainland-china>

## 部署前准备

1. 确认正式网站地址。两个示例配置中的 `PUBLIC_SITE_URL` 必须是以 `/` 结尾的网站目录，`ALLOWED_ORIGIN` 是其域名的 origin，`PUBLIC_HOSTNAME` 是该域名的 hostname。若正式网站使用自定义域名，三个值要一起改。
2. 在 Cloudflare 创建 D1 数据库 `poem-submissions`，用 `schema.sql` 初始化。两个 Wrangler 配置填写同一个数据库 ID。
3. 在 Cloudflare Turnstile 创建用于正式网站 hostname 的 widget。将 **site key** 填入网站的 `submission-config.js`；将 **secret key** 只设为公开 Worker 的 `TURNSTILE_SECRET` Secret。
4. 为公开 Worker 增加随机的 `RATE_SECRET` Secret，用于对访问来源计算不可逆的限流标识。不要把 Secret 写进配置文件或网页。
5. 创建只允许指定仓库、具有 Contents 写入权限的 GitHub fine-grained token，把它设为审核 Worker 的 `GITHUB_TOKEN` Secret。当前令牌预计在 2027-03-27 到期；到期前在 GitHub 更新令牌，并替换审核 Worker 中的 Secret，否则审核页面仍可登录，但发表操作会失败。`REVIEWER_EMAILS` 填维护者邮箱，多个邮箱用逗号隔开。
6. 免绑卡审核登录：在 GitHub 的 Developer settings → OAuth Apps 创建应用。主页填正式网站地址；回调地址精确填写 `https://poem-submissions-review.zhege712-872.workers.dev/auth/callback`；不要启用通配符回调或 Device Flow。将公开的 Client ID 填入审核 Worker 配置的 `GITHUB_OAUTH_CLIENT_ID`，把 Client Secret 设为审核 Worker 的 `GITHUB_OAUTH_SECRET` Secret，并生成随机 32 字节以上的 `SESSION_SECRET` Secret。`REVIEW_AUTH = "github"` 时，Worker 仅接受 GitHub 返回的已验证邮箱与 `REVIEWER_EMAILS` 精确匹配的账号。OAuth 令牌只用于当次核对邮箱，不写入数据库或浏览器；审核登录 Cookie 有效 8 小时。配置不完整时审核 Worker 拒绝访问。
   日后若改用 Cloudflare Access，可将 `REVIEW_AUTH` 改为 `access`，为**整个审核 Worker 的正式和预览地址**启用 Access，并只允许审核邮箱。数据库和投稿入口无需迁移。公开 Worker 不要启用 Access。
7. 两个 Worker 部署后，将公开 Worker 的 HTTPS 地址填入 `submission-config.js` 的 `apiBase`，然后再发布网站页面。该文件只包含公开 URL 和 site key，不得包含任何 Secret。

可以使用 Wrangler CLI 和示例配置部署，无需向本网站添加 `package.json`：

```text
wrangler d1 create poem-submissions
wrangler d1 execute poem-submissions --remote --file schema.sql
wrangler secret put TURNSTILE_SECRET --config wrangler.public.toml
wrangler secret put RATE_SECRET --config wrangler.public.toml
wrangler secret put GITHUB_TOKEN --config wrangler.review.toml
wrangler secret put GITHUB_OAUTH_SECRET --config wrangler.review.toml
wrangler secret put SESSION_SECRET --config wrangler.review.toml
wrangler deploy --config wrangler.public.toml
wrangler deploy --config wrangler.review.toml
```

本项目已为 `zhege712-crypto.github.io/Poem_Ulysses/` 准备好两个 `.toml` 配置，并填入实际 D1 数据库 ID 与审核邮箱；`.example` 文件保留为新环境模板。不要将密钥写入配置文件或提交到仓库。审核入口为审核 Worker 的根路径 `/`。

若在 Cloudflare 控制台通过“Add variable and deploy”保存 Secret，随后要从本目录再次执行对应的 `wrangler deploy --config ...`。控制台发布的新版本可能使用旧代码或遗漏 Wrangler 文件中的公开变量；重新部署后用 `wrangler secret list --config ...` 只读核对 Secret 名称。

当前云端已创建 `poem-submissions` D1 数据库并执行 `schema.sql`，Turnstile widget 已限制为 `zhege712-crypto.github.io`。两个 Worker 均已部署；审核 Worker 已切换到免绑卡登录代码，Client ID 已配置，`SESSION_SECRET`、`GITHUB_OAUTH_SECRET`、`GITHUB_TOKEN` 均已设置，GitHub 登录已由维护者验证。公开 Worker 已设置随机 `RATE_SECRET` 和 `TURNSTILE_SECRET`，公开服务地址与 site key 已写入 `submission-config.js`。仍需发布网页改动，并完成正式环境验收。

## 安全与数据规则

- 公开投稿接口只有新增投稿、查询状态和撤稿能力；没有 GitHub 凭证或发布接口。私密查询令牌是 32 字节随机值，数据库只保存其 SHA-256 摘要，查询令牌放在状态页 URL 的 fragment 中。
- 服务端验证 Turnstile 结果和预期 hostname，并按来源每天、每小时限流。`Origin` 检查只用于降低跨站滥用，不能代替 Turnstile 或认证。
- 审核 Worker 使用 GitHub OAuth 验证已确认的维护者邮箱，登录 Cookie 设置 `HttpOnly`、`Secure`、`SameSite=Lax` 且有签名与到期时间。OAuth 回调核对随机 `state`。审核页面不加载第三方脚本；发布凭证仅存在 Worker Secret 中。
- 所有待审数据只存 D1。拒绝或撤回 30 天后删除；超过 180 天仍未处理的稿件删除；发表后 30 天清空待审库中的正文副本、内部备注和联系方式。撤回时立即清空正文和联系方式。Cloudflare 的数据库恢复历史可能在删除后继续保留一段时间。
- 发表操作记录来源投稿 ID，重试时检测已发表作品，避免重复发表。诗歌和新作者写入两个 GitHub 文件，遇到中间失败时保留稿件以便重试。
- 公开的 `admin.html` 只负责跳转到审核 Worker 的 `/admin`。受保护后台与审核页面共用账号登录，可维护诗歌、作者资料和漂流日志；所有 GitHub 写入都由审核 Worker 的 Secret 完成。漂流地点坐标填写 WGS84 经纬度。

## 已发表诗歌的修改

审核 Worker 的 `/poems` 是已发表诗歌管理页，沿用审核页的登录验证。可以从审核页的“管理已发表诗歌”进入，搜索作品并修改标题、发表笔名、日期、系列、子系列、正文和配图；作者的姓名、别名、简介、标签与 HTTPS 链接在同页单独保存。新作者可在此建立资料。修改直接写回 GitHub 的 `data/poems.json` 与 `data/authors.json`，以文件 SHA 检查并发修改；页面不接收或保存 GitHub Token。配图上传会立即写入公开仓库，随后还需点击“保存诗歌”才能让作品引用它；“移除”仅去掉引用，不删除仓库中的图片。

旧 `admin.html` 若提示 `HTTP 401: Bad credentials`，是它当前输入的浏览器 GitHub Token 无效。新版本会直接跳转到受保护的 `/admin`，不再向浏览器索要 Token。`/poems` 适合修改单篇已发表诗歌，`/admin` 还支持新建与删除诗歌、作者，以及管理漂流日志。正式使用前需部署新的审核 Worker 并发布网页中的跳转页；本地修改本身不会改变线上页面。

## 稳定合作伙伴

普通匿名投稿继续使用现有流程。`partners.html` 跳转到审核 Worker 的 `/partners`：Google 登录后申请，由维护者在 `/collaborators` 核实身份、绑定固定作者 ID，并逐篇选择可管理的历史作品。相同笔名不会自动取得权限。一个作者资料只绑定一个账号；暂停权限会撤销其所有合作登录会话。

合作伙伴可建立/删除未送审草稿，修改自己的待审稿件、查看最近 10 个保存版本、撤回待审投稿，维护自己的作者简介、标签和 HTTPS 链接。笔名、别名与归属仍由维护者确认；配图由维护者在作品管理后台处理。账号标识采用 Google 的不可变 `sub`，邮箱不作为归属依据。

已发表作品只允许保存修订草稿或提交修订请求。维护者在 `/revisions` 对照申请时的公开版本和提议版本，批准后才更新原诗歌 ID。版本号、投稿时间戳、逐诗内容哈希及 GitHub 文件 SHA 一起阻止覆盖并发修改；公开作品发生变动时，作者须明确更新对照并重送修订。修订重试使用操作标记避免重复写入。作品作者归属改变后原账号编辑被阻止，需维护者核实。Google 会话不赋予维护者 GitHub 审核权限。

### 首次启用

1. Google Auth Platform 创建 Web OAuth 客户端，回调 URI 精确为 `https://poem-submissions-review.zhege712-872.workers.dev/partner-auth/callback`；JavaScript 来源可以留空。仅请求 `openid email`。应用首页为本站、隐私说明为本站 `privacy.html`。
2. 设置 `GOOGLE_CLIENT_ID` 普通变量、`GOOGLE_CLIENT_SECRET` Secret、`PARTNER_BASE_URL` 固定 HTTPS 根地址。不要提交客户端密钥或 Google 下载的凭证 JSON。既有 `SESSION_SECRET` 继续使用，合作会话以独立随机凭证及数据库哈希保存，不和维护者 Cookie 混用。
3. **先执行增加表的迁移，再部署审核 Worker**：

```text
wrangler d1 execute poem-submissions --remote --file submissions/partners-schema.sql --config submissions/wrangler.review.toml
wrangler deploy --config submissions/wrangler.review.toml
node --test submissions/partners.test.mjs submissions/workers.test.mjs submissions/review-published.test.mjs
```

迁移只增加表/索引，不修改现有投稿和查询权限；可重复执行。回退到旧 Worker 代码时保留这些表，不删除真实账号/稿件。合作工作台不含第三方脚本，登录短暂使用的 Google 访问令牌不入库。登录状态值单次使用；会话最长 7 天，最多 20 个同时存在的账号会话。每日任务清理过期会话、验证状态、访问计数，以及结束 30 天后的修订正文和历史副本；原投稿被清理后也清理合作账号中的投稿副本。未送审草稿保留到本人删除或联系维护者删除，账号删除也由维护者核实后处理。

Google 应用若仍为 Testing，只有添加的测试账号可使用；要让其他合作伙伴登录，需在 Google Auth Platform 的“目标对象”发布应用。基本登录权限不读取邮件/云盘。Google 登录仍依赖读者可访问 Google；无法访问时保留普通/邮件投稿。

### 合作账号验收

- 未登录只能看到登录/申请说明；Google 登录后仍须申请并获批才能新建稿件。
- 维护者选择固定作者且只关联勾选的作品；可以之后补选历史作品。
- 检查两个合作账号不能互相读取草稿、改作者资料或编辑别人的作品。
- 作者送审后修改，待审内容更新；维护者停留在旧页面的保存、发表、未采用操作都应拒绝。
- 修订批准前公开内容保持原样；批准后保留作者、配图、原 ID 和额外字段，并更新时间。
- 暂停账号后其已有会话失效；发生开通中断时等待五分钟，可在合作伙伴页恢复申请后重试。
- `partners-fixture.mjs` 和 `partners.test.mjs` 是本地合成测试，不从 Worker 入口导入；部署包不包含 Node SQLite 或测试授权。

## 原有投稿验收

1. 未配置的网站表单必须显示“投稿服务准备中”，不能假装投稿成功。
2. 用手机和电脑各提交一篇测试稿；确认未审核时它不在诗歌目录里。
3. 保存状态链接，在另一浏览器中检查状态；确认链接不展示联系方式或正文。
4. 用非维护者邮箱访问审核 Worker，确认无法打开待审列表；检查预览地址也受保护。
5. 在审核页修改并发布测试稿；确认目录、阅读页和作者页能找到作品，重复点击不会产生第二首。
6. 提交后撤回另一篇测试稿；确认无法再发布；验证防刷失败、限流和网络错误提示。
7. 确认公开 `admin.html` 只跳转到受保护后台，未登录或非维护者无法操作 `/admin` 与其 API；浏览器页面及本地存储均无 GitHub Token。
