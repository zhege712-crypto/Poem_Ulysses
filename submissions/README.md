# 站内投稿服务

公开网页仍由 GitHub Pages 托管。两个 Cloudflare Workers 共用一座 D1 数据库：`public.mjs` 接收投稿和私密状态查询；`review.mjs` 提供审核页面并发布到 GitHub。两个 Worker 必须分开部署，只给审核 Worker 配置 GitHub 写入凭证。

## 网络受限时的备用投稿

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
- 旧 `admin.html` 已停止持久保存 GitHub Token，并移除与 Token 同页运行的第三方地图脚本；编辑漂流地点时手动填写 WGS84 经纬度。它仍是旧版浏览器直连 GitHub 的维护工具。长期应把剩余的作者、日志和诗歌管理操作逐步迁入受保护的 Worker。

## 发布前手动验收

1. 未配置的网站表单必须显示“投稿服务准备中”，不能假装投稿成功。
2. 用手机和电脑各提交一篇测试稿；确认未审核时它不在诗歌目录里。
3. 保存状态链接，在另一浏览器中检查状态；确认链接不展示联系方式或正文。
4. 用非维护者邮箱访问审核 Worker，确认无法打开待审列表；检查预览地址也受保护。
5. 在审核页修改并发布测试稿；确认目录、阅读页和作者页能找到作品，重复点击不会产生第二首。
6. 提交后撤回另一篇测试稿；确认无法再发布；验证防刷失败、限流和网络错误提示。
7. 审核通过后撤销旧 GitHub token，并确认旧 `admin.html` 不再从浏览器本地存储恢复凭证。
