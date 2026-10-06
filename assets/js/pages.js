/* ============================================================
   ASTRUM 远穹 — 页面级电影化模块
   File : assets/js/pages.js
   说明 : 每个页面一个"主角交互"，全部按需装配——
          页面上没有对应元素时该模块自动跳过，零副作用。
            · 404     拖拽星图对准信标
            · blog    竖向阅读轨 + 目录联动
            · about   历程时间轴的滚动点亮
            · services 深潜选项卡驱动区块色温
            · pricing 对比表行列高亮
            · contact 提交成功粒子爆发
   依赖 : motion.js（可选）
   ============================================================ */
(function (w, d) {
  "use strict";

  var A = (w.ASTRUM = w.ASTRUM || {});
  var reduce = w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = w.matchMedia && w.matchMedia("(hover: hover) and (pointer: fine)").matches;

  var $ = function (s, c) { return (c || d).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var TAU = Math.PI * 2;

  function onIdle(cb) {
    if (w.requestIdleCallback) w.requestIdleCallback(cb, { timeout: 900 });
    else w.setTimeout(cb, 60);
  }

  /* ============================================================
     粒子爆发（2D 覆盖层，用完即走，不常驻）
     ============================================================ */
  var burstLayer = null;

  function ensureBurstLayer() {
    if (burstLayer) return burstLayer;
    var cv = d.createElement("canvas");
    cv.className = "burst-layer";
    cv.setAttribute("aria-hidden", "true");
    d.body.appendChild(cv);
    burstLayer = { cv: cv, ctx: cv.getContext("2d"), parts: [], raf: 0, dpr: 1 };
    return burstLayer;
  }

  function sizeBurstLayer(L) {
    var dpr = Math.min(w.devicePixelRatio || 1, 2);
    L.dpr = dpr;
    L.cv.width = Math.floor((w.innerWidth || 1) * dpr);
    L.cv.height = Math.floor((w.innerHeight || 1) * dpr);
    L.cv.style.width = "100%";
    L.cv.style.height = "100%";
    L.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function burst(x, y, opts) {
    if (reduce) return;
    opts = opts || {};
    var L = ensureBurstLayer();
    if (!L.parts.length) sizeBurstLayer(L);

    var n = opts.count || 34;
    var power = opts.power || 5.2;
    var hue = opts.hue === undefined ? 18 : opts.hue; /* 默认等离子橙 */

    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU;
      var sp = power * (0.35 + Math.random() * 0.95);
      L.parts.push({
        x: x,
        y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 1.1,
        life: 1,
        decay: 0.012 + Math.random() * 0.02,
        r: 0.9 + Math.random() * 2.3,
        hue: hue + (Math.random() * 46 - 22),
        sat: 96,
        light: 58 + Math.random() * 22
      });
    }
    if (!L.raf) L.raf = w.requestAnimationFrame(stepBurst);
  }

  function stepBurst() {
    var L = burstLayer;
    if (!L) return;
    var ctx = L.ctx;
    ctx.clearRect(0, 0, w.innerWidth, w.innerHeight);

    for (var i = L.parts.length - 1; i >= 0; i--) {
      var p = L.parts[i];
      p.vy += 0.11;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) { L.parts.splice(i, 1); continue; }

      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = clamp(p.life, 0, 1) * 0.9;
      ctx.fillStyle = "hsl(" + p.hue + "," + p.sat + "%," + p.light + "%)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.4 + p.life * 0.8), 0, TAU);
      ctx.fill();

      ctx.globalAlpha = clamp(p.life, 0, 1) * 0.22;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 3.4, 0, TAU);
      ctx.fill();
    }

    if (L.parts.length) {
      L.raf = w.requestAnimationFrame(stepBurst);
    } else {
      ctx.clearRect(0, 0, w.innerWidth, w.innerHeight);
      L.raf = 0;
      L.cv.remove();
      burstLayer = null;
    }
  }

  /* ============================================================
     1. 404 · 拖拽星图
     ============================================================ */
  function initStarNav() {
    var host = $("[data-star-nav]");
    if (!host) return;
    var cv = $(".star-nav__canvas", host);
    var valEl = $("[data-align-val]", host);
    var stateEl = $("[data-align-state]", host);
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext("2d");

    var BEARING = 137;            /* 信标方位：既随机又固定，便于复现 */
    var TOL = 5;                  /* 对准容差（度） */
    var heading = 22;             /* 当前航向 */
    var holder = 0;               /* 保持对准的时长 */
    var locked = false;
    var dragging = false;
    var lastX = 0;
    var t = 0;
    var stars = [];
    var W = 0, H = 0, dpr = 1;

    function seedStars() {
      stars = [];
      for (var i = 0; i < 160; i++) {
        stars.push({
          a: Math.random() * 360,
          r: 0.06 + Math.random() * 0.94,
          s: 0.4 + Math.random() * 1.5,
          o: 0.25 + Math.random() * 0.75,
          tw: Math.random() * TAU
        });
      }
    }
    seedStars();

    function resize() {
      var rect = host.getBoundingClientRect();
      dpr = Math.min(w.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(rect.width));
      H = Math.max(1, Math.round(rect.height));
      cv.width = Math.floor(W * dpr);
      cv.height = Math.floor(H * dpr);
      cv.style.width = W + "px";
      cv.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    if ("ResizeObserver" in w) new ResizeObserver(resize).observe(host);
    else w.addEventListener("resize", resize, { passive: true });

    function diff() {
      var v = BEARING - heading;
      while (v > 180) v -= 360;
      while (v < -180) v += 360;
      return v;
    }

    function draw() {
      t += 0.016;
      ctx.clearRect(0, 0, W, H);

      var cx = W / 2;
      var cy = H / 2;
      var R = Math.min(W, H) * 0.46;

      /* 星空：随航向旋转 */
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((heading * Math.PI) / 180);
      stars.forEach(function (s) {
        var ang = (s.a * Math.PI) / 180;
        var rr = s.r * R * 1.5;
        var x = Math.cos(ang) * rr;
        var y = Math.sin(ang) * rr;
        var tw = 0.6 + 0.4 * Math.sin(t * 1.6 + s.tw);
        ctx.globalAlpha = s.o * tw;
        ctx.fillStyle = "#e8f0ff";
        ctx.beginPath();
        ctx.arc(x, y, s.s, 0, TAU);
        ctx.fill();
      });

      /* 信标 */
      var bAng = (BEARING * Math.PI) / 180 - Math.PI / 2;
      var bx = Math.cos(bAng) * R * 1.05;
      var by = Math.sin(bAng) * R * 1.05;
      var pulse = 0.65 + 0.35 * Math.sin(t * 2.4);
      ctx.globalCompositeOperation = "lighter";
      var g = ctx.createRadialGradient(bx, by, 0, bx, by, 46);
      g.addColorStop(0, "rgba(255,138,85," + (0.85 * pulse).toFixed(3) + ")");
      g.addColorStop(0.4, "rgba(255,90,46," + (0.32 * pulse).toFixed(3) + ")");
      g.addColorStop(1, "rgba(255,90,46,0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by, 46, 0, TAU);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(bx, by, 2.6, 0, TAU);
      ctx.fill();

      ctx.font = "600 13px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,180,140,.95)";
      ctx.fillText("✦ ASTRUM", bx, by - 12);
      ctx.restore();

      /* 指针刻度（固定朝上） */
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = locked ? "rgba(84,230,224,.95)" : "rgba(160,178,216,.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - R * 1.28);
      ctx.lineTo(cx, cy - R * 1.02);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy + R * 1.28);
      ctx.lineTo(cx, cy + R * 1.02);
      ctx.stroke();
    }

    function sync() {
      if (locked) return;
      var dd = Math.abs(diff());
      var aligned = dd <= TOL;

      if (valEl) valEl.textContent = String(Math.round(dd)).padStart(3, "0") + "°";
      host.classList.toggle("is-aligning", aligned);

      if (stateEl) {
        stateEl.textContent = aligned ? "ALIGNING" : "SEARCHING";
      }

      if (aligned) {
        holder += 1;
        if (holder > 42) lock();
      } else {
        holder = 0;
      }
    }

    function lock() {
      locked = true;
      host.classList.add("is-locked");
      host.classList.remove("is-aligning");
      if (valEl) valEl.textContent = "000°";
      if (stateEl) stateEl.textContent = "LOCKED";
      var home = $(".hero__cta .btn--primary");
      if (home) home.classList.add("is-beacon");
      if (A.toast) A.toast("返航航线已锁定 · 通道开启");
      var r = host.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, { hue: 190, count: 40, power: 5 });
    }

    /* ---- 帧循环（仅在可见时跑） ---- */
    var running = false;
    var raf = 0;
    function loop() {
      raf = w.requestAnimationFrame(loop);
      draw();
      sync();
    }
    function start() { if (!running) { running = true; raf = w.requestAnimationFrame(loop); } }
    function stop() { running = false; if (raf) w.cancelAnimationFrame(raf); }

    if ("IntersectionObserver" in w) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) start(); else stop(); });
      }, { rootMargin: "80px" }).observe(host);
    } else {
      start();
    }

    /* ---- 拖拽 ---- */
    host.addEventListener("pointerdown", function (e) {
      if (locked) return;
      dragging = true;
      lastX = e.clientX;
      host.classList.add("is-dragging");
      if (host.setPointerCapture) {
        try { host.setPointerCapture(e.pointerId); } catch (err) {}
      }
    });
    host.addEventListener("pointermove", function (e) {
      if (!dragging || locked) return;
      var dx = e.clientX - lastX;
      lastX = e.clientX;
      heading -= dx * 0.32;
      holder = 0;
    });
    var endDrag = function () {
      dragging = false;
      host.classList.remove("is-dragging");
    };
    host.addEventListener("pointerup", endDrag);
    host.addEventListener("pointercancel", endDrag);
    host.addEventListener("pointerleave", endDrag);

    /* ---- 键盘 ---- */
    host.addEventListener("keydown", function (e) {
      if (locked) return;
      var step = e.shiftKey ? 10 : 3;
      if (e.key === "ArrowLeft") { heading -= step; holder = 0; }
      else if (e.key === "ArrowRight") { heading += step; holder = 0; }
      else return;
      e.preventDefault();
    });

    /* 拖拽时禁止页面选中/滚动 */
    host.addEventListener("touchstart", function (e) { if (!locked) e.preventDefault(); }, { passive: false });
  }

  /* ============================================================
     2. blog · 阅读进度轨 + 目录联动
     ============================================================ */
  function initReading() {
    var reading = $("#reading");
    if (!reading) return;
    var prose = $(".prose", reading);
    var toc = $(".post-toc", reading);
    if (!prose) return;

    var rail = d.createElement("div");
    rail.className = "read-rail";
    rail.setAttribute("aria-hidden", "true");
    rail.innerHTML = '<span class="read-rail__fill"></span><span class="read-rail__pct">0%</span>';
    d.body.appendChild(rail);

    var fill = $(".read-rail__fill", rail);
    var pct = $(".read-rail__pct", rail);
    var visible = false;

    if ("IntersectionObserver" in w) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          visible = e.isIntersecting;
          rail.classList.toggle("is-on", visible);
        });
      }, { rootMargin: "-10% 0px -10% 0px" }).observe(prose);
    } else {
      rail.classList.add("is-on");
    }

    var ticking = false;
    function update() {
      ticking = false;
      var r = prose.getBoundingClientRect();
      var vh = w.innerHeight || 1;
      /* 以"文章中心线扫过视口中线"作为 100%，比按可见比例更贴近阅读体感 */
      var done = clamp((vh * 0.5 - r.top) / (r.height || 1), 0, 1);
      fill.style.height = (done * 100).toFixed(1) + "%";
      pct.textContent = Math.round(done * 100) + "%";
    }
    function onScroll() {
      if (!ticking) { ticking = true; w.requestAnimationFrame(update); }
    }
    w.addEventListener("scroll", onScroll, { passive: true });
    w.addEventListener("resize", onScroll, { passive: true });
    update();

    /* 目录联动 */
    if (toc) {
      var links = $$("a[href^='#']", toc);
      var map = links.map(function (a) {
        var id = a.getAttribute("href").slice(1);
        return { a: a, el: d.getElementById(id) };
      }).filter(function (x) { return !!x.el; });

      if (map.length && "IntersectionObserver" in w) {
        var active = null;
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (e) {
            if (!e.isIntersecting) return;
            var hit = null;
            map.forEach(function (m) { if (m.el === e.target) hit = m; });
            if (!hit || hit.a === active) return;
            map.forEach(function (m) { m.a.classList.toggle("is-active", m === hit); });
            active = hit.a;
          });
        }, { rootMargin: "-18% 0px -62% 0px", threshold: 0 });
        map.forEach(function (m) { io.observe(m.el); });
      }
    }
  }

  /* ============================================================
     3. about · 历程时间轴点亮
     ============================================================ */
  function initTimeline() {
    var process = $(".process");
    if (!process) return;

    if (!$(".scroll-rail", process)) {
      var rail = d.createElement("span");
      rail.className = "scroll-rail";
      rail.setAttribute("aria-hidden", "true");
      rail.innerHTML = '<span class="scroll-rail__fill"></span>';
      process.appendChild(rail);
    }

    var items = $$(".process__item", process);
    if (!items.length || !("IntersectionObserver" in w)) return;

    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        e.target.classList.toggle("is-current", e.isIntersecting);
      });
    }, { rootMargin: "-42% 0px -42% 0px", threshold: 0 });
    items.forEach(function (it) { io.observe(it); });
  }

  /* ============================================================
     4. services · 深潜选项卡驱动色温
     ============================================================ */
  function initTabAccent() {
    $$("[data-tabs]").forEach(function (root) {
      var btns = $$(".tab-btn", root);
      if (!btns.length) return;

      function apply(btn) {
        var accent = btn && btn.getAttribute("data-accent");
        if (!accent) return;
        root.setAttribute("data-accent", accent);
        var section = root.closest("section");
        if (section) section.setAttribute("data-accent", accent);
      }

      btns.forEach(function (b) {
        b.addEventListener("click", function () { apply(b); });
      });
      apply($(".tab-btn.active", root) || btns[0]);
    });
  }

  /* ============================================================
     5. pricing · 对比表行列高亮
     ============================================================ */
  function initTableHighlight() {
    $$(".price-table").forEach(function (table) {
      var cells = $$("th, td", table);
      cells.forEach(function (c) {
        c.addEventListener("pointerenter", function () {
          var row = c.parentNode;
          if (!row || row.tagName !== "TR") return;
          var idx = Array.prototype.indexOf.call(row.children, c);
          table.setAttribute("data-col", String(idx));
          $$("tr", table).forEach(function (tr) { tr.classList.remove("is-hover"); });
          row.classList.add("is-hover");
        });
      });
      table.addEventListener("pointerleave", function () {
        table.removeAttribute("data-col");
        $$("tr", table).forEach(function (tr) { tr.classList.remove("is-hover"); });
      });
    });
  }

  /* ============================================================
     6. contact · 提交成功粒子爆发
     ============================================================ */
  function initSubmitBurst() {
    $$("form[data-validate]").forEach(function (form) {
      form.addEventListener("submit", function () {
        w.setTimeout(function () {
          if ($(".field.is-error", form)) return;
          var btn = $("[type=submit]", form) || form;
          var r = btn.getBoundingClientRect();
          burst(r.left + r.width / 2, r.top + r.height / 2, {
            hue: form.getAttribute("data-form") === "newsletter" ? 186 : 20,
            count: 30,
            power: 4.6
          });
        }, 1500);
      });
    });

    /* 通用：任何带 data-burst 的元素点击即爆发 */
    d.addEventListener("click", function (e) {
      var t = e.target && e.target.closest ? e.target.closest("[data-burst]") : null;
      if (!t) return;
      var r = t.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, { count: 26, power: 4.2 });
    });
  }

  /* ============================================================
     7. 表单单字段聚焦光（`.field` 的 CSS 已经处理，这里只补
        一个指针位置，供光斑跟随文字输入焦点）
     ============================================================ */
  function initFieldGlow() {
    if (!fine || reduce) return;
    $$(".field").forEach(function (f) {
      f.addEventListener("pointermove", function (e) {
        var r = f.getBoundingClientRect();
        f.style.setProperty("--fx", (((e.clientX - r.left) / r.width) * 100).toFixed(1) + "%");
        f.style.setProperty("--fy", (((e.clientY - r.top) / r.height) * 100).toFixed(1) + "%");
      }, { passive: true });
    });
  }

  /* ============================================================
     8. 工作集：卡片网格的"聚焦拉焦"
     （CSS 负责表现，这里只在支持 hover 时为网格加标记）
     ============================================================ */
  function initGridFocus() {
    if (!fine || reduce) return;
    var CARDISH = ".card, .project-item, .post-card, .pillar-card, .pricing-tier, .stat-card, .member-card, .mission-card";
    $$("[data-filter-grid]").forEach(function (g) {
      if (g.children.length >= 3) g.classList.add("has-focus-pull");
    });
    $$(".grid").forEach(function (g) {
      var kids = Array.prototype.slice.call(g.children);
      if (kids.length < 3) return;
      /* 只对"卡片墙"生效。表单双列布局之类也用了 .grid，
         必须排除，否则悬停一个输入框会把旁边的字段一起拉糊。 */
      var allCards = kids.every(function (c) { return c.matches(CARDISH); });
      if (allCards) g.classList.add("has-focus-pull");
    });
  }

  /* ============================================================
     Boot
     ============================================================ */
  function boot() {
    initStarNav();
    initReading();
    initTimeline();
    initTabAccent();
    initTableHighlight();
    initSubmitBurst();
    initFieldGlow();
    initGridFocus();
  }

  if (d.readyState === "loading") {
    d.addEventListener("DOMContentLoaded", function () { onIdle(boot); });
  } else {
    onIdle(boot);
  }

  A.pages = { burst: burst, boot: boot };
})(window, document);
