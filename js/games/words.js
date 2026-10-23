/* ==========================================================================
   МИНИ-ИГРА «СЛОВА ПО КРУГУ»
   Кроссворд + колесо букв. Соединяй буквы, чтобы находить слова.
   ========================================================================== */
(function () {
  'use strict';

  var DEFAULT = {
    letters: 'ПОДАРОК',
    words: ['подарок', 'пора', 'кора', 'дар', 'рак', 'рок', 'код', 'пар']
  };

  function norm(s) {
    return (s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^а-я]/g, '');
  }

  /* ───────── генератор кроссворда ───────── */
  function buildLayout(targetWords) {
    var words = targetWords.map(function (w) {
      return norm(w);
    }).filter(function (w) { return w.length >= 2; });

    // убираем повторы
    var uniq = [];
    var seen = {};
    words.forEach(function (w) { if (!seen[w]) { seen[w] = true; uniq.push(w); } });
    words = uniq;
    words.sort(function (a, b) { return b.length - a.length; });

    var grid = {}; // "r,c" -> {ch: string, words: [...]}
    var placed = [];

    function key(r, c) { return r + ',' + c; }
    function get(r, c) { return grid[key(r, c)]; }

    function set(r, c, ch, wid) {
      var k = key(r, c);
      if (!grid[k]) grid[k] = { ch: ch, words: [] };
      if (!grid[k].words[wid]) grid[k].words[wid] = true;
    }

    function canPlace(word, r, c, dr, dc) {
      var crosses = 0;
      for (var i = 0; i < word.length; i++) {
        var rr = r + dr * i;
        var cc = c + dc * i;
        var cur = get(rr, cc);
        if (cur) {
          if (cur.ch !== word[i]) return { ok: false };
          crosses++;
          // при пересечении боковые соседи не должны создавать новых букв
        } else {
          // для новых клеток боковые соседи (перпендикулярные) должны быть пусты
          if (dr === 0) {
            // горизонтально — проверяем сверху и снизу
            if (get(rr - 1, cc) || get(rr + 1, cc)) return { ok: false };
          } else {
            // вертикально — проверяем слева и справа
            if (get(rr, cc - 1) || get(rr, cc + 1)) return { ok: false };
          }
        }
      }
      // концы не должны примыкать к буквам
      var br = r - dr, bc = c - dc;
      var ar = r + dr * word.length, ac = c + dc * word.length;
      if (get(br, bc) || get(ar, ac)) return { ok: false };
      if (crosses === 0) return { ok: false }; // без пересечений не ставим (кроме первого)
      return { ok: true, crosses: crosses };
    }

    // первое слово
    if (words[0]) {
      var w0 = words[0];
      for (var i0 = 0; i0 < w0.length; i0++) set(0, i0, w0[i0], 0);
      placed.push({ word: w0, r: 0, c: 0, dr: 0, dc: 1, id: 0 });
    }

    // пытаемся пристыковать остальные
    words.forEach(function (word, wid) {
      if (wid === 0) return;
      var best = null;
      var bestScore = -1000;
      placed.forEach(function (pw) {
        for (var i = 0; i < pw.word.length; i++) {
          for (var j = 0; j < word.length; j++) {
            if (pw.word[i] !== word[j]) continue;
            var pr = pw.r + (pw.dr ? pw.dr * i : 0);
            var pc = pw.c + (pw.dc ? pw.dc * i : 0);
            // перпендикулярное направление
            var dr = pw.dr === 0 ? 1 : 0;
            var dc = pw.dr === 0 ? 0 : 1;
            var rr = pr - dr * j;
            var cc = pc - dc * j;
            var res = canPlace(word, rr, cc, dr, dc);
            if (!res.ok) continue;
            // счёт: больше пересечений + компактнее
            var score = res.crosses * 10;
            // компактность — штраф за удаление
            var br2 = rr, bc2 = cc;
            var er2 = rr + dr * word.length, ec2 = cc + dc * word.length;
            // примерный размер
            score -= Math.abs(rr) + Math.abs(cc) + Math.abs(er2) + Math.abs(ec2);
            if (score > bestScore) {
              bestScore = score;
              best = { word: word, r: rr, c: cc, dr: dr, dc: dc };
            }
          }
        }
      });
      if (best) {
        for (var bi = 0; bi < best.word.length; bi++) {
          set(best.r + best.dr * bi, best.c + best.dc * bi, best.word[bi], wid);
        }
        placed.push({ word: best.word, r: best.r, c: best.c, dr: best.dr, dc: best.dc, id: wid });
      }
      // если не удалось пристыковать — не ставим в кроссворд, просто не найдём
    });

    // вычисляем границы
    var minR = 0, maxR = 0, minC = 0, maxC = 0;
    Object.keys(grid).forEach(function (k) {
      var p = k.split(',');
      var r = +p[0], c = +p[1];
      if (r < minR) minR = r; if (r > maxR) maxR = r;
      if (c < minC) minC = c; if (c > maxC) maxC = c;
    });
    var h = maxR - minR + 1;
    var w = maxC - minC + 1;

    // строим 2D
    var cells = [];
    var cellMap = {};
    for (var r2 = 0; r2 < h; r2++) {
      cells[r2] = [];
      for (var c2 = 0; c2 < w; c2++) {
        var gr = minR + r2;
        var gc = minC + c2;
        var g = get(gr, gc);
        if (g) {
          cells[r2][c2] = { letter: g.ch, empty: false, r: gr, c: gc };
          cellMap[gr + ',' + gc] = { r2: r2, c2: c2 };
        } else {
          cells[r2][c2] = { empty: true };
        }
      }
    }

    return {
      cells: cells,
      width: w,
      height: h,
      placed: placed,
      grid: grid,
      cellMap: cellMap
    };
  }

  App.registerGame({
    id: 'words',
    title: 'Слова по кругу',
    icon: '🧩',
    desc: 'Соедини буквы в слова',
    init: function (root, api) {
      var cfg = (window.CONFIG && CONFIG.wordWheel) || DEFAULT;
      var lettersStr = (cfg.letters || DEFAULT.letters).toUpperCase();
      var letterList = lettersStr.split('').filter(function (x) { return x.trim(); });

      var targetAll = (cfg.words || DEFAULT.words).map(function (w) { return norm(w); });
      var layout = buildLayout(targetAll);
      var targetSet = {};
      var targetList = layout.placed.map(function (p) { return p.word; });
      targetList.forEach(function (w) { targetSet[w] = true; });

      var found = {}, foundCount = 0;
      var sel = [], selEls = [];
      var pressed = false, moved = false;
      var foundEls = {}; // word -> true

      var timer = App.createTimer(function (s) {
        api.setSub('Найдено: ' + foundCount + ' / ' + targetList.length + ' · ' + App.fmtTime(s));
      });
      timer.start();

      root.innerHTML =
        '<div class="game-card">' +
          '<p class="game-hint">Соединяй буквы по кругу — собери слова из ' + letterList.length + ' букв. Найденные слова сами встают в клетки кроссворда.</p>' +
          '<div class="game-status">' +
            '<div class="stat"><b id="ww-f">0</b><span>найдено</span></div>' +
            '<div class="stat"><b id="ww-t">' + targetList.length + '</b><span>всего</span></div>' +
            '<div class="stat"><b id="ww-cur">—</b><span>слово</span></div>' +
          '</div>' +
          '<div class="ww-grid" id="ww-grid"></div>' +
          '<div class="ww-wheel-wrap">' +
            '<div class="ww-wheel" id="ww-wheel" style="--ww-size:260px">' +
              '<svg class="ww-lines" viewBox="0 0 100 100" preserveAspectRatio="none" id="ww-lines"></svg>' +
              '<div class="ww-center">●</div>' +
            '</div>' +
          '</div>' +
          '<div class="msg hidden" id="ww-msg"></div>' +
          '<div class="toolbar">' +
            '<button class="btn btn-sm btn-ghost" id="ww-clear" type="button">Сбросить</button>' +
            '<button class="btn btn-sm btn-ghost" id="ww-restart" type="button">Перемешать</button>' +
          '</div>' +
        '</div>';

      var gridEl = root.querySelector('#ww-grid');
      var wheelEl = root.querySelector('#ww-wheel');
      var linesEl = root.querySelector('#ww-lines');
      var elF = root.querySelector('#ww-f');
      var elT = root.querySelector('#ww-t');
      var elCur = root.querySelector('#ww-cur');
      var msgEl = root.querySelector('#ww-msg');
      var btnClear = root.querySelector('#ww-clear');
      var btnRestart = root.querySelector('#ww-restart');

      elT.textContent = String(targetList.length);

      // сетка
      gridEl.style.setProperty('--ww-w', String(layout.width));
      gridEl.style.setProperty('--ww-cell', 'clamp(28px, 9.5vw, 38px)');
      gridEl.style.gridTemplateColumns = 'repeat(' + layout.width + ', var(--ww-cell))';
      var gridCells = {};
      for (var gr = 0; gr < layout.height; gr++) {
        for (var gc = 0; gc < layout.width; gc++) {
          var cell = layout.cells[gr][gc];
          var el = App.el('div', 'ww-cell' + (cell.empty ? ' empty' : ''));
          if (!cell.empty) {
            el.setAttribute('data-letter', cell.letter);
            gridCells[cell.r + ',' + cell.c] = el;
          }
          gridEl.appendChild(el);
        }
      }

      // колесо
      var n = letterList.length;
      var letterEls = [];
      function posFor(i) {
        var a = (-90 + i * 360 / n) * Math.PI / 180;
        var R = 34;
        return { x: 50 + Math.cos(a) * R, y: 50 + Math.sin(a) * R };
      }
      letterList.forEach(function (ch, i) {
        var p = posFor(i);
        var el = App.el('div', 'ww-letter');
        el.setAttribute('data-i', String(i));
        el.setAttribute('data-l', ch);
        el.textContent = ch;
        el.style.left = p.x + '%';
        el.style.top = p.y + '%';
        wheelEl.appendChild(el);
        letterEls.push(el);
      });

      function drawLines() {
        linesEl.innerHTML = '';
        if (sel.length < 2) return;
        for (var s = 0; s < sel.length - 1; s++) {
          var p1 = posFor(sel[s]), p2 = posFor(sel[s + 1]);
          var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', p1.x); line.setAttribute('y1', p1.y);
          line.setAttribute('x2', p2.x); line.setAttribute('y2', p2.y);
          line.setAttribute('class', 'ww-line');
          linesEl.appendChild(line);
        }
      }

      function updateSel() {
        letterEls.forEach(function (el, i) {
          el.classList.toggle('sel', sel.indexOf(i) >= 0);
          el.classList.toggle('last', sel.length && sel[sel.length - 1] === i);
        });
        drawLines();
        var cur = sel.map(function (i) { return letterList[i]; }).join('');
        elCur.textContent = sel.length ? cur : '—';
      }

      function selWord() {
        return sel.map(function (i) { return letterList[i]; }).join('').toLowerCase().replace(/ё/g, 'е');
      }

      function canStartWith(prefix) {
        if (!prefix.length) return true;
        for (var w = 0; w < targetList.length; w++) {
          if (found[targetList[w]]) continue;
          if (targetList[w].indexOf(prefix) === 0) return true;
        }
        return false;
      }

      function check() {
        if (sel.length < 2) return;
        var word = selWord();
        if (targetSet[word] && !found[word]) {
          found[word] = true;
          foundCount++;
          elF.textContent = String(foundCount);
          SFX.play('match');
          // заполняем клетки
          for (var i = 0; i < layout.placed.length; i++) {
            var p = layout.placed[i];
            if (p.word === word) {
              for (var bi = 0; bi < p.word.length; bi++) {
                var grk = p.r + p.dr * bi, gck = p.c + p.dc * bi;
                var gel = gridCells[grk + ',' + gck];
                if (gel) {
                  gel.textContent = p.word[bi].toUpperCase();
                  gel.classList.add('found');
                }
              }
              break;
            }
          }
          clearSel();
          if (foundCount === targetList.length && !root._won) {
            root._won = true;
            timer.stop();
            SFX.play('win');
            setTimeout(function () {
              api.onWin({ text: 'все слова найдены за ' + App.fmtTime(timer.seconds()), score: 80 });
            }, 600);
          }
          return;
        }
        if (targetSet[word] && found[word]) {
          showMsg('Уже найдено', 'warn');
          clearSel();
          return;
        }
        if (!canStartWith(word)) {
          // неверное — трясём и сбрасываем
          letterEls.forEach(function (el) { el.classList.add('bad'); });
          setTimeout(function () { letterEls.forEach(function (el) { el.classList.remove('bad'); }); }, 420);
          setTimeout(clearSel, 200);
          return;
        }
      }

      function clearSel() {
        sel = [];
        selEls = [];
        pressed = false;
        moved = false;
        updateSel();
      }

      function showMsg(text, kind) {
        if (!msgEl) return;
        msgEl.textContent = text;
        msgEl.className = 'msg' + (kind ? ' ' + kind : '');
        msgEl.classList.remove('hidden');
        clearTimeout(msgEl._t);
        msgEl._t = setTimeout(function () { msgEl.classList.add('hidden'); }, 1400);
      }

      // обработка кликов/жеста
      function addLetter(i) {
        if (sel.indexOf(i) >= 0) return false;
        sel.push(i);
        updateSel();
        var w = selWord();
        if (targetSet[w] && !found[w]) { check(); return true; }
        return true;
      }

      wheelEl.addEventListener('pointerdown', function (e) {
        if (root._won) return;
        var el = e.target.closest('.ww-letter');
        if (!el) return;
        e.preventDefault();
        var i = +el.getAttribute('data-i');
        pressed = true;
        moved = false;
        try { wheelEl.setPointerCapture(e.pointerId); } catch (ex) {}

        if (sel.length) {
          // продолжаем слово нажатиями
          if (sel.indexOf(i) >= 0) {
            if (sel[sel.length - 1] === i) check(); // повтор по последней букве — проверить
            return;
          }
          addLetter(i);
          return;
        }
        // начинаем новое слово
        sel = [i];
        updateSel();
      });

      wheelEl.addEventListener('pointermove', function (e) {
        if (!pressed || root._won) return;
        var pt = document.elementFromPoint(e.clientX, e.clientY);
        if (!pt) return;
        var el = pt.closest ? pt.closest('.ww-letter') : null;
        if (!el) return;
        var i = +el.getAttribute('data-i');
        if (sel.indexOf(i) >= 0) return;
        moved = true;
        addLetter(i);
      });

      var finishGesture = function () {
        if (!pressed) return;
        pressed = false;
        if (root._won) { clearSel(); return; }
        check();
      };

      wheelEl.addEventListener('pointerup', function (e) {
        try { wheelEl.releasePointerCapture(e.pointerId); } catch (ex) {}
        finishGesture();
      });
      wheelEl.addEventListener('pointercancel', finishGesture);
      window.addEventListener('blur', finishGesture);

      btnClear.addEventListener('click', function () { clearSel(); });
      btnRestart.addEventListener('click', function () {
        // перемешиваем буквы
        for (var i = letterList.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var t = letterList[i]; letterList[i] = letterList[j]; letterList[j] = t;
        }
        letterEls.forEach(function (el, idx) {
          el.setAttribute('data-i', String(idx));
          el.setAttribute('data-l', letterList[idx]);
          el.textContent = letterList[idx];
          var p = posFor(idx);
          el.style.left = p.x + '%';
          el.style.top = p.y + '%';
        });
        clearSel();
        showMsg('Буквы перемешаны', 'ok');
      });

      // адаптивность колеса
      function resizeWheel() {
        var wrap = wheelEl.parentNode;
        var s = Math.min(wrap.clientWidth - 20, 280);
        wheelEl.style.setProperty('--ww-size', s + 'px');
      }
      resizeWheel();
      window.addEventListener('resize', resizeWheel);

      return {
        destroy: function () {
          timer.stop();
          window.removeEventListener('resize', resizeWheel);
          window.removeEventListener('blur', finishGesture);
        }
      };
    }
  });
})();
