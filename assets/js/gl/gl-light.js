/* ============================================================
   ASTRUM 远穹 — 体积尘埃 / 光尘粒子
   File : assets/js/gl/gl-light.js
   说明 : 一个加性混合的点精灵场，用来给内页首屏"空气感"。
          成本极低（无离屏渲染），是各页共用的基础氛围层。
   依赖 : gl-core.js
   ============================================================ */
(function (w, d) {
  "use strict";

  var GL = (w.ASTRUM = w.ASTRUM || {}).GL;
  if (!GL) return;

  var VERT = [
    "attribute vec2  a_seed;",
    "attribute float a_rnd;",
    "uniform float u_time;",
    "uniform vec2  u_res;",
    "uniform vec2  u_mouse;",
    "uniform float u_scroll;",
    "uniform float u_spread;",
    "varying float v_a;",
    "varying float v_tint;",
    "void main(){",
    "  float depth = mix(0.22, 1.0, a_rnd);",
    "  vec2 base = (a_seed * 2.0 - 1.0) * vec2(u_spread, 1.0);",
    "  base.y += u_scroll * (0.22 + depth * 0.75);",
    "  base.x += sin(u_time * 0.055 + a_rnd * 24.0) * 0.055;",
    "  base.y += cos(u_time * 0.047 + a_seed.x * 19.0) * 0.045;",
    "  base += u_mouse * (0.05 + depth * 0.16);",
    "  gl_Position = vec4(base, 0.0, 1.0);",
    "  gl_PointSize = (1.0 + a_rnd * 2.6) * depth * (u_res.y / 900.0) * 3.4;",
    "  v_a = 0.14 + a_rnd * 0.46;",
    "  v_tint = a_seed.x;",
    "}"
  ].join("\n");

  var FRAG = [
    "precision mediump float;",
    "varying float v_a;",
    "varying float v_tint;",
    "uniform vec3 u_c1;",
    "uniform vec3 u_c2;",
    "void main(){",
    "  vec2 c = gl_PointCoord - 0.5;",
    "  float dd = length(c);",
    "  float a = pow(smoothstep(0.5, 0.0, dd), 2.6);",
    "  vec3 col = mix(u_c2, u_c1, v_tint);",
    "  gl_FragColor = vec4(col, a * v_a);",
    "}"
  ].join("\n");

  var ACCENTS = { ember: [1.0, 0.42, 0.22], ice: [0.36, 0.92, 0.9], violet: [0.55, 0.45, 1.0] };

  function mount(canvas, opts) {
    opts = opts || {};
    var engine = GL.create(canvas, { alpha: true });
    var host = canvas.parentNode;
    if (!engine) {
      if (host) host.classList.add("gl-off");
      return null;
    }
    if (host) host.classList.add("gl-on");

    var prog = engine.program("dust", VERT, FRAG);
    if (!prog) { engine.dispose(); return null; }

    var gl = engine.gl;
    var count = opts.count || (engine.tier === "high" ? 900 : 520);
    var seeds = new Float32Array(count * 2);
    var rnds = new Float32Array(count);
    for (var i = 0; i < count; i++) {
      seeds[i * 2] = Math.random();
      seeds[i * 2 + 1] = Math.random();
      rnds[i] = Math.random();
    }

    var bufSeed = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufSeed);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);

    var bufRnd = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufRnd);
    gl.bufferData(gl.ARRAY_BUFFER, rnds, gl.STATIC_DRAW);

    var c1 = ACCENTS[opts.accent] || ACCENTS.ember;
    var c2 = ACCENTS[opts.accent2] || ACCENTS.ice;

    var scroll = { p: 0, target: 0 };
    var hostScroll = canvas.closest("[data-gl-scroll]") || canvas.closest("section") || canvas.parentNode;
    function readScroll() {
      if (!hostScroll) return;
      var r = hostScroll.getBoundingClientRect();
      var h = r.height || 1;
      scroll.target = Math.max(0, Math.min(1, -r.top / h));
    }
    readScroll();
    w.addEventListener("scroll", readScroll, { passive: true });
    w.addEventListener("resize", readScroll);

    var mouse = { x: 0, y: 0 };

    engine.onFrame = function () {
      var s = engine.size();
      var p = GL.tickPointer(0.05);
      mouse.x += ((p.x - 0.5) * 2 - mouse.x) * 0.05;
      mouse.y += ((p.y - 0.5) * 2 - mouse.y) * 0.05;
      scroll.p += (scroll.target - scroll.p) * 0.06;

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.useProgram(prog.program);

      gl.bindBuffer(gl.ARRAY_BUFFER, bufSeed);
      gl.enableVertexAttribArray(prog.a.a_seed);
      gl.vertexAttribPointer(prog.a.a_seed, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, bufRnd);
      gl.enableVertexAttribArray(prog.a.a_rnd);
      gl.vertexAttribPointer(prog.a.a_rnd, 1, gl.FLOAT, false, 0, 0);

      gl.uniform1f(prog.u.u_time, engine.time);
      gl.uniform2f(prog.u.u_res, s.w, s.h);
      gl.uniform2f(prog.u.u_mouse, mouse.x, mouse.y);
      gl.uniform1f(prog.u.u_scroll, scroll.p);
      gl.uniform1f(prog.u.u_spread, opts.spread === undefined ? 1.15 : opts.spread);
      gl.uniform3fv(prog.u.u_c1, c1);
      gl.uniform3fv(prog.u.u_c2, c2);

      gl.drawArrays(gl.POINTS, 0, count);
    };

    if (opts.autoStart === false) engine.stop();

    return {
      engine: engine,
      dispose: function () {
        engine.dispose();
        gl.deleteBuffer(bufSeed);
        gl.deleteBuffer(bufRnd);
      },
      refresh: readScroll
    };
  }

  GL.dust = { mount: mount };
})(window, document);
