# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

公共站点使用静态 HTML/CSS/JS（无构建步骤、无包管理器、无框架），部署于 GitHub Pages（`zhege712-crypto/Poem_Ulysses`）。公开诗歌由 `data/poems.json` 提供，作者资料由 `data/authors.json` 提供；独立 Cloudflare Workers/D1 服务承载私人投稿、审核与合作账号。

## Users

核心用户是**诗社/社团内部群体**：成员创作并投稿诗歌，集体在平台上展示与阅读作品。稳定合作伙伴经维护者核实后，用一个账号管理自己的诗稿与作者资料；维护者管理账号归属、投稿审核与发表修订。读者/访客浏览欣赏是次要受众。非公开商业产品，属内部作品集展示性质。

## Product Purpose

「诗歌漂流 (Poem's Ulysses)」是一个多作者公共诗集平台。让社团成员创作的诗歌被收集、展示、阅读。成功意味着：成员的作品被有序收录，内部读者能舒适地浏览阅读，社区持续产生与沉淀诗歌。

## Positioning

多作者公共诗集 —— 由伞 umbrella 旗下多位作者共同创作、经统一维护流程汇总成册的开放诗集，而非单一作者的私人博客。

## Operating Context

- 访问者浏览首页、目录、阅读页、作者页、漂流地图、关于页及站内投稿页；投稿后可凭私密链接查看状态或在审核前撤回。
- 阅读页按「系列 → 日期」排序提供上一篇/下一篇导航、随机换一首、Giscus 评论（GitHub Discussions 集成，主题变化通过 postMessage 转发到 iframe）。
- 图片以灰度展示，点击打开全彩灯箱，Esc/点击外部关闭。
- `admin.html` 跳转到受保护的 Worker 作品管理页，通过服务端 GitHub API 管理诗歌、作者和漂流日志。维护者使用 GitHub OAuth 核对已验证邮箱，发布凭证仅放在服务端 Secret 中；读者投稿不需要 GitHub。
- `submit.html` 提供稳定合作伙伴入口，`partners.html` 跳转至审核 Worker 的 `/partners`。合作伙伴使用独立 Google 登录申请；维护者在 `/collaborators` 核实身份、绑定固定作者 ID 并逐篇关联历史作品。笔名相同不会自动授予权限，Google 会话不会授予维护者权限。
- 合作工作台汇集草稿、送审稿、已发表作品及修订状态。作者简介、标签和 HTTPS 个人链接可由本人保存并公开；笔名、别名、作品归属及配图由维护者处理。已发表作品的修改须在 `/revisions` 对照审核后才更新公开版本。
- 三套主题（浅色 / 深色 / 护眼）通过 `<html>` 的 `data-theme` 属性切换，选择存于 `localStorage`。

## Capabilities and Constraints

- 已发表诗歌由 `data/poems.json` 提供，目前含 30 首；待审投稿保存在独立 D1 数据库，审核前不进入公开数据文件。
- 诗歌按「系列 → 日期」排序，所有消费数据的页面遵循此约定。
- 首页有 Intro 动画，尊重 `sessionStorage` 避免重播、支持 `prefers-reduced-motion`、`?preview=1` 可冻结到末帧。
- 目录页提供列表/树状双视图、搜索、随机诗。
- 站内投稿与维护者 GitHub 登录已部署，读者提交、查询、撤回及审核列表已完成线上验收；免登录投稿与邮件备用方式继续保留。配置步骤见 `submissions/README.md`。
- 合作伙伴实现包括未送审草稿新建/删除、待审稿修改与撤回、最近 10 个保存版本、公开作品修订申请及作者资料维护。版本号、投稿时间戳、公开作品内容哈希和 GitHub 文件 SHA 防止并发覆盖；未保存输入有离开确认，保存失败后保留输入供核对或备份。
- 合作功能已通过本地合成测试（本轮 38 项）与界面完成评审，新增表及审核 Worker 已部署，Google 登录入口和未登录权限拦截已检查；真实 Google 登录与账号审批仍待人工验收。配置与验收步骤见 `submissions/README.md`。
- 投稿与合作服务已有 Node 自动测试；公共静态页面本地预览用任意静态服务器（如 `python -m http.server`）。
- 尚未决定是否记录绑定性的视觉约束。

## Brand Commitments

产品名「诗歌漂流 (Poem's Ulysses)」，隶属「伞 umbrella」站点家族，与母站「伞 umbrella」互为友链。新投稿流程在站内完成；阅读页评论仍使用 Giscus / GitHub Discussions。

视觉方向（2026-08 确立）：**米色苏维埃（beige Soviet）** 已作为同志们页（`authors.html`）的品牌主题——克制、高端简约、不热烈；以米纸为底、暗红铁锈为骨、暖金点缀，配套光栅火炬与西里尔标记。是否推广到全站**尚未决定**（当前仅限同志们页）。视觉语言的整体品牌绑定仍未最终敲定。

## Evidence on Hand

- 数据：`data/poems.json`（30 首诗歌，多作者，五个系列：天一篇 / 匡园篇 / 洛社篇 / 最初的序列 / 拾遗记）。
- 设计预览截图：`_preview_shots/`（非生产资产）。
- 工作日志：`workfoots/deepseek_txt_20260801_8f32de.txt`、`工作足迹_20260801.md`。
- 投稿流程：`submit.html` → 私有待审箱 → 受保护的审核页 → `data/poems.json` / `data/authors.json`；部署前投稿按钮保持禁用状态。
- 合作实现：`submissions/partner-ui.mjs`、`submissions/partners.mjs`、`submissions/partner-auth.mjs`、`submissions/partners-schema.sql`；测试和部署说明见 `submissions/README.md`。`privacy.html` 说明登录权限、私人稿件、公开资料、版本保留和删除联系流程。

## Product Principles

1. 以诗歌本身为内容核心，阅读体验优先于界面表现。
2. 维护成本最低：单 JSON 数据文件 + 静态部署，保持无构建、无框架的轻量结构。
3. 遵循「系列 → 日期」的统一排序与目录约定，保证跨页面一致。
4. 支持投稿—审核—发布闭环，投稿人无需 GitHub 账号，维护者保留发表决定权。
5. 尊重无障碍与设备差异：支持三主题、`prefers-reduced-motion`、响应式断点。

## Accessibility & Inclusion

- 支持 `prefers-reduced-motion`（首页 Intro 动画降级）。
- 三套主题（浅 / 深 / 护眼）兼顾阅读场景与视觉偏好。
- 响应式布局（640px / 820px 断点）适配不同屏幕。
- 受保护合作工作台在 760px 及以下将列表、编辑器和修订对照堆叠；可见焦点环、明确字段标签和局部 `aria-live` 反馈支持键盘操作与状态读取。
- 未记录强制遵循的无障碍标准。
