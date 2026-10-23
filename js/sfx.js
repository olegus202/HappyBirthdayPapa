/* ==========================================================================
   ЗВУКИ — синтезируются прямо в браузере (никаких внешних файлов)
   ========================================================================== */
(function () {
  'use strict';

  var ctx = null;
  var enabled = true;

  function ensure() {
    if (!enabled) return null;
    try {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { enabled = false; return null; }
        ctx = new AC();
      }
      if (ctx.state === 'suspended' && ctx.resume) { ctx.resume(); }
      return ctx;
    } catch (e) { enabled = false; return null; }
  }

  function tone(freq, dur, type, vol, delay, slideTo) {
    var c = ensure();
    if (!c) return;
    try {
      var t0 = c.currentTime + (delay || 0);
      var osc = c.createOscillator();
      var gain = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol == null ? 0.16 : vol, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch (e) { /* звук не критичен */ }
  }

  var BANK = {
    click:  function () { tone(520, 0.06, 'triangle', 0.09); },
    tap:    function () { tone(380, 0.05, 'sine', 0.07); },
    good:   function () { tone(660, 0.09, 'triangle', 0.12); tone(880, 0.12, 'triangle', 0.11, 0.07); },
    great:  function () { tone(660, 0.1, 'triangle', 0.13); tone(880, 0.1, 'triangle', 0.12, 0.08); tone(1180, 0.18, 'triangle', 0.12, 0.16); },
    win:    function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.28, 'triangle', 0.14, i * 0.1); }); },
    lose:   function () { tone(300, 0.2, 'sawtooth', 0.09); tone(220, 0.26, 'sawtooth', 0.08, 0.12); },
    error:  function () { tone(180, 0.16, 'square', 0.07); },
    match:  function () { tone(880, 0.07, 'sine', 0.1); tone(1170, 0.1, 'sine', 0.09, 0.06); },
    deal:   function () { tone(1200, 0.035, 'square', 0.05); },
    word:   function () { tone(660, 0.07, 'sine', 0.06); tone(880, 0.09, 'sine', 0.05, 0.06); },
    tick:   function () { tone(1400, 0.02, 'square', 0.03); }
  };

  window.SFX = {
    play: function (name) {
      if (!enabled) return;
      var fn = BANK[name];
      if (fn) { try { fn(); } catch (e) {} }
    },
    setEnabled: function (v) { enabled = !!v; if (!v && ctx) { try { ctx.close(); } catch (e) {} ctx = null; } },
    isEnabled: function () { return enabled; },
    unlock: function () { ensure(); }
  };
})();
