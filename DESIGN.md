---
name: Poem's Ulysses (诗歌漂流)
description: 多作者公共诗集 —— 纸舟夜航，金石为骨，纸帛为肤
colors:
  ivory-paper: "#F7F5F0"
  paper-dark: "#EDE9E2"
  ink: "#2C2A28"
  ink-light: "#5A554E"
  ink-faded: "#99948D"
  gold: "#D4B896"
  gold-light: "#E8E2D8"
  clay: "#B85C3A"
  white: "#FFFFFF"
  success-ink: "#2B6B3A"
  success-bg: "#E6F2E8"
  err-bg: "#F7E6E6"
  dark-paper: "#1E1E1C"
  dark-ink: "#ECECE5"
  dark-gold: "#D4A373"
  dark-clay: "#E55A5F"
  eye-paper: "#ECF3E5"
  eye-ink: "#3A4632"
  eye-gold: "#BDA26C"
  eye-clay: "#B2674F"
typography:
  scale:
    micro: "0.5rem"
    micro-mid: "0.52rem"
    tiny: "0.55rem"
    tiny-mid: "0.58rem"
    xsmall: "0.6rem"
    xs-mid: "0.65rem"
    small: "0.7rem"
    sm-mid: "0.75rem"
    base: "0.85rem"
    base-close: "0.8rem"
    base-mid: "0.88rem"
    base-md: "0.92rem"
    base-sm: "0.9rem"
    base-lg: "0.95rem"
    base-xl: "0.98rem"
    md: "1.02rem"
    md-close: "1.05rem"
    md-lg: "1.1rem"
    lg: "1.2rem"
    lg-close: "1.15rem"
    xl: "1.25rem"
    xl-mid: "1.3rem"
    num: "1.7rem"
    heading: "1.8rem"
    hero-md: "1.9rem"
    hero-close: "2.3rem"
    hero: "3rem"
  display:
    fontFamily: "Cormorant Garamond, Noto Serif SC, serif"
    fontSize: "clamp(2.4rem, 6vw, 4.4rem)"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "0.04em"
  headline:
    fontFamily: "Cormorant Garamond, Noto Serif SC, serif"
    fontSize: "clamp(1.6rem, 4vw, 2.4rem)"
    fontWeight: 400
    lineHeight: 1.2
  poem-title:
    fontFamily: "Cormorant Garamond, Noto Serif SC, serif"
    fontSize: "clamp(1.8rem, 5vw, 2.6rem)"
    fontWeight: 400
    lineHeight: 1.2
  body:
    fontFamily: "Inter, Noto Sans SC, sans-serif"
    fontSize: "1.02rem"
    fontWeight: 300
    lineHeight: 1.8
  poem:
    fontFamily: "Kaiti SC, STKaiti, KaiTi, Noto Serif SC, serif"
    fontSize: "1.06rem"
    fontWeight: 400
    lineHeight: 2.15
    letterSpacing: "0.02em"
  label:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.6rem"
    fontWeight: 300
    letterSpacing: "0.15em"
    textTransform: "uppercase"
rounded:
  hairline: "1px"
  input: "8px"
  stamp: "10px"
  md: "12px"
  stamp-lg: "16px"
  panel: "24px"
  pill: "999px"
spacing:
  section: "80px"
  inset: "28px"
  row-gap: "16px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ivory-paper}"
    rounded: "{rounded.pill}"
    padding: "12px 26px"
  button-primary-hover:
    backgroundColor: "{colors.clay}"
    textColor: "{colors.ivory-paper}"
    rounded: "{rounded.pill}"
    padding: "12px 26px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "12px 26px"
  button-outline-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ivory-paper}"
    rounded: "{rounded.pill}"
    padding: "12px 26px"
  button-gold:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "12px 26px"
  button-gold-hover:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ivory-paper}"
    rounded: "{rounded.pill}"
    padding: "12px 26px"
  nav-link:
    textColor: "{colors.ink-faded}"
    rounded: "{rounded.pill}"
  search-input:
    backgroundColor: "{colors.ivory-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "11px 16px"
  input:
    backgroundColor: "{colors.ivory-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
    padding: "10px 12px"
---

# Design System: Poem's Ulysses (诗歌漂流)

## Overview

**Creative North Star: "纸舟夜航 (Paper Vessel, Night Sailing)"**

一座以纸为舟、在夜色与波光中航行的诗集。系统建立在「金石为骨，纸帛为肤」的双重质感上：纸帛——象牙纸底、细腻的纸色分层与温润的衬线字体，构成整个界面的皮肤；金石——鎏金点缀、墨色实心按钮与希腊回纹，构成庄重的骨架。整体气质克制、温润而沉静，像一本摊开在灯下的手抄诗卷，让诗歌本身安静地被阅读。

密度轻盈、留白充裕，正文以衬线与楷体承载中文诗行。深度几乎不靠投影表达——默认平底，层级由玻璃拟态（backdrop-blur）、1px 鎏金/浅金描边与纸色深浅交替共同完成，仅交互激活态用金色焦点环呼应。三套主题（日间 / 夜间 / 护眼）通过 `<html>` 的 `data-theme` 属性切换同一组语义变量，保证多作者诗集跨页一致。

**Key Characteristics:**
- 纸舟夜航：纸帛皮肤 + 夜色航行意象，金石为骨、纸帛为肤
- 玻璃拟态：header、胶囊、统计条、主题栏以 backdrop-blur + 半透明纸色悬浮
- 鎏金细线：1px 金色描边、希腊回纹、金色下划线 hover，是唯一的重音
- 克制温润：pill 胶囊按钮、衬线标题 + 楷体诗行 + 等宽标签的字体三重奏
- 三主题一套语义：日间 / 夜间 / 护眼共享变量名，仅换色值

## Colors

整体是一套暖调纸墨系：象牙纸底承载墨色文字，鎏金与陶土点缀，低饱和、高温暖。所有颜色以 CSS 自定义属性定义于 `:root`（及 `[data-theme]`），组件一律通过 `var(--*)` 引用，禁用硬编码色值。

### Primary
- **鎏金 (Gold)** (#D4B896): 唯一的金色重音。用于关键装饰——希腊回纹、logo 点缀、下划线 hover、激活态底色、金色描边按钮、诗篇起始符 ‖。有浅色变体 **浅鎏金 (Gold Light)** (#E8E2D8) 作描边、分隔线与玻璃栏边框。
- **陶土 (Clay)** (#B85C3A): 陶土红棕，悬停与强调的次重音。按钮 hover、目录系列名、诗题 hover、警示与删除态。

### Neutral
- **象牙纸 (Ivory Paper)** (#F7F5F0): 主背景，纸帛皮肤。**浅纸 (Paper Dark)** (#EDE9E2) 作次级区块背景、hover 底色、注释卡片。
- **宿墨 (Ink)** (#2C2A28): 主文字与主按钮实心底，暖黑而非纯黑。**淡墨 (Ink Light)** (#5A554E) 作次级文字、元信息。**残墨 (Ink Faded)** (#99948D) 作辅助文字、nav 默认色、占位。
- **选中色**：`::selection` 为鎏金底 + 白字。

### Named Rules
**The 鎏金稀用 Rule.** 鎏金只在需要强调的地方出现（一条线、一个徽章、一个 hover）。它的稀有正是它身为重音的力量，绝不铺满。

**The 一纸一墨 Rule.** 文字只用宿墨系（ink / ink-light / ink-faded），背景只用象牙纸系（paper / paper-dark）与玻璃纸。任何新色都须能归入「纸、墨、金、陶」四类之一，否则不加入系统。

## Typography

**Display Font:** Cormorant Garamond（衬线，回退 Noto Serif SC / serif）
**Body Font:** Inter（无衬线，回退 Noto Sans SC / sans-serif）
**Label/Mono Font:** JetBrains Mono（等宽）
**Poem Font:** Kaiti SC（楷体，回退 STKaiti / KaiTi / Noto Serif SC）

**Character:** 衬线大标题的典雅、楷体诗行的书卷气、等宽小标签的克制，三者并置构成「金石衬骨、纸帛承墨」的字体三重奏。衬线与楷体承载中文的韵律，等宽体只服务元信息与导航。

### Hierarchy
- **Display** (400, clamp(2.4rem, 6vw, 4.4rem), 1.15): 首页主标题。可加 `em` 斜体并以鎏金着色点缀单字。
- **Headline** (400, clamp(1.6rem, 4vw, 2.4rem), 1.2): 页面主标题（目录、阅读页诗题）。
- **Title** (300, ~1.05–1.2rem, 1.2): 区块标题、系列名、诗题行。系列名用陶土色。
- **Body** (300, 1.02rem, 1.8): 正文、描述。正文最大行宽约 420–640px，`text-wrap: pretty`。
- **Poem** (400, 1.06rem, 2.15): 楷体诗行，`white-space: pre-line` 保留换行，`letter-spacing 0.02em`。诗行前的 ‖ 鎏金起始符沿用。
- **Label** (300, 0.55–0.7rem, 字距 0.08–0.25em): 等宽大写标签。导航、元信息、按钮、页码。字距越大事越「仪式化」：hero-eyebrow 用 0.25em，普通标签 0.08–0.15em。

### Named Rules
**The 等宽眉题 Rule.** 所有等宽元素（导航、标签、元信息、按钮）保持字距 ≥0.08em 且默认大写，区分于正文的中文书卷感；它是界面的「机器语言」，只谈事实不谈情绪。

## Layout

容器 `.wrap` 由 `--maxw` 控制（首页 820px，阅读页 720px，导航 960px），水平内边距 28px。内容宽度优先给阅读：阅读页收窄至 720px 以保证诗行舒适。栅格以 flex 为主，偶用 grid（如目录行 `80px 1fr auto` 的日期/标题/箭头三栏）。

垂直节奏：区块内边距常用 40–130px（hero 顶部 130px 居中），区块间隔 60–80px，列表行间隔 12–16px。元素间距以 8 的倍数为主（8 / 10 / 14 / 16 / 20 / 26 / 30 / 36）。

响应式：使用 `clamp()` 弹性字号与宽度；断点 640px（导航换行收拢）、820px（侧边主题栏右移收窄）。`prefers-reduced-motion: reduce` 下禁用入场动画。

## Elevation & Depth

系统**默认平底**——不用投射阴影表达高度。深度由三层语言共同完成：

1. **玻璃拟态（Glassmorphism）**：`backdrop-filter: blur(12–18px) saturate(160%)` + 半透明纸色底（如 `rgba(247,245,240,0.72)`），用于导航、统计条、视图切换、侧边主题栏、密码遮罩。它是「层」的主要载体。
2. **1px 鎏金描边**：`border: 1px solid var(--gold-light)` 界定卡片、胶囊、输入框、header 底边的边界。
3. **纸色深浅分层**：`paper` 与 `paper-dark` 交替作为区块与 hover 底色，构成无投影的层次。

唯一的「阴影」是**金色焦点环**（focus ring），用于交互反馈而非高度：激活主题钮 `0 0 0 1.5px`、搜索框 focus `0 0 0 3px` 金色半透明环。

### Named Rules
**The 平底默认 Rule.** 表面在静止时保持平坦，无投影。深度只由玻璃模糊、鎏金描边与纸色分层表达；阴影只以金色焦点环的形式出现在交互反馈上。

## Shapes

形态语言以**全圆角的胶囊（pill）与温和圆角**为主：胶囊（999px）用于按钮、导航项、主题钮、徽章、视图切换；中圆角（12px）用于列表行、卡片、搜索框；输入框用 8px。角越圆，交互感越亲和；装饰性希腊回纹则以直线几何提供金石骨架的对比。

**希腊回纹（Meander）**是签名几何：以 SVG pattern（`M0 10 V0 H10 V10 H20`）渲染成细金线带，用作首页开幕框与章节分隔符。分隔线常见两种：短金横线（60–104px）与完整的希腊回纹带（104px）。

## Components

组件全部为玻璃 / 鎏金描边 / 胶囊的家族。同一组件跨五页（index / directory / read / about / admin）保持完全一致的结构与配色。

### Buttons
- **Shape:** 全圆角胶囊（pill，999px），等宽大写标签，字距 0.08em，内边距 12px 26px。
- **Primary:** 宿墨实心底 + 象牙纸字（`button-primary`）；hover 变陶土底。
- **Outline:** 透明底 + 鎏金浅描边 + 宿墨字；hover 反转为宿墨底白字。
- **Gold:** 透明底 + 鎏金描边；hover 填鎏金底白字。
- **Disabled:** 淡墨底、not-allowed。
- **Focus:** 金色焦点环 `0 0 0 3px` 金色半透明。

### Inputs / Fields（admin、directory 搜索）
- **Style:** 1px 鎏金浅描边 + 象牙纸底 + 8px 圆角，正文 300 字重。
- **Focus:** 无 outline，描边变鎏金 + 金色焦点环。
- **Search box:** 左侧内嵌放大镜图标，左侧内边距 38px；focus 同焦点环。

### Cards / Containers
- **Corner Style:** 中圆角（12px）或胶囊（徽章、统计条）。
- **Background:** 象牙纸 / 浅纸 / 玻璃纸（blur 半透明）。
- **Shadow Strategy:** 平底默认，无投影（见 Elevation）。
- **Border:** 1px 鎏金浅描边。
- **Internal Padding:** 12–30px 视内容密度。

### Navigation
- 顶部 header，玻璃拟态 + 浅鎏金底边。logo 用衬线 + 鎏金点缀「漂」，nav 用等宽小字。
- 默认 nav 为残墨色；hover / active 变宿墨 + 底部鎏金线从 0 展开至 100%（`width 0 → 100%`）。
- 侧边主题栏：竖直胶囊组，三个主题钮（日/夜/护眼）间以 1.5px 鎏金竖线分隔；激活钮填鎏金底白字。

### List / Catalog Row
- 目录行三栏 grid（`80px 1fr auto`：日期 / 标题+作者 / 箭头），底部分鎏金浅描边。
- hover：底色变浅纸、行左移 padding、诗题变陶土、底部鎏金线展开。
- 系列名以陶土衬线呈现；子系列以等宽胶囊徽章 + 金色圆点开头。

### Status（admin）
- 成功（浅绿底 `#E6F2E8` / 深绿字 `#2B6B3A`）、错误（浅粉底 `#F7E6E6` / 陶土字）、加载（浅鎏金底 / 淡墨字）。错误可加陶土左边框警示。这些反馈色仅用于后台操作结果提示。

## Do's and Don'ts

### Do:
- **Do** 所有颜色通过 `var(--*)` 语义变量引用，从不硬编码色值；新增样式时先确认归入「纸 / 墨 / 金 / 陶」四类。
- **Do** 用 `clamp()` 弹性字号，锚定 640px / 820px 两个断点做响应式。
- **Do** 保持跨页一致：导航、主题栏、按钮家族、footer 在五页结构相同。
- **Do** 用 1px 鎏金描边 + 玻璃模糊 + 纸色分层表达层级，保持平底默认。
- **Do** 交互反馈用金色焦点环与鎏金下划线，禁用突兀的位移/缩放动画。
- **Do** 尊重 `prefers-reduced-motion`，关闭入场与位移动画。

### Don't:
- **Don't** 引入新字体——只用衬线（Cormorant Garamond）、无衬线（Inter）、等宽（JetBrains Mono）、楷体（Kaiti SC）四套。
- **Don't** 用硬投影或浮起阴影表达高度；深度只来自玻璃、描边与纸色分层。
- **Don't** 把鎏金大面积铺满或用于正文文字；它是稀用的重音。
- **Don't** 用纯黑（#000）或纯白（#FFF）——文字用宿墨系、背景用象牙纸系。
- **Don't** 拆分视觉系统到多个文件——CSS/JS 全部内联在各 `.html`，保持一致来源。
- **Don't** 忽视 `data-theme` 三主题——新样式必须同时定义日间 / 夜间 / 护眼下的表现。
