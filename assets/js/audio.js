/* ============================================================
   ASTRUM 远穹 — 程序化环境音
   File : assets/js/audio.js
   说明 : 全部声音由 Web Audio 实时合成，没有任何音频文件。
          默认静音；用户点击开关后才创建 AudioContext（合规且省电）。
          组成：低频宇宙嗡鸣 + 滤波噪声风床 + 随机星点闪烁 + 转场微光。
   依赖 : 无
   ============================================================ */
(function (w, d) {
  "use strict";

  var Audio = {};
  var KEY = "astrum:audio";

  var ctx = null;
  var master = null;
  var nodes = null;
  var enabled = false;
  var btn = null;
  var timers = [];
  var supported = !!(w.AudioContext || w.webkitAudioContext);

  function readPref() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function writePref(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }

  /* ---------- 噪声缓冲（粉噪近似） ---------- */
  function noiseBuffer(ac) {
    var len = Math.floor(ac.sampleRate * 4);
    var buf = ac.createBuffer(1, len, ac.sampleRate);
    var data = buf.getChannelData(0);
    var b0 = 0, b1 = 0, b2 = 0;
    for (var i = 0; i < len; i++) {
      var white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.0990460;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.22;
    }
    return buf;
  }

  /* ---------- 构建音频图 ---------- */
  function build() {
    var AC = w.AudioContext || w.webkitAudioContext;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    /* ① 低频宇宙嗡鸣：两个微失谐正弦 + 一个五度 */
    var drone = ctx.createGain();
    drone.gain.value = 0.16;
    var droneFilter = ctx.createBiquadFilter();
    droneFilter.type = "lowpass";
    droneFilter.frequency.value = 220;
    drone.connect(droneFilter);
    droneFilter.connect(master);

    var freqs = [55, 55.35, 82.4];
    var oscs = freqs.map(function (f, i) {
      var o = ctx.createOscillator();
      o.type = i === 2 ? "triangle" : "sine";
      o.frequency.value = f;
      var g = ctx.createGain();
      g.gain.value = i === 2 ? 0.22 : 0.5;
      o.connect(g);
      g.connect(drone);
      o.start();
      return o;
    });

    /* 缓慢的音高呼吸，避免"死音" */
    var lfo = ctx.createOscillator();
    lfo.frequency.value = 0.037;
    var lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.6;
    lfo.connect(lfoGain);
    lfoGain.connect(oscs[0].frequency);
    lfoGain.connect(oscs[2].frequency);
    lfo.start();

    /* ② 噪声风床 */
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;

    var wind = ctx.createBiquadFilter();
    wind.type = "bandpass";
    wind.frequency.value = 420;
    wind.Q.value = 0.7;

    var windGain = ctx.createGain();
    windGain.gain.value = 0.11;

    src.connect(wind);
    wind.connect(windGain);
    windGain.connect(master);
    src.start();

    /* 风床缓慢漂移 */
    var windLfo = ctx.createOscillator();
    windLfo.frequency.value = 0.021;
    var windLfoGain = ctx.createGain();
    windLfoGain.gain.value = 260;
    windLfo.connect(windLfoGain);
    windLfoGain.connect(wind.frequency);
    windLfo.start();

    nodes = { master: master, wind: wind, windGain: windGain, drone: drone };
    return nodes;
  }

  /* ---------- 星点闪烁（随机短音） ---------- */
  function sparkle() {
    if (!ctx || !enabled) return;
    var t = ctx.currentTime;
    var pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    var g = ctx.createGain();
    var o = ctx.createOscillator();
    o.type = "sine";
    var base = 880 * Math.pow(2, Math.floor(Math.random() * 4) / 12);
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * 2.02, t + 0.5);

    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.022, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);

    o.connect(g);
    if (pan) {
      pan.pan.value = Math.random() * 1.6 - 0.8;
      g.connect(pan);
      pan.connect(master);
    } else {
      g.connect(master);
    }
    o.start(t);
    o.stop(t + 0.8);
  }

  function scheduleSparkles() {
    stopSparkles();
    (function tick() {
      var delay = 3200 + Math.random() * 9000;
      timers.push(w.setTimeout(function () {
        if (!enabled) return;
        sparkle();
        if (Math.random() < 0.3) timers.push(w.setTimeout(sparkle, 240));
        tick();
      }, delay));
    })();
  }

  function stopSparkles() {
    timers.forEach(function (t) { w.clearTimeout(t); });
    timers = [];
  }

  /* ---------- 转场微光 ---------- */
  function whoosh() {
    if (!ctx || !enabled) return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(660, t + 0.34);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.46);
  }

  /* ---------- 开关 ---------- */
  function syncBtn() {
    if (!btn) return;
    btn.setAttribute("aria-pressed", enabled ? "true" : "false");
    btn.setAttribute("aria-label", enabled ? "关闭环境音" : "开启环境音");
    var txt = btn.querySelector(".audio-toggle__txt");
    if (txt) txt.textContent = enabled ? "环境音 开" : "环境音 关";
  }

  function enable() {
    if (!supported) return;
    if (!ctx) build();
    if (ctx.state === "suspended" && ctx.resume) ctx.resume();
    enabled = true;
    var t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(0.5, t, 1.6);
    scheduleSparkles();
    syncBtn();
    writePref("on");
  }

  function disable() {
    enabled = false;
    stopSparkles();
    if (ctx && master) {
      var t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setTargetAtTime(0, t, 0.5);
    }
    syncBtn();
    writePref("off");
  }

  function toggle() {
    if (enabled) disable();
    else enable();
  }

  /* ---------- 初始化 ---------- */
  Audio.init = function () {
    btn = d.querySelector(".audio-toggle");
    if (!btn) return;
    if (!supported) { btn.remove(); return; }

    btn.addEventListener("click", toggle);

    /* 用户上次打开过才自动恢复；否则保持静音（不产生任何声音直到点击） */
    if (readPref() === "on") {
      var resume = function () {
        d.removeEventListener("pointerdown", resume);
        d.removeEventListener("keydown", resume);
        enable();
      };
      d.addEventListener("pointerdown", resume, { once: true });
      d.addEventListener("keydown", resume, { once: true });
      btn.setAttribute("data-armed", "true");
    }
    syncBtn();

    /* 导航时给一点点声音反馈（仅在开启时） */
    d.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a") : null;
      if (!a || !enabled) return;
      var href = a.getAttribute("href") || "";
      if (!href || href.charAt(0) === "#") return;
      whoosh();
    });
  };

  Audio.enable = enable;
  Audio.disable = disable;
  Audio.toggle = toggle;
  Audio.isEnabled = function () { return enabled; };
  Audio.supported = supported;

  w.ASTRUM = w.ASTRUM || {};
  w.ASTRUM.Audio = Audio;
})(window, document);
