/* ==========================================================================
   МИНИ-ИГРА «ПАСЬЯНС» (Клондайк)
   Работает мышью и пальцем (pointer events), поддерживает перетаскивание.
   ========================================================================== */
(function () {
  'use strict';

  var SUITS = [
    { sym: '♠', red: false },
    { sym: '♥', red: true },
    { sym: '♦', red: true },
    { sym: '♣', red: false }
  ];
  var RANK_NAME = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

  App.registerGame({
    id: 'klondike',
    title: 'Пасьянс',
    icon: '♠',
    desc: 'Собери все 52 карты в четыре стопки',
    init: function (root, api) {

      var stock = [], waste = [], found = [[], [], [], []], tab = [[], [], [], [], [], [], []];
      var undoStack = [];
      var moves = 0, busy = false, finished = false, redeals = 0;
      var timer = App.createTimer(function (s) { api.setSub('Ходов: ' + moves + ' · ' + App.fmtTime(s)); });
      timer.start();

      root.innerHTML =
        '<div class="game-card">' +
          '<p class="game-hint">Собери все карты в <b>четыре стопки</b> (♠ ♥ ♦ ♣) — от туза до короля. Тащи карты мышкой или пальцем, можно просто <b>нажать</b> на карту.</p>' +
          '<div class="sol-wrap" id="sol-wrap">' +
            '<div class="sol-top" id="sol-top"></div>' +
            '<div class="sol-row" id="sol-row"></div>' +
          '</div>' +
          '<div class="msg hidden" id="sol-msg"></div>' +
          '<div class="sol-actions">' +
            '<button class="btn btn-sm btn-ghost" id="sol-undo" type="button">↶ Отменить</button>' +
            '<button class="btn btn-sm btn-ghost" id="sol-auto" type="button">Автодобор</button>' +
            '<button class="btn btn-sm btn-ghost" id="sol-new" type="button">Заново</button>' +
          '</div>' +
        '</div>';

      var topRow = root.querySelector('#sol-top');
      var tabRow = root.querySelector('#sol-row');
      var msg = root.querySelector('#sol-msg');

      var dragLayer = document.getElementById('drag-layer');
      if (!dragLayer) {
        dragLayer = App.el('div');
        dragLayer.id = 'drag-layer';
        document.body.appendChild(dragLayer);
      }

      function showMsg(text, kind) {
        msg.textContent = text;
        msg.className = 'msg' + (kind ? ' ' + kind : '');
        msg.classList.remove('hidden');
      }

      /* ───────── колода ───────── */
      function newDeck() {
        var d = [];
        for (var s = 0; s < 4; s++) {
          for (var r = 1; r <= 13; r++) d.push({ suit: s, rank: r, up: false });
        }
        return App.shuffle(d);
      }

      function deal() {
        var deck = newDeck();
        stock = []; waste = []; found = [[], [], [], []]; tab = [[], [], [], [], [], [], []];
        undoStack = []; moves = 0; redeals = 0; finished = false;
        for (var i = 0; i < 7; i++) {
          for (var j = i; j < 7; j++) {
            var c = deck.pop();
            c.up = (j === i);
            tab[j].push(c);
          }
        }
        stock = deck;
        render();
        api.setSub('Ходов: 0');
      }

      function snapshot() {
        return JSON.stringify({
          stock: stock, waste: waste, found: found, tab: tab, moves: moves, redeals: redeals
        });
      }
      function restore(s) {
        var d = JSON.parse(s);
        stock = d.stock; waste = d.waste; found = d.found; tab = d.tab; moves = d.moves; redeals = d.redeals;
      }
      function pushUndo() {
        undoStack.push(snapshot());
        if (undoStack.length > 80) undoStack.shift();
      }

      /* ───────── отрисовка ───────── */
      var pileEls = {};

      function setCount(key, n) {
        var p = pileEls[key];
        if (!p) return;
        var c = p.querySelector('.pile-count');
        if (c) c.textContent = String(n);
      }

      function makePile(key, cls) {
        var p = App.el('div', 'pile ' + (cls || ''));
        p.setAttribute('data-pile', key);
        return p;
      }

      function buildStructure() {
        topRow.innerHTML = '';
        tabRow.innerHTML = '';
        pileEls = {};

        var stockPile = makePile('stock');
        stockPile.innerHTML = '<span class="pile-label">♻</span><span class="pile-count">0</span>';
        var wastePile = makePile('waste');
        wastePile.innerHTML = '<span class="pile-count">0</span>';
        var foundPiles = [];
        for (var f = 0; f < 4; f++) {
          var fp = makePile('found:' + f);
          fp.innerHTML = '<span class="pile-label">' + SUITS[f].sym + '</span>';
          foundPiles.push(fp);
        }
        topRow.appendChild(stockPile);
        topRow.appendChild(wastePile);
        topRow.appendChild(App.el('div', 'sol-spacer'));   // колода отдельно от мест для тузов
        for (var i = 0; i < 4; i++) topRow.appendChild(foundPiles[i]);
        pileEls.stock = stockPile;
        pileEls.waste = wastePile;
        for (var j = 0; j < 4; j++) pileEls['found:' + j] = foundPiles[j];

        var tabPiles = [];
        for (var t = 0; t < 7; t++) {
          var tp = makePile('tab:' + t);
          tabPiles.push(tp);
          tabRow.appendChild(tp);
          pileEls['tab:' + t] = tp;
        }
      }

      function cardEl(card) {
        var d = App.el('div', 'card' + (card.up ? '' : ' back') + (SUITS[card.suit].red ? ' red' : ''));
        if (card.up) {
          var name = RANK_NAME[card.rank] || String(card.rank);
          d.innerHTML = '<span class="c-rank">' + name + '</span>' +
            '<span class="c-suit">' + SUITS[card.suit].sym + '</span>' +
            '<span class="c-center">' + SUITS[card.suit].sym + '</span>';
        }
        d.setAttribute('data-card', '1');
        return d;
      }

      /* ширина стопки и высота карты под неё (карта всегда «в стопке») */
      function pileWidth(p) { return (p && p.clientWidth) ? p.clientWidth : 44; }
      function fitCard(card, pile) {
        card.style.height = Math.round(pileWidth(pile) / 0.71) + 'px';
      }

      function render() {
        if (!pileEls.stock) buildStructure();

        // очищаем карты, оставляем подписи и счётчики
        Object.keys(pileEls).forEach(function (k) {
          var p = pileEls[k];
          var keep = Array.prototype.slice.call(p.querySelectorAll('.pile-label,.pile-count'));
          p.innerHTML = '';
          keep.forEach(function (n) { p.appendChild(n); });
        });

        setCount('stock', stock.length);
        setCount('waste', waste.length);

        // колода: тап по колоде тянет карту, тап по пустой — перемешивает заново
        var st = pileEls.stock;
        st.onclick = function () {
          if (busy || finished) return;
          if (stock.length) { takeFrom('stock'); return; }
          if (waste.length) {
            pushUndo();
            redeals++;
            while (waste.length) { var c = waste.pop(); c.up = false; stock.push(c); }
            moves++;
            render();
            SFX.play('deal');
            showMsg('Колода перемешана заново', 'warn');
          } else {
            showMsg('Колода пуста', 'warn');
          }
        };
        if (stock.length) {
          var top = stock[stock.length - 1];
          var c0 = cardEl(top);
          c0.classList.add('back');
          c0.style.left = '0px'; c0.style.top = '0px';
          c0.style.zIndex = String(stock.length);
          fitCard(c0, st);
          st.appendChild(c0);
        }

        // сброс
        var wt = pileEls.waste;
        if (waste.length) {
          var topW = waste[waste.length - 1];
          var c1 = cardEl(topW);
          c1.style.left = '0px'; c1.style.top = '0px';
          c1.style.zIndex = String(waste.length);
          fitCard(c1, wt);
          wt.appendChild(c1);
          bindCard(c1, 'waste', waste.length - 1);
        }

        // базы
        for (var f = 0; f < 4; f++) {
          var p = pileEls['found:' + f];
          var col = found[f];
          if (col.length) {
            var ct = cardEl(col[col.length - 1]);
            ct.style.left = '0px'; ct.style.top = '0px';
            ct.style.zIndex = String(col.length);
            fitCard(ct, p);
            p.appendChild(ct);
            bindCard(ct, 'found:' + f, col.length - 1);
          }
        }

        // стол
        for (var t = 0; t < 7; t++) {
          var tp = pileEls['tab:' + t];
          var col2 = tab[t];
          var tw = pileWidth(tp);
          var offset = 0;
          for (var i = 0; i < col2.length; i++) {
            var card = col2[i];
            var ce = cardEl(card);
            ce.style.left = '0px';
            ce.style.top = offset + 'px';
            ce.style.zIndex = String(i);
            fitCard(ce, tp);
            tp.appendChild(ce);
            bindCard(ce, 'tab:' + t, i);
            offset += card.up ? Math.max(9, tw * 0.30) : Math.max(5, tw * 0.13);
          }
        }

        /* запас снизу: длинный столбец не должен наезжать на кнопки */
        var pileH = (pileEls['tab:0'] && pileEls['tab:0'].clientHeight) || 0;
        var need = 0;
        for (var t2 = 0; t2 < 7; t2++) {
          var pel = pileEls['tab:' + t2];
          var cards2 = pel ? pel.querySelectorAll('.card') : [];
          if (!cards2.length) continue;
          var lastEl = cards2[cards2.length - 1];
          var bottom = lastEl.offsetTop + lastEl.offsetHeight;
          if (bottom > need) need = bottom;
        }
        tabRow.style.paddingBottom = pileH ? Math.max(0, Math.ceil(need - pileH) + 8) + 'px' : '';
      }

      /* ───────── правила ───────── */
      function canStackTableau(card, targetCol) {
        if (!card.up) return false;
        if (!targetCol.length) return card.rank === 13;
        var top = targetCol[targetCol.length - 1];
        if (!top.up) return false;
        if (top.rank !== card.rank + 1) return false;
        return SUITS[top.suit].red !== SUITS[card.suit].red;
      }

      function canStackFoundation(card, f) {
        if (!card.up) return false;
        var col = found[f];
        if (!col.length) return card.rank === 1;
        var top = col[col.length - 1];
        return top.suit === card.suit && top.rank === card.rank - 1;
      }

      /* ───────── перемещения ───────── */
      function takeFrom(pileKey, index) {
        if (pileKey === 'stock') {
          if (!stock.length) return null;
          pushUndo();
          var c = stock.pop();
          c.up = true;
          waste.push(c);
          moves++; redeals = 0;
          render();
          SFX.play('deal');
          return c;
        }
        if (pileKey === 'waste') {
          if (!waste.length) return null;
          pushUndo();
          var cw = waste.pop();
          moves++;
          render();
          SFX.play('deal');
          return cw;
        }
        return null;
      }

      function moveCards(pileKey, index, targetKey, count) {
        if (targetKey === pileKey) return false;
        var src = pileKeyArray(pileKey);
        if (!src) return false;
        var dst = pileKeyArray(targetKey);
        if (!dst) return false;

        var moving = src.slice(index);
        if (!moving.length) return false;

        // проверка соответствия
        if (targetKey.indexOf('found:') === 0) {
          if (moving.length !== 1) return false;
          if (!canStackFoundation(moving[0], +targetKey.slice(6))) return false;
        } else {
          if (!canStackTableau(moving[0], dst)) return false;
          // последовательность должна быть валидной
          for (var i = 1; i < moving.length; i++) {
            var a = moving[i - 1], b = moving[i];
            if (!b.up) return false;
            if (a.rank !== b.rank + 1) return false;
            if (SUITS[a.suit].red === SUITS[b.suit].red) return false;
          }
        }

        pushUndo();
        src.splice(index);
        for (var j = 0; j < moving.length; j++) dst.push(moving[j]);

        if (pileKey.indexOf('tab:') === 0) {
          var col = tab[+pileKey.slice(4)];
          if (col.length && !col[col.length - 1].up) {
            var flipped = col[col.length - 1];
            flipped.up = true;
            SFX.play('deal');
          }
        }
        moves++;
        render();
        SFX.play('good');
        checkWin();
        return true;
      }

      function autoMove(card, fromKey) {
        var src = pileKeyArray(fromKey);
        if (!src) return false;
        var idx = src.indexOf(card);
        if (idx < 0) return false;
        if (!card.up) return false;

        var moving = src.slice(idx);
        // из колоды и сброса берём только верхнюю карту
        if (fromKey.indexOf('tab:') !== 0 && idx !== src.length - 1) return false;
        // на столе можно взять всю открытую последовательность
        for (var i = 0; i < moving.length; i++) if (!moving[i].up) return false;
        for (var j = 1; j < moving.length; j++) {
          if (moving[j - 1].rank !== moving[j].rank + 1) return false;
          if (SUITS[moving[j - 1].suit].red === SUITS[moving[j].suit].red) return false;
        }

        // одна карта — сначала пробуем базу
        if (moving.length === 1) {
          for (var f = 0; f < 4; f++) {
            if (canStackFoundation(card, f)) {
              return moveCards(fromKey, idx, 'found:' + f, 1);
            }
          }
        }
        // затем стол: пустой столбец или открытая карта
        var best = -1, bestScore = -1;
        for (var t = 0; t < 7; t++) {
          if ('tab:' + t === fromKey) continue;
          if (!canStackTableau(moving[0], tab[t])) continue;
          var score = !tab[t].length ? 2 : (tab[t][tab[t].length - 1].up ? 0 : 1);
          if (score > bestScore) { best = t; bestScore = score; }
        }
        if (best >= 0) return moveCards(fromKey, idx, 'tab:' + best, moving.length);
        return false;
      }

      function pileKeyArray(pileKey) {
        if (pileKey.indexOf('tab:') === 0) return tab[+pileKey.slice(4)];
        if (pileKey === 'waste') return waste;
        if (pileKey.indexOf('found:') === 0) return found[+pileKey.slice(6)];
        return null;
      }

      /* ───────── перетаскивание ───────── */
      var drag = null;

      function bindCard(elm, pileKey, index) {
        elm.addEventListener('pointerdown', function (e) { startDrag(e, elm, pileKey, index); });
      }

      function startDrag(e, elm, pileKey, index) {
        if (busy || finished) return;
        if (e.button !== undefined && e.button !== 0) return;
        var src = pileKeyArray(pileKey);
        if (!src) return;
        if (pileKey === 'waste' && index !== src.length - 1) return;
        if (pileKey.indexOf('found:') === 0 && index !== src.length - 1) return;
        if (pileKey.indexOf('tab:') === 0) {
          for (var i = index; i < src.length; i++) if (!src[i].up) return;
        }

        var moving = src.slice(index);
        // прямоугольники всех перетаскиваемых карт
        var allCards = elm.parentNode.querySelectorAll('.card');
        var rects = [];
        for (var k = index; k < allCards.length; k++) rects.push(allCards[k].getBoundingClientRect());

        var ghosts = [];
        for (var g = 0; g < rects.length; g++) {
          var clone = moving[g] ? cardEl(moving[g]) : null;
          if (!clone) continue;
          clone.classList.add('dragging');
          clone.style.position = 'fixed';
          clone.style.left = rects[g].left + 'px';
          clone.style.top = rects[g].top + 'px';
          clone.style.width = rects[g].width + 'px';
          clone.style.height = rects[g].height + 'px';
          clone.style.margin = '0';
          dragLayer.appendChild(clone);
          ghosts.push({ el: clone, rect: rects[g] });
        }

        drag = {
          pileKey: pileKey, index: index, count: moving.length,
          startX: e.clientX, startY: e.clientY, ghosts: ghosts, moved: false,
          card: moving[0]
        };
        try { elm.setPointerCapture && elm.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault();
      }

      function onPointerMove(e) {
        if (!drag) return;
        var dx = e.clientX - drag.startX;
        var dy = e.clientY - drag.startY;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 8) return;
        drag.moved = true;
        drag.ghosts.forEach(function (g) {
          g.el.style.left = (g.rect.left + dx) + 'px';
          g.el.style.top = (g.rect.top + dy) + 'px';
        });
        var target = targetAt(e.clientX, e.clientY);
        Object.keys(pileEls).forEach(function (k) {
          pileEls[k].classList.toggle('over', target === k && canDrop(drag, k));
        });
      }

      function targetAt(x, y) {
        var node = document.elementFromPoint(x, y);
        if (!node) return null;
        var pile = node.closest ? node.closest('.pile') : null;
        return pile ? pile.getAttribute('data-pile') : null;
      }

      function canDrop(d, targetKey) {
        if (!targetKey) return false;
        var src = d.pileKey.indexOf('tab:') === 0 ? tab[+d.pileKey.slice(4)]
          : d.pileKey === 'waste' ? waste
          : d.pileKey.indexOf('found:') === 0 ? found[+d.pileKey.slice(6)] : null;
        if (!src) return false;
        var moving = src.slice(d.index);
        if (!moving.length) return false;
        if (targetKey === d.pileKey) return false;
        if (targetKey.indexOf('found:') === 0) {
          if (moving.length !== 1) return false;
          return canStackFoundation(moving[0], +targetKey.slice(6));
        }
        if (targetKey.indexOf('tab:') === 0) {
          var dst = tab[+targetKey.slice(4)];
          if (!canStackTableau(moving[0], dst)) return false;
          for (var i = 1; i < moving.length; i++) {
            var a = moving[i - 1], b = moving[i];
            if (a.rank !== b.rank + 1) return false;
            if (SUITS[a.suit].red === SUITS[b.suit].red) return false;
          }
          return true;
        }
        return false;
      }

      function onPointerUp(e) {
        if (!drag) return;
        var d = drag;
        drag = null;
        d.ghosts.forEach(function (g) { if (g.el.parentNode) g.el.parentNode.removeChild(g.el); });
        Object.keys(pileEls).forEach(function (k) { pileEls[k].classList.remove('over'); });

        var target = targetAt(e.clientX, e.clientY);
        var dist = Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY);
        // небольшое дрожание пальца — это всё ещё нажатие, а не перенос
        if (d.moved && dist >= 16) {
          if (target && canDrop(d, target)) {
            if (moveCards(d.pileKey, d.index, target, d.count)) return;
          }
          render();
          return;
        }
        // это было нажатие — пробуем автоматический ход
        if (d.pileKey === 'stock') {
          if (!stock.length) {
            if (waste.length) {
              pushUndo();
              redeals++;
              while (waste.length) { var c = waste.pop(); c.up = false; stock.push(c); }
              moves++;
              render();
              SFX.play('deal');
              showMsg('Колода перемешана заново', 'warn');
            } else {
              showMsg('Колода пуста', 'warn');
            }
          } else {
            takeFrom('stock');
          }
          return;
        }
        if (d.pileKey === 'waste' && d.index !== waste.length - 1) return;
        if (d.pileKey.indexOf('found:') === 0) return;
        if (!autoMove(d.card, d.pileKey)) {
          showMsg('Эту карту сейчас нельзя переложить', 'warn');
          SFX.play('error');
        }
      }

      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('pointercancel', function () {
        if (drag) { drag.ghosts.forEach(function (g) { if (g.el.parentNode) g.el.parentNode.removeChild(g.el); }); drag = null; render(); }
      });

      /* ───────── автодобор и проверка победы ───────── */
      function autoComplete() {
        var progress = true;
        var guard = 0;
        while (progress && guard++ < 200) {
          progress = false;
          for (var t = 0; t < 7; t++) {
            var col = tab[t];
            if (!col.length) continue;
            var last = col[col.length - 1];
            if (!last.up) continue;
            for (var f = 0; f < 4; f++) {
              if (canStackFoundation(last, f)) {
                moveCards('tab:' + t, col.length - 1, 'found:' + f, 1);
                progress = true;
                break;
              }
            }
          }
          if (!progress && waste.length) {
            var wc = waste[waste.length - 1];
            for (var f2 = 0; f2 < 4; f2++) {
              if (canStackFoundation(wc, f2)) {
                moveCards('waste', waste.length - 1, 'found:' + f2, 1);
                progress = true;
                break;
              }
            }
          }
        }
        checkWin();
        return progress;
      }

      function checkWin() {
        if (finished) return;
        var total = 0;
        for (var f = 0; f < 4; f++) total += found[f].length;
        if (total === 52) {
          finished = true;
          timer.stop();
          SFX.play('win');
          setTimeout(function () {
            api.onWin({
              text: 'все 52 карты собраны',
              score: Math.max(20, 120 - moves),
              time: timer.seconds()
            });
          }, 600);
        }
      }

      /* ───────── кнопки ───────── */
      root.querySelector('#sol-undo').addEventListener('click', function () {
        if (busy || !undoStack.length) { showMsg('Нечего отменять', 'warn'); return; }
        restore(undoStack.pop());
        render();
        SFX.play('tap');
        showMsg('Отменили последний ход', 'ok');
      });

      root.querySelector('#sol-auto').addEventListener('click', function () {
        if (busy || finished) return;
        if (!autoComplete()) showMsg('Пока нечего собрать автоматически', 'warn');
        else showMsg('Собираем по максимуму', 'ok');
      });

      root.querySelector('#sol-new').addEventListener('click', function () {
        if (busy) return;
        deal();
        showMsg('Новая раздача!', 'ok');
      });

      /* ───────── старт ───────── */
      buildStructure();
      deal();

      var onResize = function () { render(); };
      window.addEventListener('resize', onResize);

      return {
        destroy: function () {
          timer.stop();
          document.removeEventListener('pointermove', onPointerMove);
          document.removeEventListener('pointerup', onPointerUp);
          window.removeEventListener('resize', onResize);
          if (drag) { drag.ghosts.forEach(function (g) { if (g.el.parentNode) g.el.parentNode.removeChild(g.el); }); drag = null; }
        }
      };
    }
  });
})();
