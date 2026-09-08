/* ============================================================
   ASTRUM 远穹 — 核心交互引擎
   File : assets/js/app.js
   Classic script（非 module，兼容 file:// 本地预览）
   ============================================================ */
(function (w, d) {
  "use strict";

  /* ---------- 工具 ---------- */
  var $ = function (sel, ctx) { return (ctx || d).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || d).querySelectorAll(sel)); };
  var reduceMotion = w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = w.matchMedia && w.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var isVisible = function (el) {
    var r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < (w.innerHeight || d.documentElement.clientHeight) && r.right > 0 && r.left < (w.innerWidth || d.documentElement.clientWidth);
  };

  /* 支持 IntersectionObserver？ */
  var IO_OK = "IntersectionObserver" in w;

  /* ============================================================
     1. 预加载器
     ============================================================ */
  function initPreloader() {
    var pre = $("#preloader");
    if (!pre) return;
    var bar = $(".preloader__bar span", pre);
    var pct = $(".preloader__pct", pre);
    var status = $(".preloader__status", pre);
    var statuses = ["校准推进器", "注入星光", "解算轨道", "唤醒导航", "就绪"];
    var started = null;
    var DUR = reduceMotion ? 200 : 1500;
    var done = false;

    function frame(ts) {
      if (!started) started = ts;
      var p = clamp((ts - started) / DUR, 0, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var pctVal = Math.round(eased * 100);
      if (bar) bar.style.width = pctVal + "%";
      if (pct) pct.textContent = String(pctVal).padStart(3, "0") + "%";
      if (status) {
        var idx = Math.min(statuses.length - 1, Math.floor(p * statuses.length));
        if (status.textContent !== statuses[idx]) status.textContent = statuses[idx];
      }
      if (p < 1) {
        w.requestAnimationFrame(frame);
      } else {
        finish();
      }
    }

    function finish() {
      if (done) return;
      done = true;
      pre.classList.add("is-done");
      d.body.classList.add("is-ready");
      revealHero();
      if (w.removeEventListener) {
        // 让预加载层结束后可滚动
      }
    }

    w.requestAnimationFrame(frame);
    // 兜底（若 rAF 阻塞）
    setTimeout(function () { if (!done) finish(); }, DUR + 900);
  }

  /* ============================================================
     2. 首屏入场
     ============================================================ */
  function revealHero() {
    $$(".hero-stagger").forEach(function (el) { el.classList.add("is-in"); });
    // mask-line 逐行揭幕
    $$(".mask-line").forEach(function (line, i) {
      if (line.style.transitionDelay) return;
      setTimeout(function () { line.classList.add("is-in"); }, reduceMotion ? 0 : 120 + i * 140);
    });
    // 未使用 hero-stagger 的页面直接显示
    setTimeout(function () {
      $$("[data-reveal]").forEach(function (el) {
        if (isVisible(el)) el.classList.add("is-in");
      });
    }, reduceMotion ? 0 : 200);
  }

  /* ============================================================
     3. 自定义光标
     ============================================================ */
  function initCursor() {
    if (!finePointer || reduceMotion) return;
    var dot = $(".cursor-dot");
    var ring = $(".cursor-ring");
    if (!dot || !ring) return;
    d.body.classList.add("has-cursor");

    var mx = w.innerWidth / 2, my = w.innerHeight / 2;
    var rx = mx, ry = my;
    var shown = false;

    w.addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY;
      if (!shown) { shown = true; dot.style.opacity = "1"; ring.style.opacity = "1"; }
      dot.style.transform = "translate(" + (mx) + "px," + (my) + "px) translate(-50%,-50%)";
    }, { passive: true });

    (function ringLoop() {
      rx = lerp(rx, mx, 0.16);
      ry = lerp(ry, my, 0.16);
      ring.style.transform = "translate(" + rx + "px," + ry + "px) translate(-50%,-50%)";
      w.requestAnimationFrame(ringLoop);
    })();

    var HOVER_SEL = "a, button, .filter-btn, .acc-btn, input, textarea, select, .tab-btn, .nav-toggle, [data-cursor]";
    var MEDIA_SEL = "[data-cursor-media]";
    var labelEl = $(".cursor-label", ring);

    d.addEventListener("mouseover", function (e) {
      var t = e.target;
      if (!t || !(t instanceof Element)) return;
      if (t.closest(MEDIA_SEL)) {
        ring.classList.add("is-media");
        if (labelEl) {
          var txt = t.closest("[data-cursor-media]").getAttribute("data-cursor-media");
          labelEl.textContent = txt || "查看";
        }
      } else if (t.closest(HOVER_SEL)) {
        ring.classList.add("is-hover");
      }
    });
    d.addEventListener("mouseout", function (e) {
      var t = e.target;
      if (!t || !(t instanceof Element)) return;
      if (t.closest(MEDIA_SEL)) ring.classList.remove("is-media");
      if (t.closest(HOVER_SEL)) ring.classList.remove("is-hover");
    });
    d.addEventListener("mousedown", function () { ring.style.transform += " scale(0.86)"; });
    d.addEventListener("mouseup", function () { ring.style.transform += " scale(1)"; });
  }

  /* ============================================================
     4. 顶栏 / 滚动进度 / 移动菜单
     ============================================================ */
  function initHeader() {
    var header = $(".site-header");
    if (!header) return;

    var progress = $(".scroll-progress", header);
    var menu = $("#mobileMenu");
    var toggle = $(".nav-toggle");
    var lastY = w.scrollY || 0;

    function onScroll() {
      var y = w.scrollY || 0;
      header.classList.toggle("is-scrolled", y > 24);
      var docH = d.documentElement.scrollHeight - w.innerHeight;
      if (progress) {
        progress.style.transform = "scaleX(" + (docH > 0 ? y / docH : 0) + ")";
      }
      lastY = y;
    }
    w.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // 移动菜单
    if (toggle && menu) {
      var closeMenu = function () {
        menu.classList.remove("open");
        toggle.classList.remove("open");
        header.classList.remove("is-menu-open");
        d.body.classList.remove("is-locked");
        toggle.setAttribute("aria-expanded", "false");
      };
      toggle.addEventListener("click", function () {
        var open = menu.classList.toggle("open");
        toggle.classList.toggle("open", open);
        header.classList.toggle("is-menu-open", open);
        d.body.classList.toggle("is-locked", open);
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        // 错峰显现菜单链接
        $$(".mobile-menu__link", menu).forEach(function (a, i) {
          a.style.transitionDelay = (open ? 0.08 + i * 0.06 : 0) + "s";
        });
        if (!open) setTimeout(function () { d.body.classList.remove("is-locked"); }, 300);
      });
      // 点击遮罩空白处关闭
      menu.addEventListener("click", function (e) {
        if (e.target === menu) closeMenu();
      });
      $$(".mobile-menu a", menu).forEach(function (a) {
        a.addEventListener("click", closeMenu);
      });
      d.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && menu.classList.contains("open")) closeMenu();
      });
    }
  }

  /* ============================================================
     5. Cosmos 粒子星空（首页）
     ============================================================ */
  function initCosmos() {
    var canvas = $("#cosmos");
    if (!canvas) return;
    if (!canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var W = 0, H = 0, DPR = Math.min(w.devicePixelRatio || 1, 2);
    var stars = [];
    var mouse = { x: -9999, y: -9999, active: false };
    var running = false;
    var rafId = null;
    var reduced = reduceMotion;
    var linkDist = 130;

    function resize() {
      var parent = canvas.parentElement;
      W = parent.clientWidth;
      H = parent.clientHeight;
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      seed();
    }

    function seed() {
      var count = Math.floor((W * H) / (reduced ? 9000 : 4200));
      count = clamp(count, 40, 240);
      stars = [];
      for (var i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: Math.random() * 1.4 + 0.25,
          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.12,
          tw: Math.random() * Math.PI * 2,
          tws: 0.4 + Math.random() * 1.2,
          hue: Math.random() > 0.82 ? "255, 90, 46" : (Math.random() > 0.5 ? "180, 240, 250" : "210, 220, 245")
        });
      }
    }

    function frame(t) {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);

      var i, j, s;
      for (i = 0; i < stars.length; i++) {
        s = stars[i];
        s.x += s.vx; s.y += s.vy;
        s.tw += 0.016 * s.tws;
        if (s.x < -10) s.x = W + 10; else if (s.x > W + 10) s.x = -10;
        if (s.y < -10) s.y = H + 10; else if (s.y > H + 10) s.y = -10;

        // 鼠标吸引
        if (mouse.active) {
          var dx = mouse.x - s.x, dy = mouse.y - s.y;
          var dist2 = dx * dx + dy * dy;
          if (dist2 < 14400) {
            var d = Math.sqrt(dist2) || 1;
            var f = (120 - d) / 120;
            s.x -= (dx / d) * f * 0.8;
            s.y -= (dy / d) * f * 0.8;
          }
        }

        var twinkle = 0.55 + 0.45 * Math.sin(s.tw);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * (0.6 + twinkle * 0.6), 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + s.hue + "," + (0.25 + 0.6 * twinkle) + ")";
        ctx.fill();
      }

      // 连线
      ctx.lineWidth = 0.5;
      for (i = 0; i < stars.length; i++) {
        for (j = i + 1; j < stars.length; j++) {
          var a = stars[i], b = stars[j];
          var dx = a.x - b.x, dy = a.y - b.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < linkDist * linkDist) {
            var alpha = (1 - Math.sqrt(d2) / linkDist) * 0.16;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = "rgba(140, 190, 230," + alpha + ")";
            ctx.stroke();
          }
        }
      }
      rafId = w.requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      rafId = w.requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      if (rafId) w.cancelAnimationFrame(rafId);
    }

    w.addEventListener("resize", resize, { passive: true });
    if (finePointer) {
      canvas.parentElement.addEventListener("mousemove", function (e) {
        var r = canvas.getBoundingClientRect();
        mouse.x = e.clientX - r.left;
        mouse.y = e.clientY - r.top;
        mouse.active = true;
      }, { passive: true });
      canvas.parentElement.addEventListener("mouseleave", function () {
        mouse.active = false;
        mouse.x = -9999; mouse.y = -9999;
      });
    }

    // 只在可视时渲染
    if (IO_OK) {
      var io = new IntersectionObserver(function (en) {
        en.forEach(function (e) { if (e.isIntersecting) start(); else stop(); });
      }, { threshold: 0.02 });
      io.observe(canvas);
    } else {
      start();
    }
    d.addEventListener("visibilitychange", function () {
      if (d.hidden) stop(); else if (isVisible(canvas)) start();
    });

    resize();
    if (IO_OK && isVisible(canvas)) start();
    if (IO_OK === false) start();
  }

  /* ============================================================
     6. 滚动显现（reveal）+ 时间线描线
     ============================================================ */
  function initReveal() {
    // 通用 data-reveal
    var els = $$("[data-reveal]");
    if (IO_OK) {
      var io = new IntersectionObserver(function (en) {
        en.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -7% 0px" });
      els.forEach(function (el) { io.observe(el); });
    } else {
      els.forEach(function (el) { el.classList.add("is-in"); });
    }

    // 时间线：行内进度
    var line = $(".journey__line span");
    var journey = $(".journey");
    if (line && journey) {
      var items = $$(".journey__item");
      var prev = -1;
      var draw = function (progress, idx) {
        line.style.transform = "scaleY(" + clamp(progress, 0, 1) + ")";
        for (var i = 0; i < items.length; i++) {
          if (i <= idx) items[i].classList.add("is-lit");
        }
      };
      var onScroll = function () {
        var r = journey.getBoundingClientRect();
        var vh = w.innerHeight || 1;
        if (r.bottom < 0 || r.top > vh) return;
        var p = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.4), 0, 1);
        var idx = clamp(Math.floor(p * items.length), 0, items.length - 1);
        if (idx !== prev) { prev = idx; draw(p, idx); }
        else if (p <= 0) draw(0, -1);
      };
      w.addEventListener("scroll", onScroll, { passive: true });
      w.addEventListener("resize", onScroll, { passive: true });
      setTimeout(onScroll, reduceMotion ? 0 : 400);
    }
  }

  /* ============================================================
     7. 计数器
     ============================================================ */
  function initCounters() {
    var nums = $$("[data-count]");
    if (!nums.length) return;
    var run = function (el) {
      var target = parseFloat(el.getAttribute("data-count"));
      var dec = parseInt(el.getAttribute("data-decimals") || "0", 10);
      var prefix = el.getAttribute("data-prefix") || "";
      var suffix = el.getAttribute("data-suffix") || "";
      var dur = reduceMotion ? 10 : parseInt(el.getAttribute("data-dur") || "1800", 10);
      var t0 = null;
      function fmt(v) { return prefix + v.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + suffix; }
      el.textContent = fmt(0);
      function step(ts) {
        if (!t0) t0 = ts;
        var p = clamp((ts - t0) / dur, 0, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(target * eased);
        if (p < 1) w.requestAnimationFrame(step);
        else el.textContent = fmt(target);
      }
      w.requestAnimationFrame(step);
    };
    if (IO_OK) {
      var io = new IntersectionObserver(function (en) {
        en.forEach(function (e) {
          if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
        });
      }, { threshold: 0.4 });
      nums.forEach(function (n) { io.observe(n); });
    } else {
      nums.forEach(run);
    }
  }

  /* ============================================================
     8. 倒计时
     ============================================================ */
  function initCountdown() {
    var els = $$("[data-countdown-to]");
    els.forEach(function (el) {
      var base = new Date(el.getAttribute("data-countdown-to")).getTime();
      var now = Date.now();
      while (base < now) base += 90 * 24 * 3600 * 1000; // 若已过期自动顺延

      var cols = $$(".cd-col", el);
      var keys = ["dd", "hh", "mm", "ss"];
      var pad = function (n) { return String(n).padStart(2, "0"); };
      var lastVals = [null, null, null, null];

      function tick() {
        var diff = Math.max(0, base - Date.now());
        var d = Math.floor(diff / 86400000);
        var h = Math.floor((diff % 86400000) / 3600000);
        var m = Math.floor((diff % 3600000) / 60000);
        var s = Math.floor((diff % 60000) / 1000);
        var vals = [pad(d), pad(h), pad(m), pad(s)];
        cols.forEach(function (col, i) {
          var num = $(".cd-num", col);
          if (!num) return;
          if (lastVals[i] !== vals[i]) {
            col.classList.remove("flip");
            void col.offsetWidth; // reflow
            col.classList.add("flip");
            num.textContent = vals[i];
            lastVals[i] = vals[i];
          }
        });
      }
      tick();
      setInterval(tick, 1000);
    });
  }

  /* ============================================================
     9. 鼠标视差
     ============================================================ */
  function initParallax() {
    if (reduceMotion) return;
    var els = $$("[data-parallax]");
    if (!els.length) return;
    var ticking = false;

    function update() {
      ticking = false;
      var vh = w.innerHeight;
      els.forEach(function (el) {
        var speed = parseFloat(el.getAttribute("data-parallax")) || 0.12;
        var r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        // 以视口中点为 0
        var center = (r.top + r.height / 2) - vh / 2;
        el.style.transform = "translate3d(0," + (center * speed * -1).toFixed(1) + "px,0)";
      });
    }
    w.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; w.requestAnimationFrame(update); }
    }, { passive: true });
    w.addEventListener("resize", function () {
      if (!ticking) { ticking = true; w.requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ============================================================
     10. 磁性按钮
     ============================================================ */
  function initMagnetic() {
    if (!finePointer || reduceMotion) return;
    $$("[data-magnetic]").forEach(function (el) {
      var strength = parseFloat(el.getAttribute("data-magnetic")) || 0.28;
      var move = function (e) {
        var r = el.getBoundingClientRect();
        var x = e.clientX - (r.left + r.width / 2);
        var y = e.clientY - (r.top + r.height / 2);
        el.style.transform = "translate(" + (x * strength).toFixed(1) + "px," + (y * strength).toFixed(1) + "px)";
      };
      el.addEventListener("mousemove", move, { passive: true });
      el.addEventListener("mouseleave", function () {
        el.style.transition = "transform 0.6s cubic-bezier(0.16,1,0.3,1)";
        el.style.transform = "";
        setTimeout(function () { el.style.transition = ""; }, 650);
      });
    });
  }

  /* ============================================================
     11. 3D 倾斜卡
     ============================================================ */
  function initTilt() {
    if (!finePointer || reduceMotion) return;
    $$(".tilt-wrap").forEach(function (wrap) {
      var card = $(".tilt-card", wrap) || wrap;
      var maxTilt = parseFloat(wrap.getAttribute("data-tilt")) || 9;

      wrap.addEventListener("mousemove", function (e) {
        var r = wrap.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        var rx = (0.5 - py) * maxTilt;
        var ry = (px - 0.5) * maxTilt;
        card.style.transition = "transform 0.1s ease-out";
        card.style.transform = "perspective(900px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg) translateY(-4px)";
        card.style.setProperty("--gx", (px * 100).toFixed(1) + "%");
        card.style.setProperty("--gy", (py * 100).toFixed(1) + "%");
      });
      wrap.addEventListener("mouseleave", function () {
        card.classList.add("is-static");
        card.style.transform = "";
        setTimeout(function () { card.classList.remove("is-static"); card.style.transition = ""; }, 700);
      });
    });
  }

  /* ============================================================
     12. 标签页
     ============================================================ */
  function initTabs() {
    $$("[data-tabs]").forEach(function (root) {
      var btns = $$(".tab-btn", root);
      var panels = $$(".tabpanel", root);
      btns.forEach(function (btn) {
        btn.addEventListener("click", function () {
          var target = btn.getAttribute("data-tab");
          btns.forEach(function (b) {
            var act = b === btn;
            b.classList.toggle("active", act);
            b.setAttribute("aria-selected", act ? "true" : "false");
          });
          panels.forEach(function (p) {
            var show = !target || p.id === target || p.getAttribute("data-tab") === target;
            p.classList.toggle("active", show);
          });
        });
      });
    });
  }

  /* ============================================================
     13. 折叠
     ============================================================ */
  function initAccordion() {
    $$(".accordion").forEach(function (acc) {
      var single = acc.getAttribute("data-multi") === null;
      $$(".acc-btn", acc).forEach(function (btn) {
        btn.addEventListener("click", function () {
          var item = btn.closest(".acc-item");
          var isOpen = item.classList.contains("open");
          if (single) {
            $$(".acc-item", acc).forEach(function (it) {
              it.classList.remove("open");
              $(".acc-btn", it).setAttribute("aria-expanded", "false");
            });
          }
          if (!isOpen) {
            item.classList.add("open");
            btn.setAttribute("aria-expanded", "true");
          }
        });
      });
    });
  }

  /* ============================================================
     14. 通用滑块（评价/轮播）
     ============================================================ */
  function initSlider() {
    $$("[data-slider]").forEach(function (root) {
      var viewport = $(".slider__viewport", root);
      var track = $(".slider__track", root);
      if (!viewport || !track) return;
      var slides = $$(".slide", track);
      if (slides.length < 2) return;
      var index = 0;
      var timer = null;
      var autoplay = root.getAttribute("data-autoplay") !== "false";
      var interval = parseInt(root.getAttribute("data-interval") || "6000", 10);
      var dotsWrap = $(".slider__dots", root);

      function go(i, instant) {
        index = (i + slides.length) % slides.length;
        track.style.transform = "translateX(" + (-index * 100) + "%)";
        if (instant) track.style.transition = "none";
        // dots
        $$(".slider__dot", dotsWrap).forEach(function (d, di) {
          d.classList.toggle("active", di === index);
        });
      }
      function play() { if (autoplay) timer = setInterval(function () { go(index + 1); }, interval); }
      function stop() { if (timer) { clearInterval(timer); timer = null; } }

      // 建点
      if (dotsWrap) {
        dotsWrap.innerHTML = "";
        slides.forEach(function (_, i) {
          var b = d.createElement("button");
          b.className = "slider__dot";
          b.setAttribute("aria-label", "第 " + (i + 1) + " 张");
          b.addEventListener("click", function () { stop(); go(i); play(); });
          dotsWrap.appendChild(b);
        });
      }

      var prev = $("[data-slider-prev]", root) || $("#sliderPrev");
      var next = $("[data-slider-next]", root) || $("#sliderNext");
      if (prev) prev.addEventListener("click", function () { stop(); go(index - 1); play(); });
      if (next) next.addEventListener("click", function () { stop(); go(index + 1); play(); });

      // 悬停暂停 + 触摸滑动
      root.addEventListener("mouseenter", stop);
      root.addEventListener("mouseleave", play);
      var startX = null;
      viewport.addEventListener("pointerdown", function (e) { startX = e.clientX; stop(); });
      w.addEventListener("pointerup", function (e) {
        if (startX === null) return;
        var dx = e.clientX - startX;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        startX = null;
        play();
      });
      // 键盘
      root.setAttribute("tabindex", "0");
      root.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight") { stop(); go(index + 1); play(); }
        if (e.key === "ArrowLeft") { stop(); go(index - 1); play(); }
      });

      go(0, true);
      play();
    });
  }

  /* ============================================================
     15. 价格切换（月/年）
     ============================================================ */
  function initPricingToggle() {
    $$("[data-pricing]").forEach(function (root) {
      var btns = $$("[data-period]", root);
      var state = { period: "annual" };
      function apply() {
        $$(".pricing-tier", root).forEach(function (tier) {
          var val = $(".price-val", tier);
          if (!val) return;
          var v = val.getAttribute("data-" + state.period) || val.getAttribute("data-annual");
          val.style.opacity = "0";
          val.style.transform = "translateY(8px)";
          setTimeout(function () {
            val.textContent = v;
            val.style.opacity = "1";
            val.style.transform = "none";
          }, 180);
        });
      }
      btns.forEach(function (b) {
        b.addEventListener("click", function () {
          state.period = b.getAttribute("data-period");
          btns.forEach(function (x) { x.classList.toggle("active", x === b); });
          apply();
        });
      });
    });
  }

  /* ============================================================
     16. 项目过滤
     ============================================================ */
  function initFilter() {
    $$("[data-filter-bar]").forEach(function (bar) {
      var grid = $("[data-filter-grid]");
      if (!grid) return;
      var items = $$(".project-item", grid);
      var catEl = $(".filter-count");
      var allCat = bar.getAttribute("data-filter-all") || "all";

      function showFiltered(cat) {
        var visible = 0;
        items.forEach(function (it) {
          var c = it.getAttribute("data-category") || "other";
          var show = cat === allCat || c === cat;
          it.classList.add("is-in");
          if (show) {
            it.classList.remove("is-hide");
            it.classList.remove("is-hiding");
            it.classList.remove("pop");
            void it.offsetWidth;
            it.classList.add("pop");
            visible++;
          } else {
            it.classList.add("is-hiding");
            setTimeout(function () {
              if (!it.classList.contains("is-hide")) it.classList.add("is-hide");
            }, 380);
          }
        });
        if (catEl) catEl.textContent = String(visible).padStart(2, "0");
        // 清除完成后的 hiding 状态
        setTimeout(function () {
          items.forEach(function (it) {
            if (it.classList.contains("is-hide")) {
              it.classList.remove("is-hiding");
            }
          });
        }, 460);
      }

      $$(".filter-btn", bar).forEach(function (b) {
        b.addEventListener("click", function () {
          $$(".filter-btn", bar).forEach(function (x) { x.classList.toggle("active", x === b); });
          showFiltered(b.getAttribute("data-filter"));
        });
      });
      showFiltered(allCat);
    });
  }

  /* ============================================================
     17. 灯箱
     ============================================================ */
  function initLightbox() {
    var lb = $("#lightbox");
    if (!lb) return;
    var stage = $(".lb-media", lb);
    var cap = $(".lb-cap strong", lb);
    var countEl = $(".lb-count", lb);
    var items = $$("[data-lb-item]");
    if (!items.length) return;
    var index = 0;

    function render() {
      var it = items[index];
      var poster = it.getAttribute("data-poster") || "poster--grid";
      var label = it.getAttribute("data-label") || "远穹任务";
      stage.innerHTML = '<div class="art-poster ' + poster + '"><div class="poster__noise"></div><div class="poster__glyph">' + (it.getAttribute("data-glyph") || "◈") + "</div><div class=\"poster-veil\"></div></div>";
      stage.style.background = "var(--bg-1)";
      if (cap) cap.textContent = label;
      if (countEl) countEl.textContent = (index + 1) + " / " + items.length;
    }
    function open(i) {
      index = i;
      render();
      lb.classList.add("open");
      d.body.classList.add("is-locked");
    }
    function close() {
      lb.classList.remove("open");
      d.body.classList.remove("is-locked");
    }

    items.forEach(function (it, i) {
      it.addEventListener("click", function (e) {
        e.preventDefault();
        open(i);
      });
    });

    var closeBtn = $(".lb-close", lb);
    var navPrev = $(".lb-nav--prev", lb);
    var navNext = $(".lb-nav--next", lb);
    if (closeBtn) closeBtn.addEventListener("click", close);
    if (navPrev) navPrev.addEventListener("click", function () { index = (index - 1 + items.length) % items.length; render(); });
    if (navNext) navNext.addEventListener("click", function () { index = (index + 1) % items.length; render(); });
    lb.addEventListener("click", function (e) { if (e.target === lb) close(); });
    d.addEventListener("keydown", function (e) {
      if (!lb.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight" && navNext) navNext.click();
      if (e.key === "ArrowLeft" && navPrev) navPrev.click();
    });
  }

  /* ============================================================
     18. Toast
     ============================================================ */
  var toastTimer = null;
  function toast(msg, type) {
    var el = $("#toast");
    if (!el) {
      el = d.createElement("div");
      el.id = "toast";
      el.className = "toast";
      d.body.appendChild(el);
    }
    el.className = "toast" + (type === "err" ? " toast--err" : "");
    el.innerHTML = '<span class="t-ico">' + (type === "err" ? "✕" : "✓") + "</span><span class=\"t-msg\"></span>";
    $(".t-msg", el).textContent = msg;
    el.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 4200);
  }
  w.ASTRUMToast = toast;

  /* ============================================================
     19. 表单（联系 + 订阅）
     ============================================================ */
  function initForms() {
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    // 通用校验绑定
    $$("form[data-validate]").forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var ok = true;
        $$("[required]", form).forEach(function (f) {
          var wrap = f.closest(".field");
          var val = (f.value || "").trim();
          var bad = !val;
          if (!bad && f.type === "email") bad = !EMAIL_RE.test(val);
          if (f.tagName === "SELECT" && !val) bad = true;
          if (wrap) {
            wrap.classList.toggle("is-error", bad);
            if (bad) f.setAttribute("aria-invalid", "true");
            else f.removeAttribute("aria-invalid");
          }
          if (bad) ok = false;
        });
        var submitBtn = $("[type=submit]", form);
        var mode = form.getAttribute("data-form");
        if (!ok) {
          toast("请检查标红字段后再提交", "err");
          var firstErr = $(".field.is-error input, .field.is-error textarea, .field.is-error select", form);
          if (firstErr) firstErr.focus();
          return;
        }
        // 模拟提交
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = mode === "newsletter" ? "订阅中…" : "发送中…";
        }
        setTimeout(function () {
          form.reset();
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = mode === "newsletter" ? "订阅" : "发送消息";
          }
          if (mode === "newsletter") {
            form.classList.add("done");
            toast("订阅成功，欢迎加入远穹星信");
          } else {
            toast("已收到！我们将在 24 小时内回复你");
          }
        }, 1400);
      });
    });

    // 输入即时清除错误
    $$(".field input, .field textarea, .field select").forEach(function (f) {
      f.addEventListener("input", function () {
        var wrap = f.closest(".field");
        if (wrap) wrap.classList.remove("is-error");
      });
    });
  }

  /* ============================================================
     20. 返回顶部
     ============================================================ */
  function initToTop() {
    var btn = $(".to-top");
    if (!btn) return;
    var onScroll = function () {
      btn.classList.toggle("show", (w.scrollY || 0) > 700);
    };
    w.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    btn.addEventListener("click", function () {
      w.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
  }

  /* ============================================================
     21. 页脚年份
     ============================================================ */
  function initFooterYear() {
    $$(".js-year").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  /* ============================================================
     22. 当前页导航高亮（HTML 已含 active，这里兜底）
     ============================================================ */
  function initNavActive() {
    var path = (w.location.pathname.split("/").pop() || "index.html").toLowerCase();
    if (!path) path = "index.html";
    $$(".nav-link, .mobile-menu__link, .foot-links a[data-page]").forEach(function (a) {
      var href = (a.getAttribute("href") || "").split("#")[0].toLowerCase();
      if (!href) href = "index.html";
      if (href === path) a.classList.add("active");
    });
  }

  /* ============================================================
     23. 通用 data-toast-msg 提示（占位内容友好提示）
     ============================================================ */
  function initToastLinks() {
    d.addEventListener("click", function (e) {
      var t = e.target && e.target.closest ? e.target.closest("[data-toast-msg]") : null;
      if (t) {
        e.preventDefault();
        toast(t.getAttribute("data-toast-msg") || "示例内容建设中");
      }
    });
  }

  /* ============================================================
     Boot
     ============================================================ */
  function boot() {
    initNavActive();
    initFooterYear();
    initPreloader();
    initCursor();
    initHeader();
    initCosmos();
    initReveal();
    initCounters();
    initCountdown();
    initParallax();
    initMagnetic();
    initTilt();
    initTabs();
    initAccordion();
    initSlider();
    initPricingToggle();
    initFilter();
    initLightbox();
    initForms();
    initToTop();
    initToastLinks();
  }

  if (d.readyState === "loading") {
    d.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  /* 重新触发（若页面内含动态加载内容时可手动调用） */
  w.ASTRUM = { reinit: boot, toast: toast };
})(window, document);
