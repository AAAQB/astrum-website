/* ============================================================
   ASTRUM 远穹 — 滚动编排引擎
   File : assets/js/motion.js
   说明 : ① 分镜编排 [data-scene]（子项按 --i 依次入场）
          ② 文字分层揭幕 [data-split]
          ③ 全局深度层（指针 + 滚动速度驱动 --depth-x/--depth-y）
          ④ 文字对焦 .focus-in 的 JS 兜底（无 scroll-timeline 时）
          ⑤ 光标聚光 .spotlight、大气雾 --mx/--my
          ⑥ 滚动速度驱动的走马灯倾斜（不劫持原生滚动）

   设计原则：绝不接管滚轮事件。所有"惯性感"都通过速度驱动的变形
             表达，因此触控板、键盘、滚动条、锚点跳转的行为完全不变。
   依赖 : tokens.css（变量）、cinematic.css、motion.css
   ============================================================ */
(function (w, d) {
  "use strict";

  var Motion = {};
  var root = d.documentElement;
  var reduce = w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = w.matchMedia && w.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var lowTier = root.classList.contains("tier-low");

  var $ = function (s, c) { return (c || d).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  /* IO 共享实例池：把所有观察合并到一次回调，减少主线程抖动 */
  var ioRegistry = [];
  var singleIO = null;
  function observeOnce(el, margin, cb) {
    if (!("IntersectionObserver" in w)) { cb(el); return; }
    ioRegistry.push({ el: el, cb: cb });
    if (!singleIO) {
      singleIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            for (var i = 0; i < ioRegistry.length; i++) {
              if (ioRegistry[i].el === e.target) {
                try { ioRegistry[i].cb(e.target); } catch (err) {}
                singleIO.unobserve(e.target);
                ioRegistry.splice(i, 1);
                break;
              }
            }
          }
        });
      }, { rootMargin: margin || "0px 0px -12% 0px", threshold: 0.05 });
    }
    singleIO.observe(el);
  }

  /* ============================================================
     1. 分镜编排
     ============================================================ */
  function initScene() {
    $$("[data-scene]").forEach(function (scene) {
      if (reduce) { scene.classList.add("is-in"); return; }
      var kids = Array.prototype.filter.call(scene.children, function (c) {
        return !c.hasAttribute("data-scene-skip");
      });
      kids.forEach(function (k, i) {
        if (!k.style.getPropertyValue("--i")) {
          k.style.setProperty("--i", Math.min(i, 14));
        }
      });
      observeOnce(scene, "0px 0px -14% 0px", function (el) {
        el.classList.add("is-in");
      });
    });
  }

  /* ============================================================
     2. 文字分层揭幕
     ============================================================ */
  var CJK = /[\u2e80-\u9fff\u3000-\u303f\uff00-\uffef]/;

  function tokenize(text) {
    var out = [];
    var buf = "";
    var push = function () { if (buf) { out.push(buf); buf = ""; } };
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (CJK.test(ch) || /\s/.test(ch)) {
        push();
        if (/\s/.test(ch)) {
          out.push(ch);
        } else {
          out.push(ch);
        }
      } else {
        buf += ch;
        /* 拉丁词按空格断开 */
        if (/[^\w\u00c0-\u024f'’-]/.test(ch)) push();
      }
    }
    push();
    return out;
  }

  function splitElement(el) {
    var raw = el.innerHTML.trim();
    /* 只处理纯文本 + <br>，遇到其它标签就放弃拆分（保护既有结构） */
    if (/<(?!\/?br\b)[^>]+>/i.test(raw)) return false;

    var plain = el.textContent.replace(/\s+/g, " ").trim();
    var lines = raw.split(/<br\s*\/?>/i);
    var html = "";
    var ci = 0;

    lines.forEach(function (line) {
      var units = tokenize(line.replace(/\s+/g, " ").trim());
      if (!units.length) return;
      html += '<span class="split__line">';
      units.forEach(function (u) {
        html += '<span class="split__chr" style="--ci:' + (ci++) + '">' + u + "</span>";
      });
      html += "</span>";
    });

    if (!html) return false;
    el.innerHTML = '<span aria-hidden="true">' + html + "</span>";
    el.setAttribute("aria-label", plain);
    el.classList.add("split", "split--char");
    return true;
  }

  function initSplit() {
    $$("[data-split]").forEach(function (el) {
      if (!splitElement(el)) return;
      if (reduce) { el.classList.add("is-in"); return; }
      observeOnce(el, "0px 0px -10% 0px", function (t) { t.classList.add("is-in"); });
    });
  }

  /* ============================================================
     3. 全局深度层 + 大气雾 + 速度
     ============================================================ */
  var depth = { x: 0, y: 0, tx: 0, ty: 0 };
  var vel = { v: 0, smooth: 0 };
  var pointer = { x: 0.5, y: 0.5 };
  var haze = { x: 50, y: 12, tx: 50, ty: 12 };

  function initDepth() {
    if (reduce || lowTier) return;
    if (fine) {
      w.addEventListener("pointermove", function (e) {
        pointer.x = e.clientX / (w.innerWidth || 1);
        pointer.y = e.clientY / (w.innerHeight || 1);
        haze.tx = pointer.x * 100;
        haze.ty = pointer.y * 100;
      }, { passive: true });
    }

    var lastY = w.scrollY || 0;
    var raf = 0;
    function loop() {
      raf = w.requestAnimationFrame(loop);

      var y = w.scrollY || 0;
      vel.v = y - lastY;
      lastY = y;
      vel.smooth = lerp(vel.smooth, clamp(vel.v, -60, 60), 0.18);

      /* 指针位移 → 深度层偏移 */
      depth.tx = (pointer.x - 0.5) * -46;
      depth.ty = (pointer.y - 0.5) * -34 + vel.smooth * 0.22;
      depth.x = lerp(depth.x, depth.tx, 0.07);
      depth.y = lerp(depth.y, depth.ty, 0.07);

      root.style.setProperty("--depth-x", depth.x.toFixed(2) + "px");
      root.style.setProperty("--depth-y", depth.y.toFixed(2) + "px");
      root.style.setProperty("--vel", vel.smooth.toFixed(2));

      /* 大气雾跟随 */
      haze.x = lerp(haze.x, haze.tx, 0.045);
      haze.y = lerp(haze.y, haze.ty, 0.045);
      root.style.setProperty("--mx", haze.x.toFixed(2) + "%");
      root.style.setProperty("--my", haze.y.toFixed(2) + "%");

      /* 速度驱动的走马灯倾斜：快滚时"被风压弯" */
      var skew = clamp(vel.smooth * -0.055, -3.4, 3.4);
      $$(".marquee").forEach(function (m) {
        m.style.transform = skew ? "skewX(" + skew.toFixed(2) + "deg)" : "";
      });
    }
    raf = w.requestAnimationFrame(loop);

    /* 视口隐藏时停掉，省电 */
    d.addEventListener("visibilitychange", function () {
      if (d.hidden) { w.cancelAnimationFrame(raf); raf = 0; }
      else if (!raf) raf = w.requestAnimationFrame(loop);
    });
  }

  Motion.velocity = function () { return vel.smooth; };

  /* ============================================================
     4. 文字对焦（无 scroll-timeline 时的兜底）
     ============================================================ */
  function initFocus() {
    var els = $$(".focus-in");
    if (!els.length) return;
    if (reduce) {
      els.forEach(function (el) { el.style.setProperty("--p", 1); });
      return;
    }
    if (CSS && CSS.supports && CSS.supports("animation-timeline: view()")) return;

    root.classList.add("js-timeline");
    var ticking = false;
    function update() {
      ticking = false;
      var vh = w.innerHeight || 1;
      els.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var t = 1 - (r.top - vh * 0.12) / (vh * 0.62);
        el.style.setProperty("--p", clamp(t, 0, 1).toFixed(3));
      });
    }
    var onScroll = function () {
      if (!ticking) { ticking = true; w.requestAnimationFrame(update); }
    };
    w.addEventListener("scroll", onScroll, { passive: true });
    w.addEventListener("resize", onScroll, { passive: true });
    update();
  }

  /* ============================================================
     5. 光标聚光 + 画框内光
     ============================================================ */
  function initSpotlight() {
    var sp = $(".spotlight");
    if (!sp || reduce || !fine) return;
    var x = w.innerWidth / 2, y = w.innerHeight / 2;
    var tx = x, ty = y;
    var raf = 0;
    function loop() {
      raf = w.requestAnimationFrame(loop);
      x = lerp(x, tx, 0.09);
      y = lerp(y, ty, 0.09);
      sp.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)";
    }
    w.addEventListener("pointermove", function (e) {
      tx = e.clientX;
      ty = e.clientY;
      sp.classList.add("is-on");
    }, { passive: true });
    d.addEventListener("pointerleave", function () { sp.classList.remove("is-on"); });
    raf = w.requestAnimationFrame(loop);
  }

  /* ============================================================
     6. 章节编号点亮
     ============================================================ */
  function initSectionNum() {
    $$(".sec-num").forEach(function (el) {
      if (reduce) { el.classList.add("is-live"); return; }
      observeOnce(el, "0px 0px -30% 0px", function (t) { t.classList.add("is-live"); });
    });
  }

  /* ============================================================
     7. 滚动进度轨（无 scroll-timeline 时驱动）
     ============================================================ */
  function initRails() {
    var rails = $$(".scroll-rail__fill");
    if (!rails.length) return;
    if (CSS && CSS.supports && CSS.supports("animation-timeline: view()")) return;
    rails.forEach(function (el) { el.style.animation = "none"; });

    var ticking = false;
    function update() {
      ticking = false;
      var vh = w.innerHeight || 1;
      rails.forEach(function (el) {
        var host = el.closest(".scroll-rail") || el.parentNode;
        var r = host.getBoundingClientRect();
        var p = (vh - r.top) / (vh + r.height);
        el.style.transform = "scaleY(" + clamp(p, 0, 1).toFixed(3) + ")";
      });
    }
    var onScroll = function () {
      if (!ticking) { ticking = true; w.requestAnimationFrame(update); }
    };
    w.addEventListener("scroll", onScroll, { passive: true });
    w.addEventListener("resize", onScroll, { passive: true });
    update();
  }

  /* ============================================================
     8. 遮幅入场
     ============================================================ */
  function initCineFrame() {
    var frame = $(".cine-frame");
    if (!frame) return;
    var go = function () {
      w.setTimeout(function () { frame.classList.add("is-in"); }, reduce ? 0 : 240);
    };
    if (d.body.classList.contains("is-loaded")) go();
    else {
      w.addEventListener("astrum:loaded", go, { once: true });
      w.setTimeout(go, 2600); /* 兜底：预加载异常时也要出现 */
    }
  }

  /* ============================================================
     9. 指针光斑（画框/面板内部的 --mx/--my）
     ============================================================ */
  function initPlateGlow() {
    var plates = $$(".cine-plate");
    if (!plates.length || reduce || !fine) return;
    plates.forEach(function (plate) {
      plate.addEventListener("pointermove", function (e) {
        var r = plate.getBoundingClientRect();
        plate.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * 100).toFixed(2) + "%");
        plate.style.setProperty("--my", (((e.clientY - r.top) / r.height) * 100).toFixed(2) + "%");
      }, { passive: true });
    });
  }

  Motion.init = function () {
    initScene();
    initSplit();
    initDepth();
    initFocus();
    initSpotlight();
    initSectionNum();
    initRails();
    initCineFrame();
    initPlateGlow();
  };

  Motion.observeOnce = observeOnce;

  w.ASTRUM = w.ASTRUM || {};
  w.ASTRUM.Motion = Motion;
})(window, document);
