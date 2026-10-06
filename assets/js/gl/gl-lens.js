/* ============================================================
   ASTRUM 远穹 — 程序化变形宽银幕镜头光晕
   File : assets/js/gl/gl-lens.js
   说明 : 全屏透明画布，用单个片元着色器程序化绘制——
          核心光斑 / 水平拉丝（anamorphic streak）/ 光圈多边形鬼影 / 色散光环。
          没有任何贴图，全部实时合成。
   依赖 : gl-core.js
   ============================================================ */
(function (w, d) {
  "use strict";

  var GL = (w.ASTRUM = w.ASTRUM || {}).GL;
  if (!GL) return;

  var FRAG = [
    "precision highp float;",
    "varying vec2 v_uv;",
    "uniform vec2  u_res;",
    "uniform float u_time;",
    "uniform vec2  u_light;",     /* 光源位置（uv 空间） */
    "uniform vec2  u_mouse;",
    "uniform float u_intensity;",
    "uniform float u_aspect;",
    "uniform vec3  u_c1;",        /* 暖色 */
    "uniform vec3  u_c2;",        /* 冷色 */
    "",
    "/* 正多边形（光圈叶片）有符号距离，inradius = r */",
    "float polySDF(vec2 p, float r, float blades){",
    "  float a = atan(p.y, p.x);",
    "  float b = 6.2831853 / blades;",
    "  float k = cos(floor(0.5 + a / b) * b - a);",
    "  return k * length(p) - r;",
    "}",
    "float polyMask(vec2 p, float r, float blades, float soft){",
    "  return smoothstep(soft, -soft * 0.6, polySDF(p, r, blades));",
    "}",
    "",
    "void main(){",
    "  vec2 uv = v_uv;",
    "  vec2 ar = vec2(u_aspect, 1.0);",
    "  vec2 L  = u_light;",
    "  vec3 col = vec3(0.0);",
    "",
    "  /* ---- 光源核心 ---- */",
    "  vec2 dv = (uv - L) * ar;",
    "  float dist = length(dv);",
    "  float core = exp(-dist * dist * 1500.0) * 3.2;",
    "  float halo = exp(-dist * 9.0) * 0.5 + exp(-dist * 2.6) * 0.16;",
    "  col += u_c1 * (core + halo);",
    "",
    "  /* ---- 变形宽银幕水平拉丝 ---- */",
    "  vec2 sd = (uv - L) * ar;",
    "  float streakY = exp(-abs(sd.y) * 900.0);",
    "  float streakX = exp(-abs(sd.x) * 2.1) + exp(-abs(sd.x) * 0.85) * 0.55;",
    "  vec3 streakCol = mix(u_c2, vec3(0.85, 0.93, 1.0), 0.45);",
    "  col += streakCol * streakY * streakX * 0.9;",
    "",
    "  /* ---- 光线轴上的光圈鬼影 ---- */",
    "  vec2 center = vec2(0.5, 0.5);",
    "  vec2 axis = center - L;",
    "  for(int i = 0; i < 7; i++){",
    "    float fi = float(i) / 6.0;",
    "    /* 从光源向画面中心、再越过中心继续延伸 */",
    "    float k = -0.55 + fi * 1.85;",
    "    vec2 gp = L + axis * (k * -1.0);",
    "    vec2 gpd = gp - center;",
    "    float gr = 0.016 + fract(sin(float(i) * 12.9898) * 43758.5453) * 0.052;",
    "    vec2 pd = (uv - gp) * ar;",
    "    float blade = 5.0 + mod(float(i), 3.0);",
    "    float m = polyMask(pd, gr, blade, 0.004);",
    "    float rim = smoothstep(0.0, gr * 0.42, length(pd)) * (1.0 - smoothstep(gr * 0.42, gr, length(pd)));",
    "    vec3 gc = mix(u_c1, u_c2, fract(float(i) * 0.37));",
    "    float fade = 1.0 - clamp(length(gpd) * 1.25, 0.0, 0.85);",
    "    col += gc * (m * 0.5 + rim * 0.32) * fade;",
    "  }",
    "",
    "  /* ---- 冷色环（玻璃反射感） ---- */",
    "  float ring = smoothstep(0.34, 0.36, dist) * (1.0 - smoothstep(0.36, 0.385, dist));",
    "  col += u_c2 * ring * 0.35;",
    "",
    "  col *= u_intensity;",
    "",
    "  /* 轻微跟随鼠标的视差 */",
    "  float a = max(max(col.r, col.g), col.b) * (1.0 + u_mouse.x * 0.06);",
    "  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));",
    "}"
  ].join("\n");

  function mount(canvas, opts) {
    opts = opts || {};
    var engine = GL.create(canvas, { alpha: true });
    if (!engine) return null;

    var prog = engine.program("lens", GL.VERT_FULLSCREEN, FRAG);
    if (!prog) { engine.dispose(); return null; }

    var gl = engine.gl;
    var host = canvas.parentNode;
    if (host) host.classList.add("is-in");
    if (GL.reduceMotion) engine.stop();

    var light = { x: opts.x === undefined ? 0.28 : opts.x, y: opts.y === undefined ? 0.72 : opts.y };
    var base = { x: light.x, y: light.y };

    function syncFromHost() {
      var src = null;
      if (opts.follow) src = typeof opts.follow === "string" ? d.querySelector(opts.follow) : opts.follow;
      if (!src) return;
      var r = src.getBoundingClientRect();
      if (!r.width && !r.height) return;
      base.x = (r.left + r.width * 0.5) / (w.innerWidth || 1);
      base.y = 1 - (r.top + r.height * 0.5) / (w.innerHeight || 1);
    }
    syncFromHost();
    w.addEventListener("scroll", syncFromHost, { passive: true });
    w.addEventListener("resize", syncFromHost);

    engine.onFrame = function () {
      var s = engine.size();
      var p = GL.tickPointer(0.035);
      /* 光源随时间呼吸 + 轻微跟随视差 */
      var dx = Math.sin(engine.time * 0.21) * 0.018;
      var dy = Math.cos(engine.time * 0.17) * 0.014;
      light.x += ((base.x + dx + (p.x - 0.5) * 0.03) - light.x) * 0.05;
      light.y += ((base.y + dy + (p.y - 0.5) * 0.03) - light.y) * 0.05;

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.useProgram(prog.program);
      gl.uniform2f(prog.u.u_res, s.w, s.h);
      gl.uniform1f(prog.u.u_time, engine.time);
      gl.uniform2f(prog.u.u_light, light.x, light.y);
      gl.uniform2f(prog.u.u_mouse, p.x - 0.5, p.y - 0.5);
      gl.uniform1f(prog.u.u_intensity, opts.intensity === undefined ? 0.85 : opts.intensity);
      gl.uniform1f(prog.u.u_aspect, (s.w / Math.max(1, s.h)));
      gl.uniform3fv(prog.u.u_c1, opts.c1 || [1.0, 0.62, 0.34]);
      gl.uniform3fv(prog.u.u_c2, opts.c2 || [0.42, 0.78, 1.0]);
      engine.drawQuad(prog);
    };

    return { engine: engine, dispose: function () { engine.dispose(); } };
  }

  GL.lens = { mount: mount };
})(window, document);
