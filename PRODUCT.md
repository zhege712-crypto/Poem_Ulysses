# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

静态 HTML/CSS/JS（纯前端，无构建步骤、无包管理器、无框架）。部署于 GitHub Pages（`zhege712-crypto/Poem_Ulysses`）。数据层为单一 JSON 文件 `data/poems.json`。

## Users

核心用户是**诗社/社团内部群体**：成员创作并投稿诗歌，集体在平台上展示与阅读作品。读者/访客浏览欣赏是次要受众。非公开商业产品，属内部作品集展示性质。

## Product Purpose

「诗歌漂流 (Poem's Ulysses)」是一个多作者公共诗集平台。让社团成员创作的诗歌被收集、展示、阅读。成功意味着：成员的作品被有序收录，内部读者能舒适地浏览阅读，社区持续产生与沉淀诗歌。

## Positioning

多作者公共诗集 —— 由伞 umbrella 旗下多位作者共同创作、经统一维护流程汇总成册的开放诗集，而非单一作者的私人博客。

## Operating Context

- 访问者浏览首页、目录、阅读页、作者页、漂流地图、关于页及站内投稿页；投稿后可凭私密链接查看状态或在审核前撤回。
- 阅读页按「系列 → 日期」排序提供上一篇/下一篇导航、随机换一首、Giscus 评论（GitHub Discussions 集成，主题变化通过 postMessage 转发到 iframe）。
- 图片以灰度展示，点击打开全彩灯箱，Esc/点击外部关闭。
- 旧后台 (`admin.html`) 通过 GitHub API 管理诗歌、作者和漂流日志，Token 只保留在当前页面内存中，不再持久保存。新的投稿审核服务使用 GitHub OAuth 核对维护者已验证邮箱，发布凭证仅放在服务端 Secret 中；读者投稿不需要 GitHub。
- 三套主题（浅色 / 深色 / 护眼）通过 `<html>` 的 `data-theme` 属性切换，选择存于 `localStorage`。

## Capabilities and Constraints

- 已发表诗歌由 `data/poems.json` 提供，目前含 30 首；待审投稿保存在独立 D1 数据库，审核前不进入公开数据文件。
- 诗歌按「系列 → 日期」排序，所有消费数据的页面遵循此约定。
- 首页有 Intro 动画，尊重 `sessionStorage` 避免重播、支持 `prefers-reduced-motion`、`?preview=1` 可冻结到末帧。
- 目录页提供列表/树状双视图、搜索、随机诗。
- 站内投稿服务代码已准备，D1 与 Turnstile 控件已创建；仍需配置 Turnstile 私钥、GitHub OAuth 应用与发布凭证，并完成线上验收后才能开放投稿；配置步骤见 `submissions/README.md`。
- 无自动测试、无 CI；本地预览用任意静态服务器（如 `python -m http.server`）。
- 尚未决定是否记录绑定性的视觉约束。

## Brand Commitments

产品名「诗歌漂流 (Poem's Ulysses)」，隶属「伞 umbrella」站点家族，与母站「伞 umbrella」互为友链。新投稿流程在站内完成；阅读页评论仍使用 Giscus / GitHub Discussions。

视觉方向（2026-08 确立）：**米色苏维埃（beige Soviet）** 已作为同志们页（`authors.html`）的品牌主题——克制、高端简约、不热烈；以米纸为底、暗红铁锈为骨、暖金点缀，配套光栅火炬与西里尔标记。是否推广到全站**尚未决定**（当前仅限同志们页）。视觉语言的整体品牌绑定仍未最终敲定。

## Evidence on Hand

- 数据：`data/poems.json`（30 首诗歌，多作者，五个系列：天一篇 / 匡园篇 / 洛社篇 / 最初的序列 / 拾遗记）。
- 设计预览截图：`_preview_shots/`（非生产资产）。
- 工作日志：`workfoots/deepseek_txt_20260801_8f32de.txt`、`工作足迹_20260801.md`。
- 投稿流程：`submit.html` → 私有待审箱 → 受保护的审核页 → `data/poems.json` / `data/authors.json`；部署前投稿按钮保持禁用状态。

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
- 未记录强制遵循的无障碍标准。
