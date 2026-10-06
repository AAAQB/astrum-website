/* ============================================================
   ASTRUM 远穹 — 体积星云（电影级 Hero 主视觉）
   File : assets/js/gl/gl-nebula.js
   管线 : Pass A  场景着色  → 离屏 FBO（FBM 体积星云 + 星场 + 等离子核心 + 彗尾）
          Pass B  后处理    → 屏幕（色散 / 辉光 / ACES 色调映射 / 暗角 / 胶片颗粒）
   依赖 : gl-core.js
   ============================================================ */
(function (w, d) {
  "use strict";

  var GL = (w.ASTRUM = w.ASTRUM || {}).GL;
  if (!GL) return;

  var ACCENTS = {
    ember: [1.00, 0.36, 0.16],
    ice: [0.30, 0.90, 0.88],
    violet: [0.46, 0.34, 1.00],
    sunset: [1.00, 0.52, 0.22]
  };

  var SCENE_FS = [
    "precision highp float;",
    "varying vec2 v_uv;",
    "uniform vec2  u_res;",
    "uniform float u_time;",
    "uniform vec2  u_mouse;",
    "uniform float u_scroll;",
    "uniform float u_density;",
    "uniform float u_intensity;",
    "uniform vec3  u_c1;",
    "uniform vec3  u_c2;",
    "uniform vec3  u_c3;",
    "uniform int   u_oct;",
    GL.GLSL_NOISE,
    "",
    "/* 单层星场：网格哈希 + 闪烁 */",
    "float starLayer(vec2 uv, float scale, float thr, float size){",
    "  vec2 g = uv * scale;",
    "  vec2 id = floor(g);",
    "  vec2 f  = fract(g) - 0.5;",
    "  float h = hash21(id);",
    "  if (h < thr) return 0.0;",
    "  vec2 off = (hash22(id) - 0.5) * 0.72;",
    "  float dd = length(f - off);",
    "  float core = smoothstep(size, 0.0, dd);",
    "  float halo = smoothstep(size * 4.5, 0.0, dd) * 0.22;",
    "  float tw = 0.62 + 0.38 * sin(u_time * 1.7 + h * 91.0);",
    "  return (core + halo) * tw * (0.45 + 0.55 * h);",
    "}",
    "",
    "/* 等离子核心：中心辉光 + 体积光芒（角向调制） */",
    "vec3 coreLight(vec2 p, vec2 c, float radius, vec3 tint){",
    "  vec2 dv = p - c;",
    "  float dist = length(dv);",
    "  float ang  = atan(dv.y, dv.x);",
    "  float rays = 0.55 + 0.45 * sin(ang * 11.0 + u_time * 0.9)",
    "                    * sin(ang * 4.0  - u_time * 0.55);",
    "  float body = exp(-dist * dist / (radius * radius));",
    "  float halo = exp(-dist / (radius * 7.0)) * 0.2;",
    "  float shaft = pow(max(0.0, 1.0 - dist / (radius * 12.0)), 2.4) * rays * 0.16;",
    "  return tint * (body * 1.35 + halo + shaft);",
    "}",
    "",
    "/* 偶发彗尾 */",
    "float comet(vec2 p, float t){",
    "  float cyc = fract(t * 0.055);",
    "  if (cyc > 0.16) return 0.0;",
    "  float k = cyc / 0.16;",
    "  vec2  a = vec2(1.25, 0.95);",
    "  vec2  b = vec2(-1.15, -0.35);",
    "  vec2  pos = mix(a, b, k);",
    "  vec2  dir = normalize(b - a);",
    "  vec2  dv  = p - pos;",
    "  float along = dot(dv, dir);",
    "  float perp  = abs(dot(dv, vec2(-dir.y, dir.x)));",
    "  float head  = exp(-dot(dv, dv) * 900.0) * 3.0;",
    "  float tail  = exp(-max(0.0, -along) * 5.5) * exp(-perp * perp * 1400.0) * 1.4;",
    "  return (head + tail) * smoothstep(0.0, 0.12, k) * (1.0 - smoothstep(0.7, 1.0, k));",
    "}",
    "",
    "void main(){",
    "  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;",
    "  float t = u_time;",
    "",
    "  /* 镜头：鼠标微动 + 滚动下潜 */",
    "  vec2 p = uv * 1.32;",
    "  p += u_mouse * 0.22;",
    "  p.y -= u_scroll * 0.85;",
    "  p += vec2(sin(t * 0.05) * 0.06, cos(t * 0.043) * 0.05);",
    "",
    "  /* 域扭曲：让星云有湍流体积感 */",
    "  vec2 q = vec2(fbm(p * 1.05 + t * 0.026, 4),",
    "                fbm(p * 1.05 + vec2(5.2, 1.3) - t * 0.022, 4));",
    "  vec2 r = vec2(fbm(p * 1.55 + 1.45 * q + vec2(1.7, 9.2) + t * 0.018, u_oct),",
    "                fbm(p * 1.55 + 1.45 * q + vec2(8.3, 2.8) - t * 0.015, u_oct));",
    "  float d = fbm(p * 0.85 + 2.35 * r, u_oct);",
    "  float fil = ridged(p * 2.1 + 1.1 * r, u_oct);",
    "",
    "  /* 体积雾密度：越靠上越浓，形成天顶感 */",
    "  float vert = 1.0 - smoothstep(-0.55, 0.85, p.y + u_scroll * 0.6);",
    "  float dens = clamp(pow(d * 1.05 * u_density, 1.35), 0.0, 1.3);",
    "  dens *= mix(0.5, 1.15, vert);",
    "",
    "  /* 银河带：一条斜向的高密度走廊，给画面结构感 */",
    "  float band = exp(-pow((p.y * 0.78 + p.x * 0.34 - 0.04) * 2.3, 2.0));",
    "",
    "  /* 星云配色：亮度随密度增长，而不是把整片染成亮色 */",
    "  vec3 neb  = u_c3 * dens * 0.30;",
    "  neb += u_c2 * pow(dens, 2.6) * 0.40;",
    "  neb += u_c1 * pow(dens, 3.6) * 0.28;",
    "  neb *= mix(0.62, 1.25, fil);",
    "  neb *= mix(0.55, 1.55, band);",
    "  neb  = neb / (1.0 + neb * 0.9);",                       /* 自我压缩，避免死白 */
    "",
    "  /* 星场（三层视差） */",
    "  float st = starLayer(p * 1.0 + u_mouse * 0.1, 92.0,  0.955, 0.035);",
    "  float st2 = starLayer(p * 0.85 + u_mouse * 0.06, 58.0, 0.978, 0.028) * 1.25;",
    "  float st3 = starLayer(p * 1.2 + u_mouse * 0.16, 132.0, 0.968, 0.022) * 0.7;",
    "  vec3  starCol = mix(vec3(0.78, 0.86, 1.0), vec3(1.0, 0.88, 0.72), hash11(floor(p.x * 7.0)) * 0.6);",
    "  vec3 stars = starCol * (st + st2 + st3);",
    "",
    "  /* 等离子核心（放在画面两侧，避免压住正文） */",
    "  vec3 core = coreLight(p, vec2(0.58, 0.40) + u_mouse * 0.05, 0.075, u_c1 * 1.1);",
    "  core += coreLight(p, vec2(-0.72, -0.62) + u_mouse * 0.03, 0.05, u_c2 * 0.8) * 0.5;",
    "",
    "  /* 彗尾 */",
    "  stars += vec3(1.0, 0.92, 0.82) * comet(p, t) * 1.6;",
    "",
    "  vec3 col = neb + stars + core;",
    "  col *= u_intensity;",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  var POST_FS = [
    "precision highp float;",
    "varying vec2 v_uv;",
    "uniform sampler2D u_scene;",
    "uniform vec2  u_res;",
    "uniform float u_time;",
    "uniform float u_sep;",
    "uniform float u_bloom;",
    "uniform float u_vig;",
    "uniform float u_grain;",
    "uniform float u_flash;",
    GL.GLSL_NOISE,
    GL.GLSL_ACES,
    "",
    "void main(){",
    "  vec2 uv = v_uv;",
    "  float d = length(uv - 0.5);",
    "",
    "  /* 径向色散：越靠画面边缘越明显 */",
    "  float k = u_sep * (0.30 + d * 1.75);",
    "  vec2 dir = normalize(uv - 0.5 + vec2(1e-5));",
    "  vec3 c;",
    "  c.r = texture2D(u_scene, uv + dir * k).r;",
    "  c.g = texture2D(u_scene, uv).g;",
    "  c.b = texture2D(u_scene, uv - dir * k).b;",
    "",
    "  /* 双环采样近似辉光 */",
    "  vec3 bl = vec3(0.0);",
    "  for(int i = 0; i < 8; i++){",
    "    float a = 6.2831853 * float(i) / 8.0;",
    "    bl += texture2D(u_scene, uv + vec2(cos(a), sin(a)) * (0.010 + 0.004 * u_bloom)).rgb;",
    "  }",
    "  bl /= 8.0;",
    "  vec3 bl2 = vec3(0.0);",
    "  for(int i = 0; i < 8; i++){",
    "    float a = 6.2831853 * (float(i) + 0.5) / 8.0;",
    "    bl2 += texture2D(u_scene, uv + vec2(cos(a), sin(a)) * (0.032 + 0.012 * u_bloom)).rgb;",
    "  }",
    "  bl2 /= 8.0;",
    "  c += (bl * 0.26 + bl2 * 0.12) * u_bloom;",
    "",
    "  /* 转场白闪（页面切换时由 transitions.js 抬起） */",
    "  c += u_flash;",
    "",
    "  c = aces(c * 0.95);",
    "",
    "  /* 暗角：让中间亮、四周沉下去，把注意力收进画面 */",
    "  c *= 1.0 - u_vig * smoothstep(0.22, 1.02, d);",
    "",
    "  /* 胶片颗粒 + 抖动（消除色带） */",
    "  float g = hash21(uv * u_res + fract(u_time) * 431.0) - 0.5;",
    "  c += g * u_grain;",
    "  c += (hash21(uv * u_res * 1.7 + 17.0) - 0.5) / 255.0;",
    "",
    "  gl_FragColor = vec4(c, 1.0);",
    "}"
  ].join("\n");

  function mount(canvas, opts) {
    opts = opts || {};
    var engine = GL.create(canvas, { alpha: false });
    var host = canvas.parentNode;

    if (!engine) {
      if (host) host.classList.add("gl-off");
      return null;
    }
    if (host) host.classList.add("gl-on");

    /* 八度数按档位编译成常量，避免低端设备上循环过深 */
    var oct = engine.tier === "high" ? 5 : 4;
    var sceneSrc = SCENE_FS.replace("uniform int   u_oct;", "const int u_oct = " + oct + ";");
    var scene = engine.program("nebulaScene", GL.VERT_FULLSCREEN, sceneSrc);
    var post = engine.program("nebulaPost", GL.VERT_FULLSCREEN, POST_FS);
    if (!scene || !post) { engine.dispose(); return null; }

    var accent = ACCENTS[opts.accent] || ACCENTS.ember;
    var secondary = ACCENTS[opts.accent2] || ACCENTS.ice;
    var tertiary = ACCENTS[opts.accent3] || ACCENTS.violet;

    var rt = null;
    var scroll = { p: 0, target: 0 };

    function readScroll() {
      var host = canvas.closest("[data-gl-scroll]") || canvas.closest("section") || canvas.parentNode;
      if (!host) return;
      var r = host.getBoundingClientRect();
      var h = r.height || 1;
      scroll.target = Math.max(0, Math.min(1, -r.top / h));
    }
    readScroll();
    w.addEventListener("scroll", readScroll, { passive: true });
    w.addEventListener("resize", readScroll);

    var mouse = { x: 0, y: 0 };
    var flash = { v: 0 };
    w.addEventListener("astrum:flash", function (e) {
      flash.v = (e && e.detail && e.detail.amount) || 0.07;
    });

    engine.onFrame = function () {
      var s = engine.size();
      if (!rt) rt = engine.createRT(s.w, s.h);
      engine.resizeRT(rt, s.w, s.h);

      var p = GL.tickPointer(0.055);
      mouse.x += ((p.x - 0.5) * 2.0 - mouse.x) * 0.05;
      mouse.y += ((p.y - 0.5) * 2.0 - mouse.y) * 0.05;
      scroll.p += (scroll.target - scroll.p) * 0.06;
      flash.v *= 0.9;
      if (flash.v < 0.0005) flash.v = 0;

      var gl = engine.gl;

      /* ---- Pass A：场景 ---- */
      gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fbo);
      gl.viewport(0, 0, rt.w, rt.h);
      gl.disable(gl.BLEND);
      gl.useProgram(scene.program);
      gl.uniform2f(scene.u.u_res, rt.w, rt.h);
      gl.uniform1f(scene.u.u_time, engine.time);
      gl.uniform2f(scene.u.u_mouse, mouse.x, mouse.y);
      gl.uniform1f(scene.u.u_scroll, scroll.p);
      gl.uniform1f(scene.u.u_density, opts.density || 1);
      gl.uniform1f(scene.u.u_intensity, opts.intensity || 1);
      gl.uniform3fv(scene.u.u_c1, accent);
      gl.uniform3fv(scene.u.u_c2, secondary);
      gl.uniform3fv(scene.u.u_c3, tertiary);
      engine.drawQuad(scene);

      /* ---- Pass B：后处理 ---- */
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, s.w, s.h);
      gl.useProgram(post.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, rt.tex);
      gl.uniform1i(post.u.u_scene, 0);
      gl.uniform2f(post.u.u_res, s.w, s.h);
      gl.uniform1f(post.u.u_time, engine.time);
      gl.uniform1f(post.u.u_sep, (opts.dispersion === undefined ? 0.0042 : opts.dispersion));
      gl.uniform1f(post.u.u_bloom, (opts.bloom === undefined ? 0.55 : opts.bloom));
      gl.uniform1f(post.u.u_vig, (opts.vignette === undefined ? 0.55 : opts.vignette));
      gl.uniform1f(post.u.u_grain, (opts.grain === undefined ? 0.035 : opts.grain));
      gl.uniform1f(post.u.u_flash, flash.v);
      engine.drawQuad(post);
    };

    return {
      engine: engine,
      dispose: function () { engine.dispose(); },
      refresh: readScroll
    };
  }

  GL.nebula = { mount: mount, ACCENTS: ACCENTS };
})(window, document);
