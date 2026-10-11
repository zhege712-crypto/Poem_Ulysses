# 主页主视觉轻微分层响应

2026-10-11。本任务在 `design/home-depth-2026-10-11` 分支、基线 `b1f5c38` 的隔离目录实现。唯一产品源码变更是 `index.html` 的主视觉样式与独立 `hero-art-depth` IIFE；本目录为新增说明和检查证据。

## 视觉与交互

沿用现有暖纸、雕塑、锈红斜带、细弧和玻璃构图。鼠标在主视觉范围内移动时，玻璃沿鼠标方向最多平移 6px，细弧反向最多平移 3px，以轻微错位说明两层的空间关系。斜向位移也按总距离限制，雕塑、批注、斜带和整页均不旋转或移动。静止后保持最后位置，不自转；离开主视觉或页面失焦时归位。

玻璃使用 280ms、细弧使用 240ms 的既有 `--ui-ease` 减速曲线。仅过渡 `transform`，不动画化位置、尺寸、模糊或颜色。装饰仍为 `aria-hidden` 和 `pointer-events:none`；其原有 `.hero` 监听鼠标，不添加覆盖层、焦点或按钮。

只在 `hover:hover`、`pointer:fine`、宽度大于 640px、`prefers-reduced-motion:no-preference` 同时成立时启用。触摸、笔输入、粗指针、手机和减少动态偏好使用静态构图。偏好或视口改变、滚动、指针取消、页面隐藏、窗口失焦时清除待执行帧并归位；开幕期间不响应鼠标。现有开幕控制器和随机诗脚本逐字保持原样。

每次进入主区域缓存主视觉边界，移动过程中不重复测量；滚动或视口变化后才重新测量。连续输入合并为单个 `requestAnimationFrame`，没有循环帧、计时器、常驻 `will-change`、新依赖或构建步骤。

## 独立调整

在 `index.html` 搜索 `Pointer depth` 即可找到设置，CSS 变量仅作用于 `.hero-art`：

| 设置 | 默认 | 调整方式 |
| --- | --- | --- |
| `--hero-glass-travel` | `6px` | 降至 `4px` 可减弱玻璃移动 |
| `--hero-line-travel` | `3px` | 设为 `0px` 可固定细弧 |
| 玻璃 `transition` | `280ms` | 约 220–320ms 内调整跟随感 |
| 细弧 `transition` | `240ms` | 约 200–280ms 内调整归位感 |

两个 travel 均设为 `0px` 可保留现有代码并使构图完全静止。不要修改 `.hero-art img` 的 transform，也不要把移动应用到 `.hero` 或开幕控制器。若改变位移幅度，建议继续限制在 3–6px。

## 本地预览

已启动隐藏后台静态服务器，仅监听本机 `127.0.0.1:8161`，启动进程 PID 为 `13444`。打开：

- 正常页面：<http://127.0.0.1:8161/index.html>
- 既有冻结调试模式：<http://127.0.0.1:8161/index.html?preview=1>，此模式会冻结开幕，需要点击“跳过开场”后体验主视觉。

服务器退出后，可用 PowerShell 重新启动；先确认 8161 端口没有被占用：

```powershell
Get-NetTCPConnection -LocalPort 8161 -ErrorAction SilentlyContinue
Start-Process -FilePath 'D:\python\python.exe' -ArgumentList '-m','http.server','8161','--bind','127.0.0.1' -WorkingDirectory 'D:\poem_ulysses_web\implementation-worktrees\home-depth-2026-10-11' -WindowStyle Hidden
```

需要停止时，先用 `Get-NetTCPConnection` 核对监听进程，再用 `Get-CimInstance Win32_Process` 检查其 `CommandLine` 确实为本任务的 Python 静态服务器，然后对该 PID 执行 `Stop-Process -Id <PID>`。不要停止其他任务的服务器。

## 检查记录

两轮有界浏览器检查：1280×720 桌面与 390×844 手机，均检查浅色、深色、护眼主题。无横向溢出，保留 40 首统计和六条最近作品；手机主操作高度约 46.7px。实际鼠标交互确认只有玻璃与细弧变化，雕塑/斜带/批注保持原位；移动到文字侧归位，最终两层 transform 平移为零。Tab 从“浏览目录”到“我要投稿”，焦点与原操作顺序正常。手机宽度下，即使使用精细鼠标，两层 transform 仍为 `none`。浏览器记录中没有捕获到 error/warn。

`source-validation.json` 记录 13 项针对性逻辑检查，包括 120 次输入仅一帧/一次边界测量、斜向总距离不超过 6px、空闲无后续写入、离开/失焦/滚动等取消待执行帧、媒体查询变化清零、静态模式和触摸/笔输入不产生测量或写入。四个内联脚本通过语法检查，三个原有非空脚本与基线逐字一致。减少动态与粗指针的媒体查询关闭路径通过模拟事件检查；未改变操作系统设置，未在真实触摸设备或低端 GPU 上测量帧率。

`browser-validation.json` 含首轮交互中间帧与确认轮数据；带 `confirmation-` 前缀及 `desktop-confirm-reset` 的记录用于最终静态判断。四张 JPG 为桌面三主题和手机护眼的可用视口截图。首次手机全页截图失败；随后手机浅色/深色捕获遇到浏览器尺寸切换的缩小/黑边截图问题，已丢弃这两张图片，三主题手机布局判断依据实际 DOM 尺寸与计算样式记录。没有因此改动页面实现。

`detector.json` 为 Impeccable 检查结果：3 项已有警告（既有 Inter 字体与历史布局过渡）和 33 项既有设计 token 提示，本次新增样式/脚本范围无告警。`git diff --check` 通过。实现无需联网资源变更；远程字体与既有访问统计仍沿用原页面。

没有修改目录页、作品/作者数据、Workers、D1、配置、邮箱/账号登录、`deployment-repo` 或其他工作目录，没有推送、PR、合并或部署。
