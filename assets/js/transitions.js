/* ============================================================
   ASTRUM 远穹 — 跨文档页面转场
   File : assets/js/transitions.js
   说明 : ① 支持 View Transitions 的浏览器（跨文档）→ 走原生转场，
              CSS 关键帧定义在 motion.css，这里只做编排与状态标记。
          ② 不支持的浏览器 → 用一层"光膜"做等效的淡出/淡入，
              保证观感连续，且不影响 SEO 与真实 URL 导航。

   关键点：转场只是"装饰"，导航本身永远是浏览器原生行为——
           即使 JS 全挂，站点依然可用。
   ============================================================ */
(function (w, d) {
  "use strict";

  var T = {};
  var root = d.documentElement;
  var NAV_KEY = "astrum:nav";

  var crossDoc = ("onpagereveal" in w) || ("onpageswap" in w);
  var sameDoc = typeof d.startViewTransition === "function";

  T.crossDoc = crossDoc;
  T.sameDoc = sameDoc;

  function flash(amount) {
    try {
      w.dispatchEvent(new CustomEvent("astrum:flash", { detail: { amount: amount || 0.07 } }));
    } catch (e) {
      var ev = d.createEvent("CustomEvent");
      ev.initCustomEvent("astrum:flash", false, false, { amount: amount || 0.07 });
      w.dispatchEvent(ev);
    }
  }

  function store(key, val) {
    try { sessionStorage.setItem(key, val); } catch (e) {}
  }
  function read(key) {
    try { return sessionStorage.getItem(key); } catch (e) { return null; }
  }

  /* ---------- 到达：跳过预加载，直接进入编排 ---------- */
  function markArrival() {
    if (read(NAV_KEY) !== "1") return;
    store(NAV_KEY, "0");
    root.classList.add("is-arriving");
    w.ASTRUM_ARRIVED = true;
  }

  function clearArrival() {
    root.classList.remove("is-arriving", "is-transitioning");
    w.ASTRUM_ARRIVED = false;
  }

  /* ---------- 内部链接判定 ---------- */
  function isInternal(a) {
    if (!a || a.tagName !== "A") return null;
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#") return null;
    if (a.hasAttribute("download") || a.hasAttribute("data-no-transition")) return null;
    if ((a.target && a.target !== "_self")) return null;
    if (/^(mailto:|tel:|javascript:|data:)/i.test(href)) return null;
    var u;
    try { u = new w.URL(a.href, w.location.href); } catch (e) { return null; }
    if (u.protocol !== "http:" && u.protocol !== "https:" && u.protocol !== "file:") return null;
    /* 同页锚点不做整页转场 */
    if (u.pathname === w.location.pathname && u.search === w.location.search && u.hash) return null;
    /* 跨页锚点：交给浏览器 */
    return u;
  }

  /* ---------- 原生跨文档转场编排 ---------- */
  function initNative() {
    /* 旧页面：离场前打光闪 + 标记"这是站内跳转"
       —— 标记必须在这里写下，新页面读到它才会跳过预加载器，
       否则每次导航都会再放一遍进度条，转场就失去意义了。 */
    w.addEventListener("pageswap", function () {
      store(NAV_KEY, "1");
      root.classList.add("is-transitioning");
      flash(0.09);
    });

    /* 新页面：入场编排 */
    w.addEventListener("pagereveal", function () {
      root.classList.add("is-arriving");
      w.ASTRUM_ARRIVED = true;
      var pre = d.getElementById("preloader");
      if (pre) pre.classList.add("is-done");
      if (d.body) d.body.classList.add("is-ready");
    });

    /* 从 bfcache 回来时清掉状态 */
    w.addEventListener("pageshow", function (e) {
      if (e.persisted) clearArrival();
    });
  }

  /* ---------- 兜底转场（光膜淡出） ---------- */
  function ensureVeil() {
    var veil = d.querySelector(".page-veil");
    if (veil) return veil;
    veil = d.createElement("div");
    veil.className = "page-veil";
    veil.setAttribute("aria-hidden", "true");
    d.body.appendChild(veil);
    return veil;
  }

  function initFallback() {
    if (w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var veil = null;
    var busy = false;

    d.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      var a = e.target && e.target.closest ? e.target.closest("a") : null;
      if (!isInternal(a)) return;

      e.preventDefault();
      if (busy) return;
      busy = true;

      var href = a.href;
      /* 无论如何都必须完成导航——装饰可以失败，动线不能断 */
      var go = function () { w.location.href = href; };

      try {
        store(NAV_KEY, "1");
        root.classList.add("is-transitioning");
        flash(0.09);
        veil = ensureVeil();
        w.requestAnimationFrame(function () { veil.classList.add("is-on"); });
        w.setTimeout(go, 460);
      } catch (err) {
        go();
      }
    });

    /* 表单提交等也走同一层光膜 */
    d.addEventListener("submit", function () { store(NAV_KEY, "1"); });
  }

  T.init = function () {
    markArrival();
    if (crossDoc) initNative();
    else initFallback();
  };

  /* 供 app.js 判断是否要跳过预加载器 */
  T.arrived = function () { return !!w.ASTRUM_ARRIVED; };

  w.ASTRUM = w.ASTRUM || {};
  w.ASTRUM.Transitions = T;
})(window, document);
