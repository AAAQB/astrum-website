# ASTRUM 远穹宇航 · 大型品牌展示网站

> 把人类的想象力，送上轨道、带向深空。—— 一个虚构太空体验品牌的旗舰网站（演示项目）。

## ✨ 亮点

- **多页面大型站点**：首页 / 关于 / 服务 / 任务档案 / 洞察 / 票价 / 联系 / 404，共 8 个页面，纯原生 HTML + CSS + JS（无框架、无构建、无外部图片依赖）。
- **离线可用**：所有视觉均由 CSS/SVG/Canvas/WebGL 程序化绘制（星空粒子、体积星云、镜头光晕、极光、海报艺术等），双击 `index.html` 即可预览。
- **电影级渲染层**：手写原生 WebGL 体积星云（FBM 域扭曲 + 三重星场 + 等离子核心 + 彗尾），以及色散、辉光、ACES 色调映射、暗角、胶片颗粒的后处理管线；另有程序化变形宽银幕镜头光晕与体积光柱。
- **跨页转场**：使用 View Transitions API 做跨文档转场（品牌标识与页面标题共享元素变形），不支持的浏览器自动降级为"光膜"淡出；站内跳转自动跳过预加载器。
- **滚动编排引擎**：分镜编排（`data-scene`）、文字逐字揭幕（`data-split`）、指针/速度驱动的深度层、文字对焦，且**不劫持原生滚动**（触控板、键盘、锚点行为完全不变）。
- **动画丰富**：预加载进度、逐行文字揭幕、Cosmos 粒子网络、极光漂移、噪点颗粒、滚动显现、视差、磁性按钮、3D 倾斜卡、数字滚动、倒计时、走马灯、滑块、手风琴、标签页、价格切换、过滤动画、灯箱等。
- **每页一个主角交互**：404 可拖拽星图对准信标、洞察页竖向阅读轨 + 目录联动、关于页历程时间轴点亮、服务页选项卡驱动区块色温、票价页对比表行列高亮、联系页聚焦光效与提交粒子爆发。
- **可选环境音**：右下角开关，默认静音；低频宇宙嗡鸣 + 噪声风床 + 星点闪烁全部由 Web Audio 实时合成，零音频文件。
- **无障碍与性能**：语义化标签、键盘可达（星图支持方向键）、`prefers-reduced-motion` 全量降级、按 `deviceMemory`/`hardwareConcurrency` 自动分档（low / mid / high）、Canvas 视口与标签页暂停、`IntersectionObserver` 懒触发。

## 🗂 目录结构

```
assets/
  css/
    tokens.css        # 设计令牌（色板/字体/节奏）+ 电影级扩展令牌 + Reset + 基础
    components.css    # 按钮/导航/页脚/卡片/表单/灯箱等组件
    effects.css       # 预加载/光标/走马灯/极光/显现/3D/动效关键帧
    pages.css         # 各页面布局组合 + 程序化海报艺术
    responsive.css    # 响应式与打印
    cinematic.css     # 遮幅/体积光/光晕/色散/景深雾/颗粒 v2 + 页面级模块
    motion.css        # 分镜编排/文字揭幕/滚动驱动/跨文档转场关键帧
  js/
    app.js            # 核心交互引擎 + 电影级模块的统一编排入口
    motion.js         # 滚动编排引擎（分镜/揭幕/深度层/聚光/进度轨）
    transitions.js    # 跨文档 View Transitions 与降级光膜
    audio.js          # Web Audio 程序化环境音（默认静音）
    cinematic.js      # 按 HTML 声明挂载光效（data-gl / data-beams / …）
    pages.js          # 页面级主角交互（星图/阅读轨/时间轴/选项卡/对比表/粒子）
    gl/
      gl-core.js      # 极简原生 WebGL 封装（着色器/FBO/DPR/档位/暂停）
      gl-nebula.js    # 体积星云 + 电影级后处理（色散/辉光/ACES/颗粒）
      gl-light.js     # 体积尘埃粒子场（加性混合点精灵）
      gl-lens.js      # 程序化变形宽银幕镜头光晕
index.html            # 首页（旗舰页，WebGL 星云 Hero）
about.html            # 关于 / 使命 / 历程 / 价值观 / 团队
services.html         # 六大业务 + 深潜选项卡 + 合作流程
work.html             # 任务档案 + 分类过滤 + 灯箱
blog.html             # 洞察 + 完整长文 + 阅读进度
pricing.html          # 票价 + 全款/分期切换 + 对比表 + FAQ
contact.html          # 表单校验 + 咨询入口
404.html              # 迷失轨道页（含可拖拽星图）
```

## 🎬 电影级升级层

这一层是**渐进增强**：任何一个模块缺失或被浏览器不支持，站点都会退回原有的纯 CSS/Canvas 表现，功能不受影响。

| 能力 | 实现 | 降级路径 |
| --- | --- | --- |
| 体积星云主视觉 | `gl-nebula.js`：FBM 域扭曲体积雾 + 三重视差星场 + 等离子核心 + 偶发彗尾，渲染到 FBO 后做色散 / 双环辉光 / ACES 色调映射 / 暗角 / 胶片颗粒 / 抖动 | 无 WebGL → 隐藏 GL 画布，`#cosmos`（Canvas 2D 星场）+ CSS 极光接手 |
| 体积光柱 | `cinematic.js` 按 `data-beams` 程序化生成（确定性随机，同一页刷新图案稳定） | 纯 CSS，本来就无需 JS |
| 镜头光晕 | `gl-lens.js`：单着色器程序化绘制核心光斑、水平拉丝、光圈多边形鬼影、冷色环 | 低档位 / 无 WebGL 时整层不挂载 |
| 光尘 | `gl-light.js`：加性混合点精灵场，随风漂移并随滚动下潜 | 同上 |
| 遮幅与文案保护 | `cinematic.css`：`.cine-frame` 遮幅 + `.hero__bg::after` 渐变 scrim，保证星云流动时白字仍满足 AA 对比度 | 静态显示，无动画 |
| 跨页转场 | `transitions.js` + `<meta name="view-transition">`：共享元素（品牌标识 / 页面主标题）变形 | 不支持时用 `.page-veil` 光膜淡出，导航永远是原生行为 |
| 环境音 | `audio.js`：Web Audio 实时合成，首次点击开关才创建 AudioContext | 不支持 `AudioContext` 时开关自动移除 |

**性能分档**（`gl-core.js` 自动判定，结果写在 `<html class="tier-…">`，CSS 直接消费）：

- `tier-high`：全量效果，DPR ≤ 2，星云 FBM 5 个八度
- `tier-mid`：渲染分辨率 ×0.66，DPR ≤ 1.5，FBM 4 个八度
- `tier-low`：不挂载 WebGL，关闭光束/大气/颗粒动画，DPR 锁 1（触发条件：`saveData`、`deviceMemory ≤ 2`、`hardwareConcurrency ≤ 2`、无 WebGL，或系统开启了"减少动态效果"）

**验收过的降级路径**：`prefers-reduced-motion` → 全部静态化且遮幅直接到位；无 WebGL → 星云画布不挂载、2D 星场与 CSS 极光继续工作；低端设备 → `tier-low` 关闭重效果。

## 🚀 本地预览

直接用浏览器打开 `index.html`（或任一一页）。推荐在 VS Code 中安装 Live Server 以获得更佳字体加载体验；离线时字体自动回退为系统中文字体。

- 交互引导：首页含「下滑探索」提示与可跟随鼠标的星云；任务档案页影像可点击放大（悬停一项时其余会"拉焦"失焦）；洞察页右侧有竖向阅读进度轨，滚动时目录会高亮当前章节；页面右下角可开启环境音；404 页的星图可以用鼠标拖动或方向键对准信标，对准后会亮起返航通道。

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

电影级扩展令牌集中在 `tokens.css` 末尾（`--depth-*` 视差系数、`--glow-*` 体积光、`--blur-*` 景深档位、`--disp-*` 色散、`--cine-bar` 遮幅高度、`--beat-*` 编排间隔、`--ease-cine`/`--ease-glide` 缓动），供 CSS 与 WebGL 着色器共用。

### 想关掉某些效果？

- 整层关闭：从 8 个页面的 `<head>` 移除 `cinematic.css` / `motion.css`，并删掉 `</body>` 前 `gl-*` / `motion.js` / `transitions.js` / `audio.js` / `cinematic.js` / `pages.js` 这些 `<script>`，站点即回到升级前的表现。
- 只关 WebGL：删除页面里的 `<canvas data-gl="…">` 即可，对应容器会自动回退 CSS 氛围。
- 只关环境音：移除页面里的 `.audio-toggle` 按钮，`audio.js` 检测不到按钮就直接不初始化。
- 强制低档位测试：给 `<html>` 手动加上 `class="tier-low"`（或用 DevTools 屏蔽 WebGL）即可预览降级形态。

> `file://` 双击打开同样可用：所有脚本都是经典脚本，本地存储访问已做异常保护（`try/catch`），最坏情况只是不记忆环境音开关。

## 🖼 素材说明
- 任务/文章/服务区的视觉图来自 **Pexels** 实拍（自用，署名 Pexels）。替换映射集中在 `assets/js/app.js` 顶部 `POSTER_PHOTOS`（按 `poster--solar/-ice/-nebula/...` 场景→图源 URL），配套样式 `assets/css/pages.css` 末尾 `.poster--photo`。
- 团队头像等抽象装饰保留 CSS 风格；离线时仍回退 CSS 海报，不会缺图。
