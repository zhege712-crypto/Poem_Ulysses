# 目录开篇薄片 · 2026-10-11

2026-10-12 完成收尾；浏览器检查 22 项全部通过。

本任务位于隔离分支 `design/catalog-preview-2026-10-11`，基线为 `b1f5c38`。产品源码只修改 `directory.html`；其他新增文件均为本任务说明、可复查的浏览器检查文档及验证图片。正式源码目录 `deployment-repo`、首页、阅读页、诗歌 JSON、Workers 和 D1 均未修改。本任务只做本地实现。

## 行为与设计

沿用已验收公共页面的暖纸、墨色、楷体与三主题。薄片使用当前主题纸色的 92% 混合、1px 边界、12px 圆角与 8px 模糊；不增加人物或装饰素材。目录布局、排序、搜索条件和原链接均保持原逻辑。

- PC（821px 及以上）鼠标停在诗题文字上 340ms 后显示；日期和整行留白不触发预览。键盘 Tab 聚焦原作品链接后延迟 180ms 显示。
- 使用当前已加载 JSON 正文的前两个**非空源行**；支持 LF、CRLF 和 CR，保留源行缩进。空正文不显示，单行正文不补第二行。
- 每个源行最多展示两行折行文字，超长行通过 CSS 省略；DOM 仍保存完整的两个源行，完整阅读继续使用原作品链接。
- 正文仅写入 `textContent`，不解析为 HTML；新增 ID 属性与 href 同样采用 URI 编码。
- 一张固定定位薄片复用于列表、树状目录和搜索结果。位置按当前标题、相邻诗题、日期、箭头、系列标题、分支按钮、导航、搜索、主题栏和页脚的边界计算，不挤动列表。
- 优先就近寻找安全留白；紧凑树分支中的薄片可能移到下方空白。先试 340px 宽，再试 260px。极端窄空间、高缩放或密集长标题下没有安全区域时，保持原链接可用并不显示薄片。
- 离开标题后 120ms 收起，允许鼠标经过短间隙进入薄片继续阅读；Esc 立即收起且不移动焦点，直到重新进入或重新聚焦才恢复。
- 搜索、视图重绘、折叠、触摸、页面失焦和后台隐藏时清除旧薄片。滚动或缩放重新测量；仍聚焦的键盘作品会在短暂稳定后恢复预览。
- 820px 及以下不显示预览，触摸事件不触发预览。标题点击、Enter 和手机单击仍直接进入 `read.html?id=…`。
- 新增淡入为 150ms，`prefers-reduced-motion: reduce` 时取消。薄片不进入 Tab 顺序，显示时与原链接建立 `aria-describedby`，收起后移除关联。

## 本地预览

打开 [目录预览](http://127.0.0.1:8163/directory.html)。当前静态服务器由隐藏后台 Python 进程提供，仅绑定 `127.0.0.1`；根目录为本工作树，不使用正式源码目录。

如果退出应用或重启后端口未运行，在 PowerShell 执行：

```powershell
$previewRoot = 'D:\poem_ulysses_web\implementation-worktrees\catalog-preview-2026-10-11'
$previewPython = 'C:\Users\10141\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
Start-Process -FilePath $previewPython -ArgumentList '-m','http.server','8163','--bind','127.0.0.1' -WorkingDirectory $previewRoot -WindowStyle Hidden
```

修改后刷新浏览器即可，无安装或构建步骤。请通过 HTTP 预览，`file://` 打开无法正常获取 JSON。

## 方便独立调整的入口

全部产品实现都在 `directory.html` 中；搜索以下标记即可找到。

| 标记或参数 | 当前值 | 调整作用 |
| --- | --- | --- |
| `catalog-preview-style` | 独立样式块 | 此功能的样式入口 |
| `--theme-preview-paper` | 当前纸色 92% | 薄片透明度；降低时需要重新核对文字对比度 |
| `--theme-preview-line` / `--theme-preview-ink` | 现有边界色 / 墨色 | 自动跟随三主题 |
| `--catalog-preview-width` | 340px | 常规宽度；定位函数仍有 260px 回退 |
| `.catalog-preview` | 18px / 1.8，14px 20px 内边距 | 诗行字号、行距与薄片尺寸 |
| `.catalog-preview p` | `-webkit-line-clamp: 2` | 每个源行的折行上限 |
| `HOVER_DELAY` / `FOCUS_DELAY` | 340 / 180ms | 鼠标与键盘停留时间 |
| `LEAVE_DELAY` | 120ms | 移入薄片前的短暂容许时间 |
| `GAP` | 12px | 与文字及控件保持的安全间隔 |
| `function place(title)` | 文字 / 控件碰撞检查 | 调整定位时的主要入口 |

改字号、内边距、宽度或间隔后，复查树状目录中只有一两首作品的短分支，以及长诗题和搜索单条结果；这些地方的可用空白最少。

## 验证与证据

桌面实际视口 1536×1024；另查默认桌面宽度及手机 390×844。浏览器确认列表、树状、搜索后聚焦、Esc 保留焦点、主题切换、Tab 自动滚动到末尾作品后的预览恢复，以及手机单击直接进入对应阅读页。所查目录状态无横向溢出。

[可重复运行的本地检查文档](http://127.0.0.1:8163/docs/design/catalog-preview-check-2026-10-11.html)包含正文、空行、特殊字符、特殊 ID、长行、空正文、鼠标延迟与收起、薄片停留、动态重绘、折叠和搜索等检查。点击按钮后只在 iframe 的内存中使用带 `QA_ONLY` 标记的技术文本；结束时恢复真实数据、视图及折叠偏好，不写入 JSON。鼠标 / 触摸边界用合成 PointerEvent 检查，真实键盘及链接导航另由浏览器操作确认。检查文档会等待字体稳定，避免字体替换或测试日志排版影响位置断言。

最终 22 项检查全部通过，结果保存于 [browser-check.txt](catalog-preview-2026-10-11/browser-check.txt)。浏览器延迟派发滚动事件时，检查文档在滚动稳定后重新进入标题一次，确认原有取消悬停机制和重新显示均正常。截图：

- [浅色列表](catalog-preview-2026-10-11/desktop-light.png)
- [深色列表](catalog-preview-2026-10-11/desktop-dark.png)
- [护眼树状目录](catalog-preview-2026-10-11/desktop-eye-care-tree.png)
- [手机列表](catalog-preview-2026-10-11/mobile-list.png)
- [手机树状目录](catalog-preview-2026-10-11/mobile-tree.png)

产品页三个内联脚本及检查文档脚本均通过语法解析，`git diff --check` 通过。Impeccable detector 共返回 32 项既有规则提示，其中 5 项 warning 来自保留的字体与旧过渡规则；新增预览样式没有报告项。遵循本任务范围，未更改公共设计系统或清理既有规则。

减少动态偏好的新增 CSS 降级规则已检查；未改变操作系统的动态设置。未使用实体手机或屏幕阅读器，也未验证所有浏览器的楷体回退字体、后台标签计时策略及极端缩放。外部字体和既有统计脚本仍由原页面加载，本任务没有增加远程依赖。

设计依据：`AGENTS.md`、Impeccable 的 delight / animate / craft-floor 指引、`docs/design/public-ui.md` 和 `docs/design/art-2026-10-07.md`。本任务保留已验收视觉世界，只在浏览诗题时增加一处真实正文发现交互。
