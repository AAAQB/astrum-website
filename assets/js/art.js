/* ============================================================
   ASTRUM 远穹 — 程序化矢量主视觉引擎
   File : assets/js/art.js
   说明 : 全站零第三方素材。这里用 SVG 程序化生成每一张"任务关键帧"，
          不下载、不外链、不依赖任何图片文件。
          每个场景由确定性随机数驱动（同一场景每次刷新完全一致），
          用 feTurbulence / feDisplacementMap / feGaussianBlur 制造
          星云、熔岩、极光等有机形态。
   依赖 : 无
   ============================================================ */
(function (w, d) {
  "use strict";

  var A = (w.ASTRUM = w.ASTRUM || {});
  var Art = {};

  var VW = 800, VH = 600;
  var TAU = Math.PI * 2;

  /* ---------- 确定性随机 ---------- */
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function prng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- 数值与路径工具 ---------- */
  function f(n) { return Math.round(n * 10) / 10; }
  function rad(deg) { return (deg * Math.PI) / 180; }
  function rng(r, a, b) { return a + r() * (b - a); }

  function poly(points) {
    return points.map(function (p) { return f(p[0]) + "," + f(p[1]); }).join(" ");
  }

  /* 平滑开放曲线（Catmull-Rom 转三次贝塞尔） */
  function smooth(points) {
    if (points.length < 2) return "";
    var d = "M " + f(points[0][0]) + " " + f(points[0][1]);
    for (var i = 0; i < points.length - 1; i++) {
      var p0 = points[i - 1] || points[i];
      var p1 = points[i];
      var p2 = points[i + 1];
      var p3 = points[i + 2] || p2;
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += " C " + f(c1x) + " " + f(c1y) + " " + f(c2x) + " " + f(c2y) + " " + f(p2[0]) + " " + f(p2[1]);
    }
    return d;
  }

  /* ---------- 通用图元 ---------- */
  function stars(r, count, opt) {
    opt = opt || {};
    var maxY = opt.maxY === undefined ? VH : opt.maxY;
    var out = "";
    for (var i = 0; i < count; i++) {
      var x = rng(r, 0, VW), y = rng(r, 0, maxY);
      var rr = rng(r, 0.5, opt.max || 1.7);
      var o = rng(r, 0.2, 1) * (opt.opacity || 1);
      var warm = r() > 0.72;
      out += '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(rr) + '" fill="' +
             (warm ? "#ffe0c2" : "#eaf2ff") + '" opacity="' + f(o) + '"/>';
    }
    return out;
  }

  /* 四角星芒（原创星形标记，用于代替字体符号） */
  function spark(x, y, size, opacity, color) {
    var s = size, w = s * 0.16;
    return '<path d="M ' + f(x) + ' ' + f(y - s) +
      ' C ' + f(x + w) + ' ' + f(y - w) + ' ' + f(x + w) + ' ' + f(y - w) + ' ' + f(x + s) + ' ' + f(y) +
      ' C ' + f(x + w) + ' ' + f(y + w) + ' ' + f(x + w) + ' ' + f(y + w) + ' ' + f(x) + ' ' + f(y + s) +
      ' C ' + f(x - w) + ' ' + f(y + w) + ' ' + f(x - w) + ' ' + f(y + w) + ' ' + f(x - s) + ' ' + f(y) +
      ' C ' + f(x - w) + ' ' + f(y - w) + ' ' + f(x - w) + ' ' + f(y - w) + ' ' + f(x) + ' ' + f(y - s) + ' Z"' +
      ' fill="' + (color || "#ffffff") + '" opacity="' + opacity + '"/>';
  }

  /* 太阳/光源的辐射光芒 */
  function corona(cx, cy, radius, count, reach, color, r, opacity) {
    var out = "";
    for (var i = 0; i < count; i++) {
      var a = (i / count) * 360 + rng(r, -3, 3);
      var len = radius * rng(r, reach * 0.45, reach * 1.5);
      var x2 = cx + Math.cos(rad(a)) * len;
      var y2 = cy + Math.sin(rad(a)) * len;
      out += '<line x1="' + f(cx + Math.cos(rad(a)) * radius * 0.98) + '" y1="' + f(cy + Math.sin(rad(a)) * radius * 0.98) +
             '" x2="' + f(x2) + '" y2="' + f(y2) + '" stroke="' + color + '" stroke-width="' +
             f(rng(r, 0.7, 2.4)) + '" stroke-linecap="round" opacity="' + f(rng(r, 0.06, 0.3) * (opacity || 1)) + '"/>';
    }
    return out;
  }

  /* 行星弧（limb）：给定弦长与拱高，返回填充路径、描边路径与弧顶 y */
  function limbArc(chord, sag) {
    var r = (chord * chord) / (8 * sag) + sag / 2;
    var halfAngle = Math.asin(Math.min(1, (chord / 2) / r));
    var topY = (VH + 60) - r + r * Math.cos(halfAngle);
    return {
      d: "M " + f(-60) + " " + f(VH + 60) + " A " + f(r) + " " + f(r) + " 0 0 1 " + f(VW + 60) + " " + f(VH + 60) + " Z",
      stroke: "M " + f(-60) + " " + f(VH + 60) + " A " + f(r) + " " + f(r) + " 0 0 1 " + f(VW + 60) + " " + f(VH + 60),
      topY: topY
    };
  }

  /* 山脊剪影（折线） */
  function ridge(r, baseY, peaks, amp, color, opacity) {
    var pts = [[-40, baseY + 40]];
    var step = (VW + 80) / peaks;
    for (var i = 0; i <= peaks; i++) {
      var x = -40 + i * step;
      var y = baseY - Math.abs(Math.sin(i * 1.7 + r() * 0.6)) * amp * rng(r, 0.35, 1);
      pts.push([x, y]);
    }
    pts.push([VW + 40, baseY + 40]);
    return '<polygon points="' + poly(pts) + '" fill="' + color + '" opacity="' + opacity + '"/>';
  }

  /* ============================================================
     场景：每个函数返回 { defs, body }
     ============================================================ */

  /* 1 — 太阳灼烧：极光号追光之旅 */
  function solar(r) {
    var sx = 548, sy = 402, sr = 170;
    var L = limbArc(1100, 260);
    var craft = "M 0 0 L 46 -7 L 62 0 L 46 7 Z";
    return {
      defs:
        '<radialGradient id="sky" cx="70%" cy="68%" r="88%">' +
          '<stop offset="0" stop-color="#ffd08c"/><stop offset=".22" stop-color="#ff7f3c"/>' +
          '<stop offset=".48" stop-color="#a3281c"/><stop offset="1" stop-color="#0a0309"/>' +
        '</radialGradient>' +
        '<radialGradient id="sun" cx="50%" cy="50%" r="50%">' +
          '<stop offset="0" stop-color="#fffdf2"/><stop offset=".34" stop-color="#ffe09a"/>' +
          '<stop offset=".68" stop-color="#ff6f2a" stop-opacity=".9"/>' +
          '<stop offset="1" stop-color="#ff4a1e" stop-opacity="0"/>' +
        '</radialGradient>' +
        '<linearGradient id="limb" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#220d14"/><stop offset="1" stop-color="#040106"/>' +
        '</linearGradient>' +
        '<linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#ffb469" stop-opacity=".95"/>' +
          '<stop offset="1" stop-color="#ff5a2e" stop-opacity="0"/>' +
        '</linearGradient>' +
        '<filter id="haze" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="30"/></filter>' +
        '<filter id="glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="12"/></filter>',
      body:
        '<rect width="' + VW + '" height="' + VH + '" fill="url(#sky)"/>' +
        stars(r, 60, { maxY: 300, opacity: 0.7 }) +
        '<circle cx="' + sx + '" cy="' + sy + '" r="' + (sr * 2.6) + '" fill="url(#sun)" opacity=".5" filter="url(#haze)"/>' +
        corona(sx, sy, sr, 44, sr * 2.5, "#ffd9a0", r, 0.9) +
        '<circle cx="' + sx + '" cy="' + sy + '" r="' + sr + '" fill="url(#sun)"/>' +
        '<ellipse cx="400" cy="' + f(L.topY + 26) + '" rx="520" ry="46" fill="#ff8a4a" opacity=".28" filter="url(#haze)"/>' +
        '<path d="' + L.d + '" fill="url(#limb)"/>' +
        '<path d="' + L.stroke + '" fill="none" stroke="url(#rim)" stroke-width="2.6"/>' +
        '<path d="' + L.stroke + '" fill="none" stroke="#ffd7a8" stroke-width="1" opacity=".85"/>' +
        '<g transform="translate(212 ' + f(L.topY - 26) + ') rotate(-9)" opacity=".92">' +
          '<path d="' + craft + '" fill="#07040a"/>' +
          '<rect x="10" y="-3" width="16" height="6" fill="#ff9a5c" opacity=".55"/>' +
        '</g>' +
        spark(96, 96, 12, 0.8, "#fff4e2") +
        spark(690, 132, 7, 0.55, "#ffe6c8")
    };
  }

  /* 2 — 冰环空间站：曙光号驻留 */
  function ice(r) {
    var px = 268, py = 372, pr = 188;
    var station = (function () {
      var s = '<rect x="-46" y="-4" width="92" height="8" rx="2" fill="#08131c" stroke="#8ff5ef" stroke-width="1.2" opacity=".95"/>';
      s += '<rect x="-62" y="-9" width="16" height="18" rx="1.5" fill="#0b2230" stroke="#54e6e0" stroke-width="1" opacity=".9"/>';
      s += '<rect x="46" y="-9" width="16" height="18" rx="1.5" fill="#0b2230" stroke="#54e6e0" stroke-width="1" opacity=".9"/>';
      for (var i = 0; i < 3; i++) {
        s += '<line x1="' + (-58 + i * 6) + '" y1="-7" x2="' + (-58 + i * 6) + '" y2="7" stroke="#54e6e0" stroke-width=".5" opacity=".5"/>';
        s += '<line x1="' + (48 + i * 6) + '" y1="-7" x2="' + (48 + i * 6) + '" y2="7" stroke="#54e6e0" stroke-width=".5" opacity=".5"/>';
      }
      s += '<circle cx="0" cy="0" r="9" fill="#08131c" stroke="#8ff5ef" stroke-width="1.2"/>';
      s += '<circle cx="0" cy="0" r="3" fill="#54e6e0"/>';
      return s;
    })();
    return {
      defs:
        '<radialGradient id="sky" cx="30%" cy="34%" r="92%">' +
          '<stop offset="0" stop-color="#0d4a5c"/><stop offset=".42" stop-color="#072534"/>' +
          '<stop offset="1" stop-color="#02070e"/>' +
        '</radialGradient>' +
        '<radialGradient id="planet" cx="34%" cy="28%" r="82%">' +
          '<stop offset="0" stop-color="#c7fff8"/><stop offset=".3" stop-color="#4fdcd2"/>' +
          '<stop offset=".68" stop-color="#0d5566"/><stop offset="1" stop-color="#04121c"/>' +
        '</radialGradient>' +
        '<linearGradient id="shade" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#02070e" stop-opacity="0"/><stop offset=".62" stop-color="#02070e" stop-opacity=".9"/>' +
        '</linearGradient>' +
        '<filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="16"/></filter>' +
        '<filter id="fine" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>',
      body:
        '<rect width="' + VW + '" height="' + VH + '" fill="url(#sky)"/>' +
        stars(r, 78, { maxY: VH, opacity: 0.85, max: 1.4 }) +
        '<ellipse cx="' + f(px + 30) + '" cy="' + f(py + 10) + '" rx="' + (pr * 1.9) + '" ry="' + (pr * 1.9) +
          '" fill="#2fd6cf" opacity=".14" filter="url(#soft)"/>' +
        '<circle cx="' + px + '" cy="' + py + '" r="' + pr + '" fill="url(#planet)"/>' +
        /* 地表冰裂 */
        (function () {
          var s = "";
          for (var i = 0; i < 26; i++) {
            var a = rng(r, -80, 100), len = rng(r, pr * 0.25, pr * 0.95);
            var x1 = px + Math.cos(rad(a)) * pr * 0.12, y1 = py + Math.sin(rad(a)) * pr * 0.12;
            var x2 = px + Math.cos(rad(a + rng(r, -0.22, 0.22))) * len;
            var y2 = py + Math.sin(rad(a + rng(r, -0.22, 0.22))) * len;
            s += '<path d="M ' + f(x1) + ' ' + f(y1) + ' Q ' + f((x1 + x2) / 2 + rng(r, -18, 18)) + ' ' +
                 f((y1 + y2) / 2 + rng(r, -18, 18)) + ' ' + f(x2) + ' ' + f(y2) + '" fill="none" stroke="#d9fffb" stroke-width="' +
                 f(rng(r, 0.4, 1.3)) + '" opacity="' + f(rng(r, 0.1, 0.5)) + '"/>';
          }
          return s;
        })() +
        '<circle cx="' + px + '" cy="' + py + '" r="' + pr + '" fill="url(#shade)"/>' +
        '<circle cx="' + px + '" cy="' + py + '" r="' + pr + '" fill="none" stroke="#b6fff7" stroke-width="1.6" opacity=".8"/>' +
        '<circle cx="' + px + '" cy="' + py + '" r="' + (pr + 9) + '" fill="none" stroke="#54e6e0" stroke-width=".8" opacity=".35"/>' +
        /* 轨道环 */
        '<g transform="translate(' + px + ' ' + py + ') rotate(-19)">' +
          '<ellipse rx="' + (pr * 1.62) + '" ry="' + (pr * 0.36) + '" fill="none" stroke="#8ff5ef" stroke-width="1.2" stroke-dasharray="7 9" opacity=".55"/>' +
        '</g>' +
        /* 空间站 */
        '<g transform="translate(560 196) rotate(-14)" filter="url(#fine)">' +
          '<ellipse cx="0" cy="0" rx="96" ry="26" fill="#54e6e0" opacity=".16"/>' +
        '</g>' +
        '<g transform="translate(560 196) rotate(-14)">' + station + '</g>' +
        '<g transform="translate(560 196) rotate(-14)" opacity=".5">' +
          '<circle cx="0" cy="0" r="30" fill="none" stroke="#54e6e0" stroke-width=".7" stroke-dasharray="3 5"/>' +
        '</g>' +
        spark(132, 108, 9, 0.6, "#d6fffb") +
        spark(660, 470, 6, 0.45, "#d6fffb")
    };
  }

  /* 3 — 幽紫星云 */
  function nebula(r) {
    var blobs = "";
    var tint = ["#8c74ff", "#ff5a2e", "#54e6e0", "#b06cff", "#ff8a55"];
    for (var i = 0; i < 9; i++) {
      blobs += '<ellipse cx="' + f(rng(r, 60, 740)) + '" cy="' + f(rng(r, 80, 520)) +
               '" rx="' + f(rng(r, 90, 260)) + '" ry="' + f(rng(r, 60, 170)) +
               '" fill="' + tint[i % tint.length] + '" opacity="' + f(rng(r, 0.1, 0.3)) +
               '" filter="url(#turb)" transform="rotate(' + f(rng(r, -50, 50)) + ' 400 300)"/>';
    }
    return {
      defs:
        '<radialGradient id="sky" cx="44%" cy="40%" r="86%">' +
          '<stop offset="0" stop-color="#221a48"/><stop offset=".42" stop-color="#0d1030"/>' +
          '<stop offset="1" stop-color="#03040c"/>' +
        '</radialGradient>' +
        '<radialGradient id="core" cx="50%" cy="50%" r="50%">' +
          '<stop offset="0" stop-color="#fffaf0"/><stop offset=".3" stop-color="#ffd7a0" stop-opacity=".8"/>' +
          '<stop offset="1" stop-color="#ff7a3a" stop-opacity="0"/>' +
        '</radialGradient>' +
        '<filter id="turb" x="-30%" y="-30%" width="160%" height="160%">' +
          '<feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="4" seed="7" result="n"/>' +
          '<feDisplacementMap in="SourceGraphic" in2="n" scale="120" xChannelSelector="R" yChannelSelector="G"/>' +
          '<feGaussianBlur stdDeviation="14"/>' +
        '</filter>' +
        '<filter id="wispy" x="-30%" y="-30%" width="160%" height="160%">' +
          '<feTurbulence type="fractalNoise" baseFrequency="0.02 0.008" numOctaves="3" seed="19" result="n"/>' +
          '<feDisplacementMap in="SourceGraphic" in2="n" scale="180" xChannelSelector="R" yChannelSelector="G"/>' +
          '<feGaussianBlur stdDeviation="22"/>' +
        '</filter>' +
        '<filter id="bloom" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="26"/></filter>',
      body:
        '<rect width="' + VW + '" height="' + VH + '" fill="url(#sky)"/>' +
        '<g opacity=".85">' + blobs + '</g>' +
        '<ellipse cx="330" cy="300" rx="380" ry="120" fill="#6f5aff" opacity=".26" filter="url(#wispy)" transform="rotate(-24 330 300)"/>' +
        '<ellipse cx="470" cy="330" rx="300" ry="90" fill="#ff6a2e" opacity=".2" filter="url(#wispy)" transform="rotate(-18 470 330)"/>' +
        /* 尘埃带：暗色遮挡 */
        '<path d="' + smooth([[40, 430], [200, 350], [360, 300], [520, 250], [700, 190], [820, 160]]) +
          '" fill="none" stroke="#05060f" stroke-width="70" stroke-linecap="round" opacity=".55" filter="url(#bloom)"/>' +
        stars(r, 150, { maxY: VH, opacity: 1, max: 1.9 }) +
        '<circle cx="580" cy="196" r="120" fill="url(#core)" opacity=".75" filter="url(#bloom)"/>' +
        '<circle cx="580" cy="196" r="26" fill="url(#core)"/>' +
        spark(200, 150, 14, 0.9, "#ffffff") +
        spark(430, 470, 10, 0.6, "#e9dcff") +
        spark(676, 384, 7, 0.5, "#ffe6c8")
    };
  }

  /* 4 — 极光带上空 */
  function aurora(r) {
    function ribbon(yBase, amp, thick, from, to, opacity, blur) {
      var pts = [];
      for (var i = 0; i <= 6; i++) {
        pts.push([-60 + i * ((VW + 120) / 6), yBase + Math.sin(i * 1.05 + rng(r, 0, 1.4)) * amp]);
      }
      return '<path d="' + smooth(pts) + '" fill="none" stroke="url(' + to + ')" stroke-width="' + thick +
             '" stroke-linecap="round" opacity="' + opacity + '" filter="url(' + from + ')"/>';
    }
    var L = limbArc(1080, 200);
    return {
      defs:
        '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#03060f"/><stop offset=".55" stop-color="#061426"/>' +
          '<stop offset="1" stop-color="#0a2436"/>' +
        '</linearGradient>' +
        '<linearGradient id="rA" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0" stop-color="#54e6e0" stop-opacity="0"/><stop offset=".35" stop-color="#8ff5ef"/>' +
          '<stop offset=".7" stop-color="#54e6e0" stop-opacity=".7"/><stop offset="1" stop-color="#54e6e0" stop-opacity="0"/>' +
        '</linearGradient>' +
        '<linearGradient id="rB" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0" stop-color="#b06cff" stop-opacity="0"/><stop offset=".45" stop-color="#8c74ff"/>' +
          '<stop offset="1" stop-color="#8c74ff" stop-opacity="0"/>' +
        '</linearGradient>' +
        '<linearGradient id="rC" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0" stop-color="#ff5a2e" stop-opacity="0"/><stop offset=".55" stop-color="#ff9a5c"/>' +
          '<stop offset="1" stop-color="#ff5a2e" stop-opacity="0"/>' +
        '</linearGradient>' +
        '<linearGradient id="land" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#08131f"/><stop offset="1" stop-color="#010308"/>' +
        '</linearGradient>' +
        '<filter id="b1" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="8"/></filter>' +
        '<filter id="b2" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="18"/></filter>' +
        '<filter id="b3" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="34"/></filter>',
      body:
        '<rect width="' + VW + '" height="' + VH + '" fill="url(#sky)"/>' +
        stars(r, 130, { maxY: 400, opacity: 0.9, max: 1.6 }) +
        '<ellipse cx="400" cy="226" rx="470" ry="132" fill="#54e6e0" opacity=".18" filter="url(#b3)"/>' +
        ribbon(228, 46, 54, "#b3", "#rB", 0.42, 0) +
        ribbon(266, 40, 40, "#b2", "#rA", 0.62, 0) +
        ribbon(298, 34, 26, "#b1", "#rA", 0.95, 0) +
        ribbon(330, 26, 14, "#b1", "#rC", 0.72, 0) +
        ribbon(194, 30, 9, "#b2", "#rA", 0.45, 0) +
        '<path d="' + L.d + '" fill="url(#land)"/>' +
        '<path d="' + L.stroke + '" fill="none" stroke="#8ff5ef" stroke-width="1.4" opacity=".6"/>' +
        /* 地面极光倒影 */
        '<g opacity=".3" transform="translate(0 ' + f((L.topY - 400) * 0.6) + ')">' +
          ribbon(360, 22, 24, "#b2", "#rA", 0.5, 0) +
          ribbon(392, 18, 14, "#b1", "#rA", 0.6, 0) +
        '</g>' +
        ridge(r, L.topY + 34, 9, 46, "#02050b", 0.95) +
        spark(120, 92, 11, 0.75, "#dffffb") +
        spark(612, 148, 8, 0.55, "#e8dcff")
    };
  }

  /* 5 — 轨道网格与卫星部署 */
  function grid(r) {
    var horizon = 372, vpx = 400, vpy = 268;
    var lines = "";
    /* 透视横向线 */
    for (var i = 0; i < 16; i++) {
      var t = i / 15;
      var y = horizon + Math.pow(t, 2.2) * (VH - horizon + 30);
      lines += '<line x1="0" y1="' + f(y) + '" x2="' + VW + '" y2="' + f(y) +
               '" stroke="#54e6e0" stroke-width="' + f(t < 0.5 ? 1.4 : 2.1) + '" opacity="' + f(0.2 + t * 0.42) + '"/>';
    }
    /* 透视放射线 */
    for (var j = -11; j <= 11; j++) {
      var x2 = vpx + j * 130;
      lines += '<line x1="' + vpx + '" y1="' + horizon + '" x2="' + f(x2) + '" y2="' + (VH + 40) +
               '" stroke="#54e6e0" stroke-width="1.3" opacity="' + f(0.4 - Math.abs(j) * 0.018) + '"/>';
    }
    /* 网格交点：亮节点，避免画面读成一片灰 */
    for (var gi = 2; gi < 13; gi += 3) {
      for (var gj = -7; gj <= 7; gj += 2) {
        var tt = gi / 15;
        var gy = horizon + Math.pow(tt, 2.2) * (VH - horizon + 30);
        var gx = vpx + (gj * 130) * ((gy - horizon) / (VH + 40 - horizon));
        lines += '<circle cx="' + f(gx) + '" cy="' + f(gy) + '" r="' + f(1.6 + tt * 1.6) +
                 '" fill="#bff7f4" opacity="' + f(0.3 + tt * 0.45) + '"/>';
      }
    }
    /* 卫星：原创几何线框 */
    var sat =
      '<g stroke="#bff7f4" fill="none" stroke-width="1.3" opacity=".95">' +
        '<path d="M -30 -16 L 30 -16 L 40 0 L 30 16 L -30 16 L -40 0 Z"/>' +
        '<path d="M -30 -16 L -30 16 M 30 -16 L 30 16 M -40 0 L 40 0"/>' +
        '<rect x="-104" y="-9" width="52" height="18" rx="1"/>' +
        '<rect x="52" y="-9" width="52" height="18" rx="1"/>' +
        '<path d="M -104 -9 L -52 -9 M -104 0 L -52 0 M -104 9 L -52 9"/>' +
        '<path d="M 52 -9 L 104 -9 M 52 0 L 104 0 M 52 9 L 104 9"/>' +
        '<path d="M -52 0 L -40 0 M 40 0 L 52 0"/>' +
        '<path d="M 0 -16 L 0 -40 M -8 -40 L 8 -40"/>' +
      '</g>';
    return {
      defs:
        '<radialGradient id="sky" cx="50%" cy="40%" r="80%">' +
          '<stop offset="0" stop-color="#0e2c42"/><stop offset=".55" stop-color="#061527"/>' +
          '<stop offset="1" stop-color="#01040a"/>' +
        '</radialGradient>' +
        '<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#54e6e0" stop-opacity="0"/><stop offset="1" stop-color="#54e6e0" stop-opacity=".5"/>' +
        '</linearGradient>' +
        '<filter id="bl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter>' +
        '<pattern id="tick" width="46" height="46" patternUnits="userSpaceOnUse">' +
          '<path d="M 46 0 L 46 6 M 0 46 L 6 46" stroke="#54e6e0" stroke-width="0.8" opacity=".35"/>' +
        '</pattern>',
      body:
        '<rect width="' + VW + '" height="' + VH + '" fill="url(#sky)"/>' +
        '<rect width="' + VW + '" height="' + VH + '" fill="url(#tick)" opacity=".5"/>' +
        stars(r, 70, { maxY: horizon, opacity: 0.8 }) +
        /* 上方行星与轨道 */
        '<circle cx="150" cy="120" r="54" fill="#0d3346" stroke="#54e6e0" stroke-width="1" opacity=".9"/>' +
        '<circle cx="150" cy="120" r="54" fill="none" stroke="#8ff5ef" stroke-width="0.6" opacity=".5"/>' +
        '<ellipse cx="150" cy="120" rx="150" ry="42" fill="none" stroke="#54e6e0" stroke-width="0.8" stroke-dasharray="5 7" opacity=".5" transform="rotate(-18 150 120)"/>' +
        '<ellipse cx="150" cy="120" rx="214" ry="60" fill="none" stroke="#54e6e0" stroke-width="0.7" stroke-dasharray="3 9" opacity=".3" transform="rotate(-18 150 120)"/>' +
        '<g>' + lines + '</g>' +
        '<rect x="0" y="' + horizon + '" width="' + VW + '" height="2" fill="url(#fade)"/>' +
        '<ellipse cx="' + vpx + '" cy="' + horizon + '" rx="150" ry="22" fill="#54e6e0" opacity=".45" filter="url(#bl)"/>' +
        '<g transform="translate(556 168) rotate(-13)">' +
          '<ellipse cx="0" cy="0" rx="150" ry="28" fill="#54e6e0" opacity=".2" filter="url(#bl)"/>' +
        '</g>' +
        '<g transform="translate(556 168) rotate(-13)">' + sat + '</g>' +
        /* 标注刻度 */
        '<g stroke="#8ff5ef" stroke-width="0.9" opacity=".45">' +
          '<path d="M 690 84 h 16 M 698 76 v 16" fill="none"/>' +
          '<path d="M 96 470 h 18 M 105 461 v 18" fill="none"/>' +
        '</g>' +
        '<circle cx="556" cy="168" r="3" fill="#8ff5ef"/>'
    };
  }

  /* 6 — 熔岩地表 */
  function magma(r) {
    var veins = "";
    function vein(x, y, ang, len, w, depth) {
      if (depth > 1 || len < 40) return "";
      var pts = [[x, y]];
      var cx = x, cy = y, a = ang;
      var steps = 4;
      for (var i = 0; i < steps; i++) {
        a += rng(r, -0.5, 0.5);
        cx += Math.cos(a) * (len / steps);
        cy += Math.sin(a) * (len / steps);
        pts.push([cx, cy]);
      }
      var s = '<path d="' + smooth(pts) + '" fill="none" stroke="#ff7a34" stroke-width="' + f(w) +
              '" stroke-linecap="round" opacity=".95" filter="url(#hot)"/>';
      s += '<path d="' + smooth(pts) + '" fill="none" stroke="#ffd9a0" stroke-width="' + f(w * 0.34) +
           '" stroke-linecap="round" opacity=".9"/>';
      var mid = pts[2];
      s += '<circle cx="' + f(mid[0]) + '" cy="' + f(mid[1]) + '" r="' + f(w * 1.6) +
           '" fill="#ff8a3a" opacity=".35" filter="url(#hot)"/>';
      s += vein(pts[3][0], pts[3][1], a + rng(r, -0.9, 0.9), len * 0.55, w * 0.6, depth + 1);
      s += vein(pts[2][0], pts[2][1], a - rng(r, -0.9, 0.9), len * 0.5, w * 0.55, depth + 1);
      return s;
    }
    for (var i = 0; i < 7; i++) {
      veins += vein(rng(r, 60, 740), rng(r, 120, 520), rng(r, 0, TAU), rng(r, 190, 320), rng(r, 4.5, 7.5), 0);
    }
    /* 熔岩池：让暖色真正被"看见" */
    var pools = "";
    for (var pi = 0; pi < 7; pi++) {
      var px = rng(r, 70, 730), py = rng(r, 250, 560);
      pools += '<ellipse cx="' + f(px) + '" cy="' + f(py) + '" rx="' + f(rng(r, 60, 150)) + '" ry="' + f(rng(r, 30, 70)) +
               '" fill="#ff7a2e" opacity="' + f(rng(r, 0.2, 0.42)) + '" filter="url(#warm)"/>';
    }
    return {
      defs:
        '<radialGradient id="sky" cx="50%" cy="34%" r="86%">' +
          '<stop offset="0" stop-color="#4a1708"/><stop offset=".42" stop-color="#22090a"/>' +
          '<stop offset="1" stop-color="#070204"/>' +
        '</radialGradient>' +
        '<linearGradient id="crust" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#1a0c0f"/><stop offset=".55" stop-color="#0d0609"/><stop offset="1" stop-color="#050305"/>' +
        '</linearGradient>' +
        '<filter id="hot" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="7"/></filter>' +
        '<filter id="warm" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="40"/></filter>' +
        '<filter id="rock" x="-20%" y="-20%" width="140%" height="140%">' +
          '<feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="5" result="n"/>' +
          '<feDisplacementMap in="SourceGraphic" in2="n" scale="26" xChannelSelector="R" yChannelSelector="G"/>' +
        '</filter>',
      body:
        '<rect width="' + VW + '" height="' + VH + '" fill="url(#sky)"/>' +
        '<ellipse cx="400" cy="560" rx="520" ry="220" fill="#ff4a12" opacity=".38" filter="url(#warm)"/>' +
        pools +
        stars(r, 34, { maxY: 220, opacity: 0.5 }) +
        /* 岩壳多边形：整组共用一次置换滤镜，比逐块滤镜省得多 */
        '<g filter="url(#rock)">' +
        (function () {
          var s = "";
          for (var i = 0; i < 11; i++) {
            var cx = rng(r, -40, 840), cy = rng(r, 210, 640), sz = rng(r, 70, 170);
            var pts = [];
            for (var k = 0; k < 6; k++) {
              var a = (k / 6) * TAU + rng(r, -0.3, 0.3);
              pts.push([cx + Math.cos(a) * sz * rng(r, 0.6, 1.2), cy + Math.sin(a) * sz * rng(r, 0.4, 0.8)]);
            }
            s += '<polygon points="' + poly(pts) + '" fill="url(#crust)" stroke="#3a1418" stroke-width="1.4" opacity="' +
                 f(rng(r, 0.8, 1)) + '"/>';
          }
          return s;
        })() +
        '</g>' +
        '<g>' + veins + '</g>' +
        /* 上升火星 */
        (function () {
          var s = "";
          for (var i = 0; i < 36; i++) {
            var x = rng(r, 20, 780), y = rng(r, 240, 580);
            s += '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(rng(r, 0.6, 2.2)) +
                 '" fill="#ffb066" opacity="' + f(rng(r, 0.15, 0.7)) + '"/>';
          }
          return s;
        })() +
        '<rect x="0" y="470" width="' + VW + '" height="130" fill="#ff6a2e" opacity=".1" filter="url(#warm)"/>'
    };
  }

  /* 7 — 云海之上 */
  function mist(r) {
    var L = limbArc(1180, 245);
    function bands(count, from, spread, opacity) {
      var s = "";
      for (var i = 0; i < count; i++) {
        var y = from + i * spread + rng(r, -17, 17);
        var wdt = rng(r, 300, 820);
        var x = rng(r, -160, 400);
        s += '<ellipse cx="' + f(x + wdt / 2) + '" cy="' + f(y) + '" rx="' + f(wdt / 2) + '" ry="' + f(rng(r, 12, 34)) +
             '" fill="#cfe4ff" opacity="' + f(rng(r, 0.05, 0.18) * opacity) + '" filter="url(#fogSoft)"/>';
      }
      return s;
    }
    return {
      defs:
        '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#050a18"/><stop offset=".45" stop-color="#1b1a3a"/>' +
          '<stop offset=".72" stop-color="#6a3a48"/><stop offset="1" stop-color="#c07a4e"/>' +
        '</linearGradient>' +
        '<linearGradient id="limb" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#e9c39a"/><stop offset=".18" stop-color="#8a5f63"/>' +
          '<stop offset=".55" stop-color="#1d2038"/><stop offset="1" stop-color="#070a16"/>' +
        '</linearGradient>' +
        '<radialGradient id="sun" cx="50%" cy="50%" r="50%">' +
          '<stop offset="0" stop-color="#fff0d0"/><stop offset=".4" stop-color="#ffb26a" stop-opacity=".7"/>' +
          '<stop offset="1" stop-color="#ff7a3a" stop-opacity="0"/>' +
        '</radialGradient>' +
        '<filter id="fogSoft" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="22"/></filter>' +
        '<filter id="fogHard" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="9"/></filter>' +
        '<filter id="haze" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="34"/></filter>',
      body:
        '<rect width="' + VW + '" height="' + VH + '" fill="url(#sky)"/>' +
        stars(r, 92, { maxY: 330, opacity: 0.75, max: 1.5 }) +
        '<circle cx="620" cy="' + f(L.topY + 8) + '" r="150" fill="url(#sun)" opacity=".85" filter="url(#haze)"/>' +
        bands(10, 150, 30, 1) +
        '<path d="' + L.d + '" fill="url(#limb)"/>' +
        '<path d="' + L.stroke + '" fill="none" stroke="#ffd9a8" stroke-width="2.2" opacity=".9"/>' +
        '<path d="' + L.stroke + '" fill="none" stroke="#fff3dc" stroke-width="0.9" opacity=".7"/>' +
        bands(14, L.topY - 60, 26, 1.6) +
        '<ellipse cx="400" cy="' + f(L.topY + 70) + '" rx="560" ry="46" fill="#ffb98a" opacity=".2" filter="url(#haze)"/>' +
        /* 同温层飞行器 */
        '<g transform="translate(250 ' + f(L.topY - 34) + ') rotate(-6)" opacity=".85">' +
          '<path d="M 0 0 L 34 -5 L 46 0 L 34 5 Z" fill="#070c16"/>' +
          '<path d="M 14 -4 L 26 -14 L 30 -14 L 20 -3 Z" fill="#0c1526"/>' +
          '<path d="M 14 4 L 26 14 L 30 14 L 20 3 Z" fill="#0c1526"/>' +
          '<rect x="4" y="-2" width="10" height="4" fill="#ffcf9a" opacity=".6"/>' +
        '</g>' +
        spark(148, 120, 10, 0.6, "#ffe9d4")
    };
  }

  /* 8 — 星座组网（电路星图） */
  function circuit(r) {
    var traces = "";
    for (var i = 0; i < 16; i++) {
      var x = rng(r, 40, 760), y = rng(r, 40, 560);
      var seg = [];
      seg.push([x, y]);
      var steps = 3 + Math.floor(r() * 3);
      for (var k = 0; k < steps; k++) {
        if (k % 2 === 0) x += rng(r, -140, 140); else y += rng(r, -110, 110);
        seg.push([x, y]);
      }
      var active = r() > 0.42;
      var d = seg.map(function (p, idx) { return (idx ? "L " : "M ") + f(p[0]) + " " + f(p[1]); }).join(" ");
      traces += '<path d="' + d + '" fill="none" stroke="' + (active ? "#a8fbf5" : "#3d8e9d") +
                '" stroke-width="' + (active ? 2.2 : 1.4) + '" stroke-linejoin="round" stroke-linecap="round" opacity="' +
                (active ? 1 : 0.62) + '"' + (active ? ' filter="url(#lit)"' : "") + "/>";
      seg.forEach(function (p) {
        traces += '<circle cx="' + f(p[0]) + '" cy="' + f(p[1]) + '" r="' + (active ? 4.2 : 2.8) +
                  '" fill="' + (active ? "#e8fffd" : "#54a7b4") + '" opacity="' + (active ? 1 : 0.7) + '"/>';
      });
    }
    /* 星座连线 */
    var nodes = [];
    for (var n = 0; n < 6; n++) nodes.push([rng(r, 120, 690), rng(r, 110, 470)]);
    var constel = '<path d="M ' + nodes.map(function (p) { return f(p[0]) + " " + f(p[1]); }).join(" L ") +
      '" fill="none" stroke="#b9a6ff" stroke-width="1.1" stroke-dasharray="6 7" opacity=".55"/>';
    nodes.forEach(function (p) { constel += spark(p[0], p[1], 8, 0.85, "#e6dcff"); });
    return {
      defs:
        '<radialGradient id="sky" cx="50%" cy="42%" r="84%">' +
          '<stop offset="0" stop-color="#1b2454"/><stop offset=".5" stop-color="#0a1129"/>' +
          '<stop offset="1" stop-color="#02040c"/>' +
        '</radialGradient>' +
        '<filter id="lit" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="5"/></filter>' +
        '<filter id="halo" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="26"/></filter>' +
        '<pattern id="dotted" width="30" height="30" patternUnits="userSpaceOnUse">' +
          '<circle cx="1" cy="1" r="0.9" fill="#54e6e0" opacity=".2"/>' +
        '</pattern>',
      body:
        '<rect width="' + VW + '" height="' + VH + '" fill="url(#sky)"/>' +
        '<rect width="' + VW + '" height="' + VH + '" fill="url(#dotted)"/>' +
        stars(r, 90, { maxY: VH, opacity: 0.7, max: 1.5 }) +
        '<ellipse cx="400" cy="300" rx="360" ry="220" fill="#8c74ff" opacity=".14" filter="url(#halo)"/>' +
        '<g>' + traces + '</g>' +
        constel +
        /* 芯片焊盘阵列 */
        (function () {
          var s = "";
          for (var i = 0; i < 5; i++) {
            for (var k = 0; k < 4; k++) {
              s += '<rect x="' + (628 + k * 34) + '" y="' + (452 + i * 22) + '" width="18" height="9" rx="2" fill="#2b6f7d" opacity="' +
                   f(0.35 + r() * 0.5) + '"/>';
            }
          }
          return s;
        })() +
        '<rect x="0" y="0" width="' + VW + '" height="' + VH + '" fill="none" stroke="#54e6e0" stroke-width="0.6" opacity=".18"/>'
    };
  }

  var SCENES = {
    "poster--solar": solar,
    "poster--ice": ice,
    "poster--nebula": nebula,
    "poster--aurora": aurora,
    "poster--grid": grid,
    "poster--magma": magma,
    "poster--mist": mist,
    "poster--circuit": circuit
  };

  /* ---------- 组装 ---------- */
  var cache = {};

  function build(key) {
    var fn = SCENES[key];
    if (!fn) return null;
    var r = prng(hash(key));
    var parts = fn(r);
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + VW + " " + VH +
      '" preserveAspectRatio="xMidYMid slice">' +
      "<defs>" + parts.defs + "</defs>" + parts.body + "</svg>";
    return svg;
  }

  Art.svg = function (key) {
    if (!(key in cache)) cache[key] = build(key);
    return cache[key];
  };

  /* data URI：用 base64 而不是百分号编码。
     我的 SVG 里引号与空格极多，encodeURIComponent 会把它们膨胀成
     3 字节，整体约 3 倍；base64 只膨胀 4/3，实测体积下降约一半。 */
  Art.uri = function (key) {
    var s = Art.svg(key);
    if (!s) return null;
    try {
      return "data:image/svg+xml;base64," + w.btoa(s);
    } catch (e) {
      return "data:image/svg+xml," + encodeURIComponent(s);
    }
  };

  /* 找出元素属于哪个场景 */
  function sceneOf(el) {
    for (var key in SCENES) {
      if (el.classList.contains(key)) return key;
    }
    return null;
  }

  /* 应用到一个 .poster 元素
     —— 与旧的图片替换写法完全同构，只是图源换成了本地生成 */
  Art.apply = function (el) {
    if (!el || !el.classList || !el.classList.contains("poster")) return false;
    var key = sceneOf(el);
    if (!key) return false;
    var uri = Art.uri(key);
    if (!uri) return false;

    el.classList.add("poster--art");
    el.style.backgroundImage = 'url("' + uri + '")';
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
    el.style.backgroundRepeat = "no-repeat";

    /* 画面本身已经有视觉焦点，去掉字体符号，避免叠加 */
    var glyph = el.querySelector(".poster__glyph");
    if (glyph) glyph.textContent = "";
    return true;
  };

  Art.init = function (root) {
    var list = (root || d).querySelectorAll(".poster");
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      /* 团队头像保持抽象 CSS 风格，不铺关键帧画面 */
      if (p.closest && p.closest(".member-card")) continue;
      Art.apply(p);
    }
  };

  Art.scenes = Object.keys(SCENES);

  A.Art = Art;
})(window, document);
