/* ============================================================
   ASTRUM 远穹 — 原创图标系统
   File : assets/js/icons.js
   说明 : 全站不再用字体里的符号字符充当图标。
          这里定义一套自绘的 24×24 线性图标，并在运行时把 HTML 里
          那些 "✦ ✧ ◈ ◇ ❄ ☾ ✕ ✓ → ↑" 之类的字符就地替换成矢量图形。
          优点：字形随系统字体变化、缺字时会掉方块，矢量图标不会。
   依赖 : 无
   ============================================================ */
(function (w, d) {
  "use strict";

  var A = (w.ASTRUM = w.ASTRUM || {});
  var Icons = {};

  var NS = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"';

  /* 线性图标（描边） */
  var LINE = {
    arrowRight: '<path d="M3.5 12h16.2"/><path d="M13.6 5.6 20 12l-6.4 6.4"/>',
    arrowLeft: '<path d="M20.5 12H4.3"/><path d="M10.4 5.6 4 12l6.4 6.4"/>',
    arrowUp: '<path d="M12 20.5V3.5"/><path d="M5.6 10 12 3.5 18.4 10"/>',
    close: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
    check: '<path d="M4.4 12.6 9.7 17.9 19.6 7.1"/>',
    chevronDown: '<path d="M6 9.5 12 15.5l6-6"/>',
    sparkOutline: '<path d="M12 1.8c.78 4.7 2.5 6.42 7.2 7.2-4.7.78-6.42 2.5-7.2 7.2-.78-4.7-2.5-6.42-7.2-7.2 4.7-.78 6.42-2.5 7.2-7.2z"/>',
    diamondOutline: '<path d="M12 2.4 21.6 12 12 21.6 2.4 12z"/><path d="M12 7.4 16.6 12 12 16.6 7.4 12z"/>',
    flake: '<path d="M12 2.2v19.6"/><path d="M3.5 7.1l17 9.8"/><path d="M20.5 7.1l-17 9.8"/><path d="M9.4 4.6 12 7.2l2.6-2.6"/><path d="M9.4 19.4 12 16.8l2.6 2.6"/>',
    moon: '<path d="M20.2 14.7A8.6 8.6 0 1 1 9.4 3.9a6.9 6.9 0 0 0 10.8 10.8z"/>',
    pulse: '<path d="M2.4 12h3.9l2.4-7.2 4.1 14.4 2.4-7.2h6.4"/>',
    cloud: '<path d="M7.2 18.2h9.4a4.05 4.05 0 0 0 .4-8.06A5.6 5.6 0 0 0 6.3 11.2a3.55 3.55 0 0 0 .9 7z"/>',
    pen: '<path d="M4 20l1.1-4.6L16.4 4.1a2.15 2.15 0 0 1 3.05 3.05L8.2 18.4 4 20z"/><path d="M14.4 6.1l3.05 3.05"/>',
    sun: '<circle cx="12" cy="12" r="4.6"/><path d="M12 1.9v2.6M12 19.5v2.6M1.9 12h2.6M19.5 12h2.6M4.9 4.9l1.85 1.85M17.25 17.25l1.85 1.85M19.1 4.9l-1.85 1.85M6.75 17.25 4.9 19.1"/>',
    globe: '<circle cx="12" cy="12" r="9.1"/><path d="M2.9 12h18.2"/><path d="M2.9 8.2h18.2M2.9 15.8h18.2"/><path d="M12 2.9c2.6 2.7 2.6 15.5 0 18.2M12 2.9c-2.6 2.7-2.6 15.5 0 18.2"/>',
    wave: '<path d="M2.4 7.2c2-2.4 4-2.4 6 0s4 2.4 6 0 4-2.4 6 0"/><path d="M2.4 12c2-2.4 4-2.4 6 0s4 2.4 6 0 4-2.4 6 0"/><path d="M2.4 16.8c2-2.4 4-2.4 6 0s4 2.4 6 0 4-2.4 6 0"/>',
    lattice: '<path d="M12 2.5 20.6 7.4v9.2L12 21.5 3.4 16.6V7.4z"/><path d="M12 7.6 16.4 10.2v4.6L12 17.4 7.6 14.8v-4.6z"/>',
    phone: '<path d="M6.5 3.4h3.1l1.6 4-2.1 1.45a11.3 11.3 0 0 0 5.95 5.95l1.45-2.1 4 1.6v3.1a1.65 1.65 0 0 1-1.85 1.65A17 17 0 0 1 4.85 5.25 1.65 1.65 0 0 1 6.5 3.4z"/>',
    /* 六大业务 */
    station: '<path d="M2.4 12h19.2"/><rect x="3.8" y="8.2" width="3.6" height="7.6" rx="0.6"/><rect x="16.6" y="8.2" width="3.6" height="7.6" rx="0.6"/><rect x="9.8" y="9.6" width="4.4" height="4.8" rx="1"/><path d="M12 5.6v4M12 14.4v4M7.4 12h2.4M14.2 12h2.4"/>',
    orbit: '<circle cx="12" cy="12" r="4.2"/><ellipse cx="12" cy="12" rx="10.2" ry="4.1" transform="rotate(-22 12 12)"/><circle cx="19.6" cy="8.9" r="1.5" fill="currentColor" stroke="none"/>',
    payload: '<path d="M12 2.6 20.4 7v10L12 21.4 3.6 17V7z"/><path d="M3.6 7 12 11.5 20.4 7M12 11.5v9.9"/>',
    satellite: '<path d="M12 6.6 16.6 9.2v5.2L12 17l-4.6-2.6V9.2z"/><path d="M2.4 10.2h3.6v3.6H2.4zM18 10.2h3.6v3.6H18z"/><path d="M6 12h1.4M16.6 12H18M12 2.8v3.8M9.8 2.8h4.4"/>',
    academy: '<path d="M2.8 9.2 12 4.6l9.2 4.6L12 13.8z"/><path d="M6 11.4v4.4c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6v-4.4"/><path d="M20.4 9.9v4.6"/>',
    corporate: '<path d="M3.6 20.4V8.6l6.4-3.2v15"/><path d="M10 11.4h10.4v9"/><path d="M13.4 14.4h1.6M17 14.4h1.6M13.4 17.6h1.6M17 17.6h1.6"/><path d="M2 20.4h20"/>'
  };

  /* 实心图标 */
  var SOLID = {
    spark: '<path d="M12 1.6c.8 4.85 2.55 6.6 7.4 7.4-4.85.8-6.6 2.55-7.4 7.4-.8-4.85-2.55-6.6-7.4-7.4 4.85-.8 6.6-2.55 7.4-7.4z"/>',
    diamond: '<path d="M12 2.2 21.8 12 12 21.8 2.2 12z"/>',
    dot: '<circle cx="12" cy="12" r="4.6"/>'
  };

  /* 字体字符 → 图标（就地替换用） */
  var BY_CHAR = {
    "\u2192": "arrowRight",   // →
    "\u2190": "arrowLeft",    // ←
    "\u2191": "arrowUp",      // ↑
    "\u2715": "close",        // ✕
    "\u2716": "close",        // ✖
    "\u2713": "check",        // ✓
    "\u2714": "check",        // ✔
    "\u2726": "spark",        // ✦
    "\u2727": "sparkOutline", // ✧
    "\u25c8": "diamondOutline", // ◈
    "\u25c7": "diamondOutline", // ◇
    "\u2744": "flake",        // ❄
    "\u263e": "moon",         // ☾
    "\u2301": "pulse",        // ⌁
    "\u2601": "cloud",        // ☁
    "\u270e": "pen",          // ✎
    "\u2600": "sun",          // ☀
    "\u25cd": "globe",        // ◍
    "\u2652": "wave",         // ♒
    "\u232c": "lattice",      // ⌬
    "\u260e": "phone",        // ☎
    "\u25be": "chevronDown",  // ▾
    "\u25b8": "arrowRight",   // ▸
    "\u00b7": null
  };

  /* 业务卡片：按标题关键词分配图标 */
  var SERVICE_MAP = [
    [/观光|追光|环游|旅行/, "orbit"],
    [/驻留|空间站/, "station"],
    [/载荷|搭载|返回/, "payload"],
    [/卫星|立方星|组网/, "satellite"],
    [/学院|教育|课堂|学生|课程/, "academy"],
    [/包机|团建|企业|货运/, "corporate"]
  ];

  function body(name) {
    if (LINE[name]) return { d: LINE[name], solid: false };
    if (SOLID[name]) return { d: SOLID[name], solid: true };
    return null;
  }

  /* 生成完整 <svg> 字符串
     size 可传数字（px）或字符串（如 "1em"）；不传则由 CSS 控制 */
  Icons.svg = function (name, opt) {
    opt = opt || {};
    var b = body(name);
    if (!b) return "";
    var size = "";
    if (opt.size !== undefined) {
      var v = typeof opt.size === "number" ? opt.size + "px" : opt.size;
      size = ' width="' + v + '" height="' + v + '"';
    }
    var cls = "ic" + (opt.cls ? " " + opt.cls : "") + (b.solid ? " ic--solid" : "");
    var style = opt.rotate ? ' style="transform:rotate(' + opt.rotate + 'deg)"' : "";
    return '<svg ' + NS + size + ' class="' + cls + '" aria-hidden="true" focusable="false"' + style + ">" +
           (b.solid
             ? '<g fill="currentColor" stroke="none">' + b.d + "</g>"
             : '<g fill="none" stroke="currentColor" stroke-width="' + (opt.weight || 1.7) +
               '" stroke-linecap="round" stroke-linejoin="round">' + b.d + "</g>") +
           "</svg>";
  };

  Icons.has = function (name) { return !!body(name); };

  /* ============================================================
     就地替换
     ============================================================ */
  var SELECTORS = [
    ".arrow", ".ico", ".m-star", ".feature__ico", ".info-card__ico",
    ".ck", ".lb-close", ".to-top", ".ok-msg", ".star-glyph", ".t-ico",
    ".mono-tag .sym", ".acc-btn .plus", ".lb-nav", ".icon-btn"
  ].join(",");

  function replaceIn(el) {
    if (el.dataset && el.dataset.icDone) return;
    if (el.querySelector("svg")) return;                 /* 已经是矢量，别动 */
    var txt = (el.textContent || "");
    var trimmed = txt.replace(/^\s+/, "");
    if (!trimmed) return;
    var ch = trimmed.charAt(0);
    var name = BY_CHAR[ch];
    if (!name) return;

    var rest = trimmed.slice(1).replace(/^\s+/, "");
    el.dataset.icDone = "1";
    el.innerHTML = Icons.svg(name) + (rest ? '<span class="ic-txt">' + rest + "</span>" : "");
  }

  function serviceIcons() {
    var cards = d.querySelectorAll(".pillar-card");
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var box = card.querySelector(".pillar-card__icon");
      if (!box || box.dataset.icDone) continue;
      var title = card.querySelector("h3, h4") ? card.querySelector("h3, h4").textContent : "";
      var name = null;
      for (var k = 0; k < SERVICE_MAP.length; k++) {
        if (SERVICE_MAP[k][0].test(title)) { name = SERVICE_MAP[k][1]; break; }
      }
      if (!name) name = ["orbit", "station", "payload", "satellite", "academy", "corporate"][i % 6];
      if (!Icons.has(name)) continue;
      box.dataset.icDone = "1";
      box.innerHTML = Icons.svg(name, { size: 30, weight: 1.6 });
    }
  }

  Icons.upgrade = function (root) {
    var scope = root || d;
    var list = scope.querySelectorAll(SELECTORS);
    for (var i = 0; i < list.length; i++) replaceIn(list[i]);
    serviceIcons();
  };

  Icons.init = function () {
    Icons.upgrade(d);
  };

  A.Icons = Icons;
})(window, document);
