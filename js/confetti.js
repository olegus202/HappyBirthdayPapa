/* ==========================================================================
   КОНФЕТТИ — лёгкий canvas-движок без зависимостей
   ========================================================================== */
(function () {
  'use strict';

  var canvas = null, ctx = null, parts = [], raf = 0, running = false;
  var COLORS = ['#ffd166', '#ff6f9c', '#7ee8fa', '#b388ff', '#8bf18b', '#ffffff', '#ff9f43'];

  function setup() {
    if (canvas) return true;
    canvas = document.getElementById('confetti');
    if (!canvas) return false;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 250); });
    return true;
  }

  function resize() {
    if (!canvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makePiece(x, y, opts) {
    var o = opts || {};
    return {
      x: x, y: y,
      vx: (Math.random() - 0.5) * (o.spread || 9),
      vy: o.vy != null ? o.vy : -Math.random() * 13 - 5,
      w: o.w || 7 + Math.random() * 7,
      h: o.h || 9 + Math.random() * 11,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.34,
      shape: Math.random() < 0.32 ? 'circle' : 'rect',
      life: 0,
      ttl: o.ttl || 170 + Math.random() * 90
    };
  }

  function burst(x, y, count, opts) {
    if (!setup()) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var n = count || 70;
    for (var i = 0; i < n; i++) parts.push(makePiece(x, y, opts));
    if (parts.length > 900) parts.splice(0, parts.length - 900);
    start();
  }

  function rain(count) {
    if (!setup()) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var w = window.innerWidth, h = window.innerHeight;
    var n = count || 60;
    for (var i = 0; i < n; i++) {
      var p = makePiece(Math.random() * w, -20 - Math.random() * h * 0.6, { vy: 1 + Math.random() * 3, ttl: 400 });
      p.vx = (Math.random() - 0.5) * 2.5;
      p.vr = (Math.random() - 0.5) * 0.2;
      parts.push(p);
    }
    start();
  }

  function start() {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(tick);
  }

  function tick() {
    if (!ctx) { running = false; return; }
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    var w = window.innerWidth, h = window.innerHeight;
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.life++;
      p.vy += 0.26;
      p.vx *= 0.995;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      if (p.y > h + 60 || p.life > p.ttl) { parts.splice(i, 1); continue; }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, Math.min(1, (p.ttl - p.life) / 40));
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.ellipse(0, 0, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    }
    if (parts.length) {
      raf = requestAnimationFrame(tick);
    } else {
      running = false;
      ctx.clearRect(0, 0, w, h);
    }
  }

  function clear() {
    parts = [];
    if (ctx) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  window.Confetti = { burst: burst, rain: rain, clear: clear };
})();
