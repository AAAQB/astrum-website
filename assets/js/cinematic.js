/* ============================================================
   ASTRUM 远穹 — 电影级效果的挂载与编排
   File : assets/js/cinematic.js
   说明 : 页面只负责在 HTML 上写声明（data-gl / data-beams / data-accent …），
          这里统一负责实例化、随机化与降级。所有效果都是"有则增强，无则不塌"。
   依赖 : gl-core.js, gl-nebula.js, gl-light.js, gl-lens.js, motion.js
   ============================================================ */
(function (w, d) {
  "use strict";

  var A = (w.ASTRUM = w.ASTRUM || {});
  var GL = A.GL;
  var Cine = {};
  var instances = [];

  var $ = function (s, c) { return (c || d).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); };

  function attrNum(el, name, def) {
    var v = parseFloat(el.getAttribute(name));
    return isNaN(v) ? def : v;
  }
  function attrStr(el, name, def) {
    var v = el.getAttribute(name);
    return v === null ? def : v;
  }

  /* 确定性伪随机：同一页每次刷新得到同一片星空，避免"闪烁感" */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ============================================================
     1. WebGL 画布挂载
     ============================================================ */
  function mountCanvas(cv) {
    var type = cv.getAttribute("data-gl");
    if (!type) return;

    var mounter = null;
    var opts = {};

    if (type === "nebula" && GL.nebula) {
      mounter = GL.nebula.mount;
      opts = {
        accent: attrStr(cv, "data-accent", "ember"),
        accent2: attrStr(cv, "data-accent2", "ice"),
        accent3: attrStr(cv, "data-accent3", "violet"),
        density: attrNum(cv, "data-density", 1),
        intensity: attrNum(cv, "data-intensity", 1),
        dispersion: attrNum(cv, "data-dispersion", 0.0042),
        bloom: attrNum(cv, "data-bloom", 0.55),
        vignette: attrNum(cv, "data-vignette", 0.55),
        grain: attrNum(cv, "data-grain", 0.035)
      };
    } else if (type === "dust" && GL.dust) {
      mounter = GL.dust.mount;
      opts = {
        accent: attrStr(cv, "data-accent", "ice"),
        accent2: attrStr(cv, "data-accent2", "ember"),
        count: attrNum(cv, "data-count", 0),
        spread: attrNum(cv, "data-spread", 1.15)
      };
      if (!opts.count) delete opts.count;
    } else if (type === "lens" && GL.lens) {
      mounter = GL.lens.mount;
      var follow = cv.getAttribute("data-follow");
      opts = {
        x: attrNum(cv, "data-x", 0.28),
        y: attrNum(cv, "data-y", 0.72),
        intensity: attrNum(cv, "data-intensity", 0.85),
        follow: follow ? follow : null
      };
    }

    if (!mounter) return;

    var inst = null;
    try {
      inst = mounter(cv, opts);
    } catch (e) {
      if (w.console && console.warn) console.warn("[ASTRUM.Cine] mount failed:", type, e);
    }
    if (!inst) return;

    instances.push(inst);
    var glHost = cv.closest("[data-gl-host]");
    if (glHost) glHost.classList.add("gl-live");

    /* 星云就位后关掉 2D 星场，避免两套星空叠加 */
    if (type === "nebula") {
      var bg = cv.closest(".hero__bg") || cv.parentNode;
      if (bg) bg.classList.add("is-gl");
      var two = d.getElementById("cosmos");
      if (two && two !== cv) two.setAttribute("data-suspended", "1");
    }
  }

  /* ============================================================
     2. 体积光柱：按 data-beams 数量程序化生成
     ============================================================ */
  function initBeams() {
    $$("[data-beams]").forEach(function (host) {
      var n = parseInt(host.getAttribute("data-beams"), 10);
      if (!n || n < 1) return;
      if (host.querySelector(".beam")) return;

      var seed = parseInt(host.getAttribute("data-beam-seed") || "20261224", 10);
      var rnd = mulberry32(seed);
      var tints = ["", "beam--ice", "beam--violet"];

      for (var i = 0; i < n; i++) {
        var b = d.createElement("span");
        b.className = "beam " + tints[i % tints.length] + (i % 3 === 0 ? " beam--tight" : "");
        b.style.setProperty("--x", (4 + rnd() * 92).toFixed(2) + "%");
        b.style.setProperty("--w", (5 + rnd() * 19).toFixed(2) + "vw");
        b.style.setProperty("--rot", (-26 + rnd() * 52).toFixed(2) + "deg");
        b.style.setProperty("--bd", (9 + rnd() * 12).toFixed(1) + "s");
        b.style.setProperty("--bdelay", (-rnd() * 9).toFixed(2) + "s");
        host.appendChild(b);
      }
    });
  }

  /* ============================================================
     3. 光晕定位
     ============================================================ */
  function initHalos() {
    $$(".cine-halo").forEach(function (h) {
      h.style.left = attrStr(h, "data-x", "50%");
      h.style.top = attrStr(h, "data-y", "18%");
      if (h.hasAttribute("data-halo-size")) {
        h.style.setProperty("--halo", h.getAttribute("data-halo-size"));
      }
    });
  }

  /* ============================================================
     4. 色散脉冲：元素进入视口时"镜头变焦一下"
     ============================================================ */
  function initDispBurst() {
    var els = $$("[data-disp-burst]");
    if (!els.length) return;
    if (w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    els.forEach(function (el) {
      if (!el.classList.contains("disp-text")) el.classList.add("disp-text");
      var observer = A.Motion && A.Motion.observeOnce;
      var fire = function (t) {
        t.classList.add("is-disp");
        w.setTimeout(function () { t.classList.remove("is-disp"); }, 1200);
      };
      if (observer) observer(el, "0px 0px -18% 0px", fire);
    });
  }

  /* ============================================================
     5. 主题色温：body[data-cine-accent]
     ============================================================ */
  function initAccent() {
    var el = d.querySelector("[data-cine-accent-scope]") || d.body;
    var name = attrStr(el, "data-cine-accent", "ember");
    d.body.setAttribute("data-cine-accent", name);
  }

  /* ============================================================
     6. 画框标签与片头字幕的入场
     ============================================================ */
  function initCaptions() {
    $$(".cine-caption").forEach(function (c) {
      if (!c.hasAttribute("data-scene-skip")) c.setAttribute("data-scene-skip", "");
    });
  }

  /* ============================================================
     7. 页面切换时的光闪 + 挂起
     ============================================================ */
  function initFlash() {
    /* 页面进入后台时统一暂停，回来再启动（省电、避免降频）
       转场白闪由各 WebGL 模块自行监听 astrum:flash 消费 */
    d.addEventListener("visibilitychange", function () {
      instances.forEach(function (i) {
        if (!i.engine) return;
        if (d.hidden) i.engine.stop();
        else i.engine.start();
      });
    });
  }

  /* ============================================================
     8. 刷新（尺寸变化后重算视差基准）
     ============================================================ */
  Cine.refresh = function () {
    instances.forEach(function (i) { if (i.refresh) i.refresh(); });
  };

  Cine.flash = function (amount) {
    try {
      w.dispatchEvent(new CustomEvent("astrum:flash", { detail: { amount: amount || 0.07 } }));
    } catch (e) {}
  };

  Cine.instances = instances;

  Cine.init = function () {
    initAccent();
    initHalos();
    initBeams();
    initCaptions();
    $$("canvas[data-gl]").forEach(mountCanvas);
    initDispBurst();
    initFlash();
  };

  A.Cine = Cine;
})(window, document);
