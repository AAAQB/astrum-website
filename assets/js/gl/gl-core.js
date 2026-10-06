/* ============================================================
   ASTRUM 远穹 — 极简原生 WebGL 核心
   File : assets/js/gl/gl-core.js
   说明 : 零依赖。只提供本项目需要的四件事——
          着色器编译、全屏四边形、离屏渲染目标、以及"该不该跑"的判断。
          经典脚本（非 module），兼容 file:// 本地预览。
   ============================================================ */
(function (w, d) {
  "use strict";

  if (!w.ASTRUM) w.ASTRUM = {};
  var GL = (w.ASTRUM.GL = w.ASTRUM.GL || {});

  /* ---------- 环境判断 ---------- */
  var mq = function (q) {
    return !!(w.matchMedia && w.matchMedia(q).matches);
  };
  GL.reduceMotion = mq("(prefers-reduced-motion: reduce)");
  GL.coarse = mq("(pointer: coarse)");

  /* ---------- 设备档位 ----------
     low  : 关掉重效果，DPR 锁 1
     mid  : 降低渲染分辨率，DPR ≤ 1.5
     high : 全量，DPR ≤ 2                                        */
  var _gl1 = null;
  function gl1Test() {
    if (_gl1 !== null) return _gl1;
    try {
      var c = d.createElement("canvas");
      var g = c.getContext("webgl", { failIfMajorPerformanceCaveat: true }) ||
              c.getContext("experimental-webgl");
      _gl1 = !!g;
      if (g && g.getExtension) {
        var lose = g.getExtension("WEBGL_lose_context");
        if (lose) lose.loseContext();
      }
    } catch (e) {
      _gl1 = false;
    }
    return _gl1;
  }

  function detectTier() {
    if (GL.reduceMotion) return "low";
    var mem = navigator.deviceMemory || 0;
    var cores = navigator.hardwareConcurrency || 0;
    var saveData = !!(navigator.connection && navigator.connection.saveData);
    var dpr = w.devicePixelRatio || 1;
    if (saveData) return "low";
    if (mem && mem <= 2) return "low";
    if (cores && cores <= 2) return "low";
    if (gl1Test() === false) return "low";
    var heavy = (mem && mem <= 4) || (cores && cores <= 4) || dpr >= 3;
    return heavy ? "mid" : "high";
  }

  GL.tier = detectTier();
  GL.support = gl1Test();

  /* 把档位写到 <html> 上，CSS 可以直接消费 */
  d.documentElement.classList.add("tier-" + GL.tier);
  d.documentElement.classList.add(GL.support ? "has-webgl" : "no-webgl");

  GL.dprCap = GL.tier === "low" ? 1 : GL.tier === "mid" ? 1.5 : 2;
  GL.renderScale = GL.tier === "low" ? 0.5 : GL.tier === "mid" ? 0.66 : 1;

  /* ---------- 着色器源码片段 ---------- */
  GL.VERT_FULLSCREEN =
    "attribute vec2 a_pos;\n" +
    "varying vec2 v_uv;\n" +
    "void main(){\n" +
    "  v_uv = a_pos * 0.5 + 0.5;\n" +
    "  gl_Position = vec4(a_pos, 0.0, 1.0);\n" +
    "}\n";

  /* 常用噪声工具（供各效果着色器拼接） */
  GL.GLSL_NOISE = [
    "float hash11(float p){ p = fract(p*0.1031); p *= p + 33.33; p *= p + p; return fract(p); }",
    "float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x+p3.y)*p3.z); }",
    "vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973)); p3 += dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }",
    "float vnoise(vec2 p){",
    "  vec2 i = floor(p); vec2 f = fract(p);",
    "  vec2 u = f*f*(3.0-2.0*f);",
    "  float a = hash21(i); float b = hash21(i+vec2(1.0,0.0));",
    "  float c = hash21(i+vec2(0.0,1.0)); float e = hash21(i+vec2(1.0,1.0));",
    "  return mix(mix(a,b,u.x), mix(c,e,u.x), u.y);",
    "}",
    "float fbm(vec2 p, int oct){",
    "  float s = 0.0, a = 0.5;",
    "  mat2 rot = mat2(0.8,0.6,-0.6,0.8);",
    "  for(int i=0;i<7;i++){ if(i>=oct) break; s += a*vnoise(p); p = rot*p*2.03 + 7.13; a *= 0.5; }",
    "  return s;",
    "}",
    "float ridged(vec2 p, int oct){",
    "  float s = 0.0, a = 0.5;",
    "  mat2 rot = mat2(0.8,0.6,-0.6,0.8);",
    "  for(int i=0;i<7;i++){ if(i>=oct) break; s += a*(1.0-abs(vnoise(p)*2.0-1.0)); p = rot*p*2.11 - 3.7; a *= 0.5; }",
    "  return s;",
    "}"
  ].join("\n");

  GL.GLSL_ACES = [
    "vec3 aces(vec3 x){",
    "  const float a=2.51,b=0.03,c=2.43,e2=0.59,f=0.14;",
    "  return clamp((x*(a*x+b))/(x*(c*x+e2)+f), 0.0, 1.0);",
    "}"
  ].join("\n");

  /* ---------- 引擎 ---------- */
  function create(canvas, opts) {
    opts = opts || {};
    if (!canvas) return null;
    if (!GL.support) return null;
    if (GL.tier === "low" && opts.allowLowTier !== true) return null;

    var attrs = {
      alpha: opts.alpha !== false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: GL.tier === "high" ? "high-performance" : "default"
    };

    var gl = canvas.getContext("webgl", attrs) || canvas.getContext("experimental-webgl", attrs);
    if (!gl) return null;

    var engine = {
      canvas: canvas,
      gl: gl,
      tier: GL.tier,
      running: false,
      time: 0,
      _raf: 0,
      _progs: {},
      _rtPool: [],
      onFrame: opts.onFrame || null
    };

    /* --- 着色器 --- */
    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        if (w.console && console.warn) console.warn("[ASTRUM.GL] shader:", gl.getShaderInfoLog(s), "\n", src);
        gl.deleteShader(s);
        return null;
      }
      return s;
    }

    engine.program = function (name, vertSrc, fragSrc) {
      if (engine._progs[name]) return engine._progs[name];
      var vs = compile(gl.VERTEX_SHADER, vertSrc || GL.VERT_FULLSCREEN);
      var fs = compile(gl.FRAGMENT_SHADER, fragSrc);
      if (!vs || !fs) return null;
      var p = gl.createProgram();
      gl.attachShader(p, vs);
      gl.attachShader(p, fs);
      gl.bindAttribLocation(p, 0, "a_pos");
      gl.linkProgram(p);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        if (w.console && console.warn) console.warn("[ASTRUM.GL] link:", gl.getProgramInfoLog(p));
        return null;
      }
      var wrap = { program: p, u: {}, a: {} };
      var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < n; i++) {
        var info = gl.getActiveUniform(p, i);
        if (!info) continue;
        var nm = info.name.replace(/\[0\]$/, "");
        wrap.u[nm] = gl.getUniformLocation(p, info.name);
      }
      var m = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
      for (var j = 0; j < m; j++) {
        var ai = gl.getActiveAttrib(p, j);
        if (ai) wrap.a[ai.name] = gl.getAttribLocation(p, ai.name);
      }
      engine._progs[name] = wrap;
      return wrap;
    };

    /* --- 全屏四边形 --- */
    var quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    engine.drawQuad = function (prog) {
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      var loc = (prog.a && prog.a.a_pos !== undefined) ? prog.a.a_pos : 0;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    /* --- 离屏渲染目标 --- */
    engine.createRT = function (rw, rh) {
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, rw, rh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      var fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      var rt = { tex: tex, fbo: fbo, w: rw, h: rh };
      engine._rtPool.push(rt);
      return rt;
    };

    engine.resizeRT = function (rt, rw, rh) {
      if (!rt || (rt.w === rw && rt.h === rh)) return;
      rt.w = rw;
      rt.h = rh;
      gl.bindTexture(gl.TEXTURE_2D, rt.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, rw, rh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    };

    /* --- 尺寸 --- */
    var rw = 1, rh = 1, cw = 0, ch = 0;
    engine.resize = function () {
      var rect = canvas.getBoundingClientRect();
      var dpr = Math.min(w.devicePixelRatio || 1, GL.dprCap);
      var nw = Math.max(1, Math.round((rect.width || canvas.clientWidth || 1) * dpr * GL.renderScale));
      var nh = Math.max(1, Math.round((rect.height || canvas.clientHeight || 1) * dpr * GL.renderScale));
      cw = rect.width;
      ch = rect.height;
      if (nw === rw && nh === rh) return false;
      rw = nw;
      rh = nh;
      canvas.width = nw;
      canvas.height = nh;
      gl.viewport(0, 0, nw, nh);
      return true;
    };

    engine.size = function () { return { w: rw, h: rh, cssW: cw, cssH: ch }; };

    /* --- RAF 调度 --- */
    var lastT = 0;
    function loop(t) {
      engine._raf = w.requestAnimationFrame(loop);
      var dt = lastT ? Math.min(64, t - lastT) : 16;
      lastT = t;
      engine.time += dt / 1000;
      if (engine.onFrame) engine.onFrame(engine.time, dt / 1000, engine);
    }

    engine.start = function () {
      if (engine.running) return;
      engine.running = true;
      lastT = 0;
      engine._raf = w.requestAnimationFrame(loop);
    };

    engine.stop = function () {
      engine.running = false;
      if (engine._raf) w.cancelAnimationFrame(engine._raf);
      engine._raf = 0;
    };

    /* --- 只在可见时运行 --- */
    if ("IntersectionObserver" in w) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            if (opts.autoStart !== false) engine.start();
          } else {
            engine.stop();
          }
        });
      }, { rootMargin: opts.rootMargin || "140px" });
      io.observe(canvas);
      engine._io = io;
    }

    /* --- 尺寸跟随（CSS 尺寸变化 / DPR 变化都要跟上） --- */
    if ("ResizeObserver" in w) {
      var ro = new ResizeObserver(function () { engine.resize(); });
      ro.observe(canvas);
      engine._ro = ro;
    }
    var onWinResize = function () { engine.resize(); };
    w.addEventListener("resize", onWinResize, { passive: true });
    engine._onWinResize = onWinResize;

    d.addEventListener("visibilitychange", function () {
      if (d.hidden) engine.stop();
      else if (opts.autoStart !== false) engine.start();
    });

    /* --- 销毁 --- */
    engine.dispose = function () {
      engine.stop();
      if (engine._io) engine._io.disconnect();
      if (engine._ro) engine._ro.disconnect();
      if (engine._onWinResize) w.removeEventListener("resize", engine._onWinResize);
      engine._rtPool.forEach(function (rt) {
        gl.deleteTexture(rt.tex);
        gl.deleteFramebuffer(rt.fbo);
      });
      Object.keys(engine._progs).forEach(function (k) { gl.deleteProgram(engine._progs[k].program); });
      gl.deleteBuffer(quad);
      var lose = gl.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
    };

    engine.resize();
    return engine;
  }

  /* ---------- 指针（多实例共享，避免重复监听） ---------- */
  var pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, active: false };
  GL.pointer = pointer;

  if (!GL.coarse && !GL.reduceMotion) {
    w.addEventListener("pointermove", function (e) {
      pointer.tx = e.clientX / (w.innerWidth || 1);
      pointer.ty = 1 - e.clientY / (w.innerHeight || 1);
      pointer.active = true;
    }, { passive: true });
  }

  GL.tickPointer = function (k) {
    var f = typeof k === "number" ? k : 0.08;
    pointer.x += (pointer.tx - pointer.x) * f;
    pointer.y += (pointer.ty - pointer.y) * f;
    return pointer;
  };

  GL.create = create;
})(window, document);
