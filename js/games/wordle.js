/* ==========================================================================
   МИНИ-ИГРА «ПЯТЬ БУКВ» (аналог Wordle, русская раскладка)
   ========================================================================== */
(function () {
  'use strict';

  var LETTERS = 'абвгдежзийклмнопрстуфхцчшщъыьэюя';

  var KB_ROWS = [
    ['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х'],
    ['ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'э'],
    ['я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю']
  ];

  // раскладка US -> ЙЦУКЕН
  var PHYS = {
    'q':'й','w':'ц','e':'у','r':'к','t':'е','y':'н','u':'г','i':'ш','o':'щ','p':'з','[':'х',
    'a':'ф','s':'ы','d':'в','f':'а','g':'п','h':'р','j':'о','k':'л','l':'д',';':'ж',"'":'э',
    'z':'я','x':'ч','c':'с','v':'м','b':'и','n':'т','m':'ь',',':'б','.':'ю'
  };

  function norm(w) {
    return String(w || '').toLowerCase().replace(/ё/g, 'е').replace(/[^а-я]/g, '');
  }

  App.registerGame({
    id: 'wordle',
    title: 'Пять букв',
    icon: '🔤',
    desc: 'Угадай слово из пяти букв',
    init: function (root, api) {

      var cfg = window.CONFIG || {};

      /* Берём только настоящие пятибуквенные слова — так словарь не сломается,
         даже если в config.js попадётся слово другой длины. */
      function fiveLetters(list) {
        return (list || []).filter(function (w) {
          var n = norm(typeof w === 'string' ? w : (w && w.w));
          return n.length === 5;
        });
      }
      function withHints(list) {
        return (list || []).filter(function (a) { return a && norm(a.w).length === 5; });
      }

      var answers = withHints(cfg.answers);
      if (!answers.length) answers = [{ w: 'яблоко', h: 'фрукт' }];
      var extra = fiveLetters(cfg.extraWords);

      var allowed = {};
      answers.forEach(function (a) { allowed[norm(a.w)] = true; });
      extra.forEach(function (w) { allowed[norm(w)] = true; });

      var chosen = App.pick(answers);
      var answer = norm(chosen.w);
      var answerHint = chosen.h || '';

      var MAX = 6;
      var row = 0, col = 0, busy = false, finished = false;
      var guess = '';
      var keyState = {};      // буква -> 'correct' | 'present' | 'absent'
      var usedHint = false;
      var timer = App.createTimer(function (s) { api.setSub('Ход ' + (row + 1) + ' из ' + MAX + ' · ' + App.fmtTime(s)); });
      timer.start();

      /* ── разметка ── */
      root.innerHTML =
        '<div class="game-card">' +
          '<p class="game-hint">Отгадай слово из <b>5 букв</b>. Зелёная буква — на своём месте, жёлтая — есть, но в другом месте, серая — её нет в слове.<br>' +
            'Клавиша <b>⌫</b> (или «Удалить букву») стирает последнюю букву, «ввод» — проверяет слово.</p>' +
          '<div class="wl-board" id="wl-board"></div>' +
          '<div class="msg hidden" id="wl-msg"></div>' +
          '<div class="wl-keyboard" id="wl-kb"></div>' +
          '<div class="wl-hint-box hidden" id="wl-hint"></div>' +
          '<div class="toolbar">' +
            '<button class="btn btn-sm btn-ghost wl-del-btn" id="wl-del-btn" type="button">⌫ Удалить букву</button>' +
            '<button class="btn btn-sm btn-ghost" id="wl-hint-btn" type="button">Подсказка</button>' +
            '<button class="btn btn-sm btn-ghost" id="wl-reveal-btn" type="button">Показать ответ</button>' +
          '</div>' +
        '</div>';

      var board = root.querySelector('#wl-board');
      var msg = root.querySelector('#wl-msg');
      var kb = root.querySelector('#wl-kb');
      var hintBox = root.querySelector('#wl-hint');

      var cells = [];
      for (var r = 0; r < MAX; r++) {
        var rowEl = App.el('div', 'wl-row');
        var rowCells = [];
        for (var c = 0; c < 5; c++) {
          var cell = App.el('div', 'wl-cell');
          rowEl.appendChild(cell);
          rowCells.push(cell);
        }
        board.appendChild(rowEl);
        cells.push(rowCells);
      }

      var keyEls = {};
      KB_ROWS.forEach(function (letters, ri) {
        var krow = App.el('div', 'wl-krow');
        if (ri === 1) {
          krow.appendChild(makeSpecial('⌫', 'del', 'wl-key wide wl-del'));
        }
        letters.forEach(function (ch) {
          var k = App.el('button', 'wl-key', ch);
          k.type = 'button';
          k.setAttribute('aria-label', ch);
          k.addEventListener('click', function () { typeChar(ch); });
          keyEls[ch] = k;
          krow.appendChild(k);
        });
        if (ri === 2) {
          krow.appendChild(makeSpecial('ввод', 'enter', 'wl-key wide wl-enter'));
        }
        kb.appendChild(krow);
      });

      function makeSpecial(label, action, cls) {
        var b = App.el('button', cls, label);
        b.type = 'button';
        if (action === 'del') {
          b.setAttribute('aria-label', 'Backspace — удалить последнюю букву');
          b.title = 'Backspace — удалить последнюю букву';
        } else {
          b.setAttribute('aria-label', 'Ввод — проверить слово');
          b.title = 'Ввод — проверить слово';
        }
        b.addEventListener('click', function () {
          if (action === 'del') backspace();
          else submit();
        });
        return b;
      }

      function showMsg(text, kind) {
        msg.textContent = text;
        msg.className = 'msg' + (kind ? ' ' + kind : '');
        msg.classList.remove('hidden');
      }
      function hideMsg() { msg.classList.add('hidden'); }

      function typeChar(ch) {
        if (busy || finished || col >= 5) return;
        guess += ch;
        cells[row][col].textContent = ch;
        cells[row][col].classList.add('filled');
        col++;
        SFX.play('tap');
      }

      function backspace() {
        if (busy || finished || col === 0) return;
        col--;
        guess = guess.slice(0, col);
        cells[row][col].textContent = '';
        cells[row][col].classList.remove('filled');
        SFX.play('tap');
      }

      function score(w, a) {
        var res = new Array(5).fill('absent');
        var left = {};
        for (var i = 0; i < 5; i++) left[a[i]] = (left[a[i]] || 0) + 1;
        for (var j = 0; j < 5; j++) if (w[j] === a[j]) { res[j] = 'correct'; left[w[j]]--; }
        for (var k = 0; k < 5; k++) if (res[k] === 'absent' && left[w[k]] > 0) { res[k] = 'present'; left[w[k]]--; }
        return res;
      }

      function updateKey(ch, st) {
        var order = { absent: 1, present: 2, correct: 3 };
        var cur = keyState[ch];
        if (cur && order[cur] >= order[st]) return;
        keyState[ch] = st;
        var e = keyEls[ch];
        if (!e) return;
        e.classList.remove('correct', 'present', 'absent');
        e.classList.add(st);
      }

      function submit() {
        if (busy || finished) return;
        if (col < 5) { showMsg('Нужно 5 букв', 'warn'); return; }
        var w = guess;
        if (!allowed[w]) {
          showMsg('Такого слова нет в словаре — попробуй другое', 'bad');
          var rowEl = cells[row][0].parentNode;
          rowEl.classList.add('shake');
          setTimeout(function () { rowEl.classList.remove('shake'); }, 420);
          SFX.play('error');
          return;
        }
        hideMsg();
        busy = true;
        var res = score(w, answer);
        var win = (w === answer);

        res.forEach(function (st, i) {
          setTimeout(function () {
            var cell = cells[row][i];
            cell.classList.remove('filled');
            cell.classList.add(st);
            if (st !== 'absent') updateKey(w[i], st);
            SFX.play('tick');
            if (i === 4) setTimeout(function () { finishRow(w, res, win); }, 380);
          }, i * 150);
        });
      }

      function finishRow(w, res, win) {
        busy = false;
        if (win) {
          cells[row].forEach(function (c) { c.classList.add('win'); });
          timer.stop();
          finished = true;
          SFX.play('great');
          setTimeout(function () {
            var tries = row + 1;
            var sc = Math.max(10, 100 - (tries - 1) * 15 - (usedHint ? 25 : 0));
            api.onWin({
              text: 'угадано с ' + tries + '-го раза',
              score: sc,
              time: timer.seconds()
            });
          }, 700);
          return;
        }
        row++; col = 0; guess = '';
        if (row >= MAX) {
          timer.stop();
          finished = true;
          SFX.play('lose');
          setTimeout(function () {
            api.onWin({
              text: 'ответ: ' + answer,
              score: 10,
              time: timer.seconds()
            });
          }, 500);
          return;
        }
        api.setSub('Ход ' + (row + 1) + ' из ' + MAX);
      }

      /* ── физическая клавиатура ── */
      function onKey(e) {
        if (App._screen !== 'screen-game') return;
        if (App.isModalOpen()) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        var k = e.key;
        if (k === 'Enter') { e.preventDefault(); submit(); return; }
        if (k === 'Backspace') { e.preventDefault(); backspace(); return; }
        if (k && k.length === 1) {
          var low = k.toLowerCase();
          var ch = LETTERS.indexOf(low) >= 0 ? low : PHYS[low];
          if (ch) { e.preventDefault(); typeChar(ch); }
        }
      }
      document.addEventListener('keydown', onKey);

      /* ── кнопки помощи ── */
      root.querySelector('#wl-del-btn').addEventListener('click', function () {
        backspace();
      });

      root.querySelector('#wl-hint-btn').addEventListener('click', function () {
        usedHint = true;
        hintBox.textContent = '💡 Подсказка: ' + (answerHint || 'подумай о юбиляре');
        hintBox.classList.remove('hidden');
        SFX.play('click');
      });

      root.querySelector('#wl-reveal-btn').addEventListener('click', function () {
        if (finished) return;
        finished = true;
        timer.stop();
        showMsg('Ответ: ' + answer, 'warn');
        SFX.play('lose');
        setTimeout(function () {
          api.onWin({ text: 'ответ: ' + answer, score: 10, time: timer.seconds() });
        }, 600);
      });

      api.setSub('Ход 1 из ' + MAX);

      return {
        destroy: function () {
          document.removeEventListener('keydown', onKey);
          timer.stop();
        }
      };
    }
  });
})();
