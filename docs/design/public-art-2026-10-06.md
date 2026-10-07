# 公共页静态美术深化

2026-10-06 开始，2026-10-07 完成。基线 `8c8828662c067245048c869f802cb6e405d88f09`，工作分支 `design/art-public-2026-10-06`。本轮覆盖 index、directory、read、authors、author、about、submit、status、privacy、partners；不扩展至漂流地图、数据与账号工作台。

## 已实现的构图

主页为两栏：左侧真实标题、希腊语介绍、完整统计、三个操作、投稿说明和合作账号入口；右侧仅一张装饰性浅浮雕。短回纹和细弧为 SVG，锈红斜带为 CSS clip-path，玻璃矩形为原生透明层。手写批注只摘录关于页“起源于一份激情”。全部六条最近作品与投稿解释、页脚保留，排序及数据读取规则未变。

`assets/art/greek-relief.png` 为内置 image_gen 从认可的浮雕参考提取的原创古希腊风格概念素材，非具体馆藏。1254×1254 RGBA，2,000,368 bytes。主页使用单个 `img alt=""`，显式 width/height 与 aspect-ratio 占位；其他页不加载雕塑。深色亮度 .64、护眼亮度 .94，降低对比与饱和度。素材不添加视差或动画。

导航和主页容器最大 1280px，桌面内边距 32px，目录内容最大 1100px。其余长诗、介绍和表单保持既有阅读宽度。主页标题 `clamp(64px,7vw,96px)`，手机 `clamp(44px,12.5vw,60px)`，390px 视口为 48.8px；字重500，字距 .025em。希腊语介绍采用既有衬线，桌面24px、手机21px；最近作品标题24/21px，元信息14/13px。

内页标题48/34px、作者名40/32px、诗题40/30px、诗正文20/19px继续保持。现有字体不替换，Google Fonts采用swap及本地回退。较大字体偏好下，按钮、主题标签、日期和元信息仍保持可用，不强制缩小用户字体。

## 控件与对齐

圆润玻璃导航、主题栏、搜索和操作控件以及既有 motion controller 保留。主题标签 nowrap，active/inactive 按钮均至少86px×44px；目录与作者作品日期列128px，避免实际16px字体下孤立“日”。手机最近作品明确采用上下排列，允许元信息换行。无独立圆圈/斜条小图标。

主页 `scrollbar-gutter:stable` 避免开幕锁滚动改变水平构图。现有抽象开幕控制器同步实际标题 family、size、weight、spacing、line-height及坐标，在锁滚动后、字体加载后和既有到达测量时更新；保留错误、超时、跳过、减少动态、inert和焦点恢复路径。未新增交互或动画。

## 验证与限制

两轮有界检查：首轮九个可见页面×桌面1536×1024/手机390×844×三主题，共54张截图；partners为跳转壳，核对源代码的原有目的地与fallback，无新认证操作。首轮独立评审发现开幕重影、手机主题断行、最近作品元信息截断、日期尾字；已按同一批修复并确认。切主题中的截图曾产生中间帧，最终证据以 `confirmation/` 下稳定主题截图为准。

所有可见内容无横向溢出。投稿检测到的离屏website字段为既有honeypot，不属于布局缺陷。开幕确认时字体96px/500/2.4px/115.2px，真实标题与overlay坐标均x152.4、y152.6875。九页原有脚本保持原样，index仅修改开幕测量，30个内联脚本语法通过。真实投稿、私密查询、登录及外部服务成功流程不在视觉验收中执行。

Impeccable检测告警包括既有Inter、被新规则覆盖的旧width/padding过渡、历史DESIGN.md字号/圆角token差异，以及关闭灯箱的空src；灯箱图片仅在打开时设定来源。这些不证明当前渲染有缺陷；本轮按公共页实际记录维护，未修改共享DESIGN/PRODUCT。漂流、数据、配置、认证及部署文件没有变化。

证据目录：`D:/poem_ulysses_web/design-drafts/2026-10-06/art-implementation/public-ui/`，包括首轮截图、`computed-first-pass.json`、`detector-final.json`、`review.md`、`intro-alignment-confirm.json`及`confirmation/`。原生截图工具有一次全页捕获超时和一次会话超时；已通过稳定主题状态的视口截图完成确认。
