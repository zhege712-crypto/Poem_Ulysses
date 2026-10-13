# 主页移除人物浮雕 · 2026-10-13

以最新远端 `origin/main` 的 `553dad6` 为基线，在独立分支 `design/home-without-relief-2026-10-13` 实现。仅修改 `index.html` 和本说明；本次供本地预览，未推送、创建 PR 或部署。

## 调整

移除主视觉内的 `assets/art/greek-relief.png` 展示和三组已无用途的图片滤镜。素材文件、历史设计说明与证据继续保留。没有替换为铜币、人像、角色或生成图片。

右侧保留锈红斜带、细弧、透明层与已有批注，新增一层淡纸面衔接留白。装饰区域桌面最大宽度460px、手机240px；斜带透明度从.93降至.36，细弧透明度.65。透明层与纸面交叠，维持可辨识的几何构图。左侧字体、希腊语介绍、统计、所有投稿/合作入口与作品内容保持原样。

玻璃最多6px、细弧反向最多3px的鼠标回应继续保留；触摸、小屏与减少动态时静止。开幕、随机拾诗、目录预览代码未改变，不引入新的交互或动画。

## 本地预览

- 修改后：<http://127.0.0.1:8513/index.html>
- 基线对照：<http://127.0.0.1:8513/before.html>

预览仅监听本机，服务脚本在 `D:/poem_ulysses_web/design-drafts/2026-10-13/home-without-relief/preview.py`，本次启动的 Python PID为50548。对照页来自基线原始HTML，使用相同资产和真实数据。服务关闭后可在 PowerShell 隐藏启动：

```powershell
Start-Process -FilePath 'D:/python/python.exe' -ArgumentList 'D:/poem_ulysses_web/design-drafts/2026-10-13/home-without-relief/preview.py' -WindowStyle Hidden
```

## 验证

- 1280×900桌面、390×844手机的浅色/深色/护眼均检查，无横向溢出；320px三个操作仍可用，按钮高度约47px。真实收录统计为40首，投稿、合作账号与安全入口保持。
- 实际鼠标操作：玻璃移动 `(4.8,3)`px、细弧 `(-2.4,-1.5)`px；纸面保持固定，移出后两层平移清零。手机和模拟减少动态偏好下，两层transform为none。
- 既有开幕实际播放后正常结束：overlay恢复aria-hidden，页面和导航解除inert。
- 随机拾诗实际HTTP失败后显示“重试拾诗”，按钮可用；重试展示真实《晚秋夜启》/eno，约487ms后进入同一作品 `1784094799003`。820px诗笺不溢出。
- 原有四个非空内联脚本与基线逐字一致并通过语法检查，hero-copy的真实文字与功能标记逐字一致；目录、数据、素材、Workers、D1、账号配置未改变。
- 原完整拾诗检查在本机分别被导航load等待和截图超时中断；随后针对标题/作者、半秒跳转、HTTP失败重试进行了上面的独立验证。没有据此宣称完整17组回归通过。
- Impeccable detector保留既有字体、历史布局过渡及旧DESIGN字号/圆角提示，未为此扩展修改范围；`git diff --check`通过。保持基线混合换行和BOM，避免无关文件重排。

证据位于 `D:/poem_ulysses_web/design-drafts/2026-10-13/home-without-relief/`：前后桌面图、三主题桌面/手机图、`browser-checks.json`、`source-check.json`、`detector.json`。远程访问统计与评论不属于本次本地验证。

旧 `public-ui` 工作目录的铜币、丝网印刷、背景融合草稿和本地说明完整保留；未修改 `deployment-repo` 或其他聊天工作目录。
