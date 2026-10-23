/* ==========================================================================
   МИНИ-ИГРА «МАДЖОНГ» (солитёр)
   --------------------------------------------------------------------------
   Правило свободной плитки:
     • плитка не накрыта сверху (нет плитки выше уровня с перекрытием);
     • слева ИЛИ справа на том же уровне нет соседней плитки.

   Проходимость гарантирована: сначала вычисляется порядок снятия плиток
   (всегда существует для этой раскладки), а затем по нему раздаются пары
   символов. Значит, собирается любая раскладка — и «перемешать», и «решить».
   ========================================================================== */
(function () {
  'use strict';

  /* Символы плиток. Вместо сложных иероглифов — четыре эмодзи:
     🕊️ голубь, 🌺 цветок, 🎂 торт, 🧉 чай-матч. */
  var SYMS = [
    '万', '筒', '条', '东', '南', '西', '北', '中', '发', '白', '春', '夏', '秋', '冬',
    '🕊️', '🌺', '🎂', '🧉', '一', '二', '三', '四', '五', '六', '七', '八', '九', '车',
    '马', '炮', '象', '士', '将', '兵', '卒', '红', '绿', '鱼', '龟', '花'
  ];

  /* Раскладка в «полу-клетках»: плитка занимает 2×2 единицы.
     v — ряд, u — колонка, z — уровень. */
  var LAYOUT = [
    { z: 0, v: 0, us: [4, 6, 8, 10] },
    { z: 0, v: 2, us: [2, 4, 6, 8, 10, 12] },
    { z: 0, v: 4, us: [0, 2, 4, 6, 8, 10, 12, 14] },
    { z: 0, v: 6, us: [0, 2, 4, 6, 8, 10, 12, 14] },
    { z: 0, v: 8, us: [0, 2, 4, 6, 8, 10, 12, 14] },
    { z: 0, v: 10, us: [2, 4, 6, 8, 10, 12] },
    { z: 0, v: 12, us: [4, 6, 8, 10] },
    { z: 1, v: 1, us: [5, 7, 9] },
    { z: 1, v: 3, us: [3, 5, 7, 9, 11] },
    { z: 1, v: 5, us: [1, 3, 5, 7, 9, 11, 13] },
    { z: 1, v: 7, us: [3, 5, 7, 9, 11] },
    { z: 1, v: 9, us: [5, 7, 9] },
    { z: 2, v: 2, us: [6, 8] },
    { z: 2, v: 4, us: [4, 6, 8, 10] },
    { z: 2, v: 6, us: [2, 4, 6, 8, 10] },
    { z: 2, v: 8, us: [6, 8] }
  ];

  var BOARD_W = 16.6;   // единиц по ширине
  var BOARD_H = 15.8;   // единиц по высоте

  App.registerGame({
    id: 'mahjong',
    title: 'Маджонг',
    icon: '🀄',
    desc: 'Собери все парные плитки',
    init: function (root, api) {

      var tiles = [];
      var sel = null;
      var moves = 0, finished = false, busy = false;
      var timer = App.createTimer(function (s) {
        api.setSub('Ходов: ' + moves + ' · ' + App.fmtTime(s));
      });
      timer.start();

      root.innerHTML =
        '<div class="game-card">' +
          '<p class="game-hint">Нажимай на <b>две одинаковые свободные плитки</b>, чтобы убрать их. Затемнённые плитки чем-то перекрыты — их пока трогать нельзя.</p>' +
          '<div class="mj-wrap"><div class="mj-board" id="mj-board"></div></div>' +
          '<div class="mj-legend">' +
            '<span class="mj-pill">Плиток: <b id="mj-left">0</b></span>' +
            '<span class="mj-pill">Ходов: <b id="mj-moves">0</b></span>' +
            '<span class="mj-pill">Время: <b id="mj-time">0:00</b></span>' +
          '</div>' +
          '<div class="msg hidden" id="mj-msg"></div>' +
          '<div class="toolbar">' +
            '<button class="btn btn-sm btn-ghost" id="mj-hint" type="button">Подсказка</button>' +
            '<button class="btn btn-sm btn-ghost" id="mj-shuffle" type="button">Перемешать</button>' +
            '<button class="btn btn-sm btn-ghost" id="mj-solve" type="button">Решить за меня</button>' +
          '</div>' +
        '</div>';

      var board = root.querySelector('#mj-board');
      var msg = root.querySelector('#mj-msg');
      var elLeft = root.querySelector('#mj-left');
      var elMoves = root.querySelector('#mj-moves');
      var elTime = root.querySelector('#mj-time');

      function showMsg(text, kind) {
        msg.textContent = text;
        msg.className = 'msg' + (kind ? ' ' + kind : '');
        msg.classList.remove('hidden');
      }

      /* ───────── правило свободной плитки ───────── */
      function overlaps(a, b) {
        return a.u < b.u + 2 && b.u < a.u + 2 && a.v < b.v + 2 && b.v < a.v + 2;
      }
      function isCovered(t) {
        for (var i = 0; i < tiles.length; i++) {
          var o = tiles[i];
          if (o.removed || o === t) continue;
          if (o.z > t.z && overlaps(o, t)) return true;
        }
        return false;
      }
      function blockedLeft(t) {
        for (var i = 0; i < tiles.length; i++) {
          var o = tiles[i];
          if (o.removed || o === t) continue;
          if (o.z === t.z && o.u + 2 <= t.u && o.v < t.v + 2 && t.v < o.v + 2) return true;
        }
        return false;
      }
      function blockedRight(t) {
        for (var i = 0; i < tiles.length; i++) {
          var o = tiles[i];
          if (o.removed || o === t) continue;
          if (o.z === t.z && o.u >= t.u + 2 && o.v < t.v + 2 && t.v < o.v + 2) return true;
        }
        return false;
      }
      function isFree(t) {
        if (isCovered(t)) return false;
        return !blockedLeft(t) || !blockedRight(t);
      }
      function freeTiles() {
        return tiles.filter(function (t) { return !t.removed && isFree(t); });
      }

      /* ───────── порядок снятия (гарантирует проходимость) ───────── */
      function snapshot() {
        var s = new Array(tiles.length);
        for (var i = 0; i < tiles.length; i++) s[i] = tiles[i].removed;
        return s;
      }
      function restore(s) {
        for (var i = 0; i < tiles.length; i++) tiles[i].removed = s[i];
      }

      function computeOrder(randomize) {
        var snap = snapshot();
        var order = [];
        var guard = 0;
        while (true) {
          if (guard++ > 600) { restore(snap); return null; }
          var left = 0, i;
          for (i = 0; i < tiles.length; i++) if (!tiles[i].removed) left++;
          if (left === 0) { restore(snap); return order; }
          var free = [];
          for (i = 0; i < tiles.length; i++) if (!tiles[i].removed && isFree(tiles[i])) free.push(tiles[i]);
          if (free.length < 2) { restore(snap); return null; }
          var a, b;
          if (randomize && free.length > 2) {
            a = free[(Math.random() * free.length) | 0];
            b = free[(Math.random() * free.length) | 0];
            if (a === b) b = free[(free.indexOf(a) + 1) % free.length];
          } else {
            a = free[0]; b = free[1];
          }
          a.removed = true; b.removed = true;
          order.push([a, b]);
        }
      }

      /* Раздаём символы парам по порядку снятия — так раскладка всегда проходима.
         Каждой паре достаётся свой символ, поэтому любая плитка встречается ровно дважды. */
      function assignSymbols(order, alive) {
        var uniq = [], seen = {};
        alive.forEach(function (t) {
          if (!seen[t.sym]) { seen[t.sym] = true; uniq.push(t.sym); }
        });
        var pool = App.shuffle(uniq);
        var guard = 0;
        while (pool.length < order.length && guard++ < 300) {
          var s = SYMS[(Math.random() * SYMS.length) | 0];
          if (pool.indexOf(s) < 0) pool.push(s);
        }
        order.forEach(function (pair, i) {
          var sym = pool[i] || pool[pool.length - 1];
          pair[0].sym = sym;
          pair[1].sym = sym;
        });
        alive.forEach(function (t) {
          if (t.el && t.el.firstChild) t.el.firstChild.textContent = t.sym;
          if (t.el) t.el.setAttribute('aria-label', 'плитка ' + t.sym);
        });
      }

      /* ───────── построение раскладки ───────── */
      function build() {
        tiles = [];
        board.innerHTML = '';
        var positions = [];
        LAYOUT.forEach(function (row) {
          row.us.forEach(function (u) { positions.push({ u: u, v: row.v, z: row.z }); });
        });
        var syms = App.shuffle(SYMS.slice());
        while (syms.length < positions.length / 2) syms = syms.concat(App.shuffle(SYMS.slice()));
        syms = syms.slice(0, positions.length / 2);

        var deck = [];
        syms.forEach(function (s) { deck.push(s, s); });
        App.shuffle(deck);

        positions.forEach(function (p, i) {
          var t = { id: i, u: p.u, v: p.v, z: p.z, sym: deck[i], removed: false, el: null };
          tiles.push(t);
        });

        tiles.forEach(function (t) {
          var d = App.el('div', 'mj-tile');
          d.innerHTML = '<span>' + t.sym + '</span>';
          d.setAttribute('role', 'button');
          d.setAttribute('aria-label', 'плитка ' + t.sym);
          d.addEventListener('click', function (e) { e.stopPropagation(); onTile(t); });
          t.el = d;
          board.appendChild(d);
        });

        moves = 0;
        var order = computeOrder(true) || computeOrder(false);
        if (order) assignSymbols(order, tiles);
        layout();
        refresh();
      }

      /* ───────── геометрия ───────── */
      var unit = 24;

      function computeUnit() {
        var wrapW = board.parentNode.clientWidth || 320;
        var wrapH = Math.min(window.innerHeight * 0.5, 520);
        var u = Math.min((wrapW - 4) / BOARD_W, (wrapH - 8) / BOARD_H);
        unit = Math.max(12, Math.min(40, u));
        board.style.height = Math.round(unit * BOARD_H) + 'px';
      }

      function layout() {
        computeUnit();
        var gap = Math.max(1, unit * 0.06);
        tiles.forEach(function (t) {
          if (!t.el) return;
          t.el.style.width = (unit * 2 - gap) + 'px';
          t.el.style.height = (unit * 2 - gap) + 'px';
          t.el.style.left = (t.u * unit) + 'px';
          t.el.style.top = (t.v * unit - t.z * unit * 0.42) + 'px';
          t.el.style.zIndex = String(t.z * 1000 + t.v);
          var sp = t.el.firstChild;
          if (sp) sp.style.fontSize = Math.round(unit * 0.95) + 'px';
        });
      }

      function refresh() {
        var alive = tiles.filter(function (t) { return !t.removed; });
        elLeft.textContent = String(alive.length);
        elMoves.textContent = String(moves);
        var s = timer.seconds();
        elTime.textContent = Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
        alive.forEach(function (t) {
          if (t.el) t.el.classList.toggle('blocked', !isFree(t));
        });
      }

      /* ───────── клики ───────── */
      function onTile(t) {
        if (busy || finished) return;
        if (t.removed) return;
        if (!isFree(t)) {
          showMsg('Эта плитка перекрыта — сначала убери верхние', 'warn');
          t.el.classList.add('shake');
          setTimeout(function () { t.el.classList.remove('shake'); }, 420);
          SFX.play('error');
          return;
        }
        if (!sel) {
          sel = t;
          t.el.classList.add('sel');
          SFX.play('tap');
          return;
        }
        if (sel === t) {
          sel.el.classList.remove('sel');
          sel = null;
          SFX.play('tap');
          return;
        }
        if (sel.sym === t.sym) {
          var a = sel, b = t;
          sel = null;
          removePair(a, b);
        } else {
          sel.el.classList.remove('sel');
          sel = t;
          t.el.classList.add('sel');
          showMsg('Плитки не совпали', 'warn');
          SFX.play('error');
        }
      }

      function removePair(a, b) {
        busy = true;
        moves++;
        [a, b].forEach(function (t) {
          t.removed = true;
          if (t.el) {
            t.el.classList.remove('sel', 'blocked');
            t.el.classList.add('matched');
          }
        });
        SFX.play('match');
        setTimeout(function () {
          [a, b].forEach(function (t) { if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el); });
          busy = false;
          refresh();
          checkWin();
        }, 420);
      }

      function checkWin() {
        var alive = tiles.filter(function (t) { return !t.removed; });
        if (alive.length === 0 && !finished) {
          finished = true;
          timer.stop();
          SFX.play('win');
          setTimeout(function () {
            api.onWin({
              text: 'все ' + (tiles.length / 2) + ' пар собраны',
              score: Math.max(20, 100 - moves),
              time: timer.seconds()
            });
          }, 500);
        }
      }

      /* ───────── команды ───────── */
      root.querySelector('#mj-hint').addEventListener('click', function () {
        if (finished || busy) return;
        var order = computeOrder(false);
        if (!order || !order.length) {
          showMsg('Сейчас нет свободных пар', 'warn');
          return;
        }
        var p = order[0];
        if (!p[0].el || !p[1].el) return;
        p[0].el.classList.add('hint');
        p[1].el.classList.add('hint');
        setTimeout(function () {
          p[0].el.classList.remove('hint');
          p[1].el.classList.remove('hint');
        }, 1800);
        showMsg('Вот эти две плитки можно убрать', 'ok');
        SFX.play('good');
      });

      root.querySelector('#mj-shuffle').addEventListener('click', function () {
        if (finished || busy) return;
        var alive = tiles.filter(function (t) { return !t.removed; });
        if (alive.length < 2) return;
        var order = computeOrder(true) || computeOrder(false);
        if (order) assignSymbols(order, alive);
        refresh();
        showMsg('Плитки перемешаны — попробуй снова!', 'ok');
        SFX.play('click');
      });

      root.querySelector('#mj-solve').addEventListener('click', function () {
        if (finished || busy) return;
        var order = computeOrder(false);
        if (!order || !order.length) {
          showMsg('Сейчас нет свободных пар', 'warn');
          return;
        }
        busy = true;
        showMsg('Магия работает — собираю за тебя…', 'ok');
        var i = 0;
        (function step() {
          if (i >= order.length) {
            busy = false;
            refresh();
            checkWin();
            return;
          }
          var pair = order[i++];
          pair.forEach(function (t) {
            t.removed = true;
            if (t.el) t.el.classList.add('matched');
          });
          moves++;
          refresh();
          SFX.play('match');
          setTimeout(function () {
            pair.forEach(function (t) { if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el); });
            refresh();
            step();
          }, 240);
        })();
      });

      /* ───────── старт ───────── */
      build();
      layout();
      refresh();

      var onResize = function () { layout(); refresh(); };
      window.addEventListener('resize', onResize);
      window.addEventListener('orientationchange', function () { setTimeout(onResize, 250); });

      return {
        destroy: function () {
          timer.stop();
          window.removeEventListener('resize', onResize);
        }
      };
    }
  });
})();
