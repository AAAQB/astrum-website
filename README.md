# ASTRUM 远穹宇航 · 大型品牌展示网站

> 把人类的想象力，送上轨道、带向深空。—— 一个虚构太空体验品牌的旗舰网站（演示项目）。

## ✨ 亮点

- **多页面大型站点**：首页 / 关于 / 服务 / 任务档案 / 洞察 / 票价 / 联系 / 404，共 8 个页面，纯原生 HTML + CSS + JS（无框架、无构建、无外部图片依赖）。
- **离线可用**：所有视觉均由 CSS/SVG/Canvas 程序化绘制（星空粒子、极光、海报艺术等），双击 `index.html` 即可预览。
- **动画丰富**：预加载进度、逐行文字揭幕、Cosmos 粒子网络、极光漂移、噪点颗粒、滚动显现、视差、磁性按钮、3D 倾斜卡、数字滚动、倒计时、走马灯、滑块、手风琴、标签页、价格切换、过滤动画、灯箱等。
- **无障碍与性能**：语义化标签、键盘可达、`prefers-reduced-motion` 全量降级、Canvas 视口/标签页暂停、`IntersectionObserver` 懒触发。

## 🗂 目录结构

```
assets/
  css/
    tokens.css        # 设计令牌（色板/字体/节奏）+ Reset + 基础
    components.css    # 按钮/导航/页脚/卡片/表单/灯箱等组件
    effects.css       # 预加载/光标/走马灯/极光/显现/3D/动效关键帧
    pages.css         # 各页面布局组合 + 程序化海报艺术
    responsive.css    # 响应式与打印
  js/
    app.js            # 核心交互引擎（经典脚本，兼容 file://）
index.html            # 首页（旗舰页）
about.html            # 关于 / 使命 / 历程 / 价值观 / 团队
services.html         # 六大业务 + 深潜选项卡 + 合作流程
work.html             # 任务档案 + 分类过滤 + 灯箱
blog.html             # 洞察 + 完整长文
pricing.html          # 票价 + 全款/分期切换 + 对比表 + FAQ
contact.html          # 表单校验 + 咨询入口
404.html              # 迷失轨道页
```

## 🚀 本地预览

直接用浏览器打开 `index.html`（或任一一页）。推荐在 VS Code 中安装 Live Server 以获得更佳字体加载体验；离线时字体自动回退为系统中文字体。

- 交互引导：首页含「下滑探索」提示；任务档案页影像可点击放大；洞察页含长文与目录。

## 🌐 在线部署（GitHub Pages）

- 线上地址：https://aaaqb.github.io/astrum-website/
- 仓库：https://github.com/AAAQB/astrum-website
- 方式：静态站推送到 `main` 分支，GitHub Pages 以 `main` 根目录为源自动发布。全站使用相对路径，可在任意子路径/域名下直接运行。
- 更新：改动后 `git add -A && git commit -m "..." && git push origin main`，约 1 分钟内自动上线。

## 🎨 设计系统速览

| 项 | 值 |
| --- | --- |
| 主强调 | 等离子橙 `#ff5a2e` |
| 次强调 | 冰晶青 `#54e6e0` |
| 背景 | 深空墨蓝 `#05070d` |
| 中文标题 | Noto Serif SC（编辑感衬线） |
| 拉丁展示 | Unbounded |
| 等宽标签 | Space Mono |

动效遵循统一节奏令牌：`--ease-out` / `--ease-io` / `--ease-spring`，时长 120ms→1400ms。
