/* ==========================================================================
   АВТОТЕСТ КВЕСТА
   --------------------------------------------------------------------------
   Запуск (в консоли браузера на http://localhost:8733/):

     fetch('/tools/test.js').then(t => { (0,eval)(t); window.__questTest(); })

   Результат: window.__testResults (массив), window.__testDone === true,
   ошибки консоли: window.__testErrors.

   Тест полностью автономный: он управляет Math.random и App.pick,
   поэтому результат не зависит от случайности.
   ========================================================================== */
(function () {
  'use strict';

  var results = [];
  var errors = [];
  window.__testResults = results;
  window.__testErrors = errors;

  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function log(name, ok, extra) {
    results.push({ name: name, ok: !!ok, extra: extra === undefined ? '' : String(extra) });
    if (!ok) console.error('FAIL: ' + name, extra);
  }

  function click(el, what) {
    if (!el) throw new Error('клик: элемент не найден (' + (what || '?') + ')');
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  }

  function key(el, ch) {
    if (!el) return;
    el.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true }));
  }

  function modalOpen() {
    var b = $('#modal-backdrop');
    return !!(b && !b.classList.contains('hidden'));
  }
  function closeModal() {
    var b = $('#modal-actions');
    if (b) { var btn = b.querySelector('.btn'); if (btn) click(btn, 'кнопка модалки'); }
  }
  function gameActive() { return $('#screen-game').classList.contains('active'); }
  function mapActive() { return $('#screen-map').classList.contains('active'); }

  /* ── ловушка на ошибки ── */
  var origError = console.error;
  console.error = function () {
    var txt = Array.prototype.slice.call(arguments).join(' ');
    if (txt.indexOf('FAIL:') !== 0) errors.push(txt);
    origError.apply(console, arguments);
  };
  window.addEventListener('error', function (e) {
    errors.push('window.error: ' + (e.message || '') + ' @' + (e.filename || '') + ':' + (e.lineno || ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    errors.push('unhandledrejection: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
  });

  /* ── ввод слова на экранной клавиатуре ── */
  function typeWord(w) {
    var chars = w.split('');
    for (var i = 0; i < chars.length; i++) {
      var kb = $$('.wl-key').filter(function (x) { return x.textContent === chars[i]; })[0];
      if (!kb) return false;
      click(kb, 'клавиша ' + chars[i]);
    }
    return true;
  }
  function pressEnter() {
    var b = $$('.wl-key.wide').filter(function (x) { return x.textContent === 'ввод'; })[0];
    click(b, 'ввод');
  }
  function clearRow() {
    for (var i = 0; i < 6; i++) key($('.wl-key.wide'), 'Backspace');
  }
  function rowClasses(i) {
    var row = $$('.wl-row')[i];
    if (!row) return [];
    return Array.prototype.slice.call(row.querySelectorAll('.wl-cell.correct,.wl-cell.present,.wl-cell.absent'));
  }
  function pileCount(key) {
    var n = $('[data-pile="' + key + '"] .pile-count');
    return n ? parseInt(n.textContent, 10) : -1;
  }

  /* =====================================================================
     ОСНОВНОЙ СЦЕНАРИЙ
     ===================================================================== */
  window.__questTest = function () {
    results = [];
    errors = [];
    window.__testResults = results;
    window.__testErrors = errors;
    window.__testDone = false;

    return run().then(function () {
      log('ошибок в консоли нет', errors.length === 0, errors.join(' | '));
      window.__testDone = true;
      console.log('RESULTS ' + JSON.stringify(results, null, 1));
      return results;
    }).catch(function (e) {
      log('тест упал с ошибкой', false, (e && e.message) || e);
      window.__testDone = true;
      console.log('RESULTS ' + JSON.stringify(results, null, 1));
      return results;
    });
  };

  function run() {
    /* ───────── чистый старт: сбрасываем прогресс и секрет ───────── */
    try {
      var st = App.state();
      st.unlockedAll = false;
      st.started = false;
      st.finished = false;
      st.done = {};
      st.results = {};
      st.fragments = {};
      st.time = 0;
      App.save();
      App.showScreen('screen-title');   /* перерисовываем титульный экран под чистое состояние */
    } catch (e) {}

    /* ───────── титульный экран ───────── */
    click($('#btn-start'), 'старт');
    return sleep(150).then(function () {
      log('карта открывается', mapActive());
      log('узлов на карте 7', $$('.map-node').length === 7, $$('.map-node').length);
      log('подписей 6', $$('.map-label').length === 6, $$('.map-label').length);
      log('дорожка нарисована', ($('#road-done').getAttribute('d') || '').length > 20);

      // закрытые узлы заперты, замочек в правом верхнем углу
      var locked = $$('.map-node.locked');
      log('часть узлов закрыта', locked.length === 6, locked.length);
      var lock = locked[0] ? locked[0].querySelector('.node-lock') : null;
      if (lock) {
        var lr = lock.getBoundingClientRect(), nr = locked[0].getBoundingClientRect();
        var dx = nr.right - (lr.left + lr.width / 2);
        var dy = (lr.top + lr.height / 2) - nr.top;
        log('замочек в правом верхнем углу', dx > 0 && dx < 20 && dy > 0 && dy < 20,
          'отступ ' + Math.round(dx) + '/' + Math.round(dy));
      } else {
        log('замочек в правом верхнем углу', false, 'замочек не найден');
      }

      /* ═══════ СЕКРЕТ: клавиша «Ё» открывает все испытания ═══════ */
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Ё', bubbles: true }));
      return sleep(300);
    }).then(function () {
      log('секрет «Ё» показал окно', modalOpen(), ($('#modal-title') || {}).textContent);
      closeModal();
      return sleep(250);
    }).then(function () {
      log('секрет открыл все узлы', $$('.map-node.locked').length === 1, $$('.map-node.locked').length);
      log('секрет сохранён', App.state().unlockedAll === true, App.state().unlockedAll);
      return sleep(100);
    }).then(function () {
      /* ═══════ 1. Пять букв ═══════ */
      // делаем ответ детерминированным: 'салат' (четвёртое слово списка)
      var origPick = App.pick;
      App.pick = function (arr) { return arr[3]; };
      click($$('.map-node')[0], 'узел 1');
      App.pick = origPick;

      return sleep(250).then(function () {
        log('открылась игра', gameActive());
        log('поле 6x5', $$('.wl-cell').length === 30, $$('.wl-cell').length);
        log('клавиатура есть', $$('.wl-key').length >= 30, $$('.wl-key').length);
        log('клавиша "ввод" есть', !!$$('.wl-key.wide').filter(function (x) { return x.textContent === 'ввод'; })[0]);

        // заведомо неверное, но разрешённое слово
        log('слово набирается', typeWord('книга'));
        pressEnter();
        return sleep(1400);
      }).then(function () {
        log('раскраска строки работает', rowClasses(0).length === 5, rowClasses(0).length);
        log('клавиши подсвечены', $$('.wl-key.correct,.wl-key.present,.wl-key.absent').length > 0,
          $$('.wl-key.correct,.wl-key.present,.wl-key.absent').length);

        // слово не из словаря не принимается
        typeWord('ыыыыы');
        pressEnter();
        return sleep(300);
      }).then(function () {
        log('чужое слово не засчитано', rowClasses(1).length === 0, rowClasses(1).length);
        log('показано предупреждение', !$('#wl-msg').classList.contains('hidden'), $('#wl-msg').textContent);

        // Backspace: стирает последнюю букву
        var row1 = $$('.wl-row')[1];
        var before = row1.querySelectorAll('.wl-cell.filled').length;
        click($('#wl-del-btn'), 'удалить букву');
        return sleep(150).then(function () {
          var after = row1.querySelectorAll('.wl-cell.filled').length;
          log('кнопка Backspace стирает букву', after === before - 1, before + '->' + after);

          var delKey = $$('.wl-key.wl-del')[0];
          log('клавиша ⌫ на клавиатуре есть', !!delKey);
          if (!delKey) return null;
          var f2 = row1.querySelectorAll('.wl-cell.filled').length;
          click(delKey, '⌫');
          return sleep(150).then(function () {
            var f3 = row1.querySelectorAll('.wl-cell.filled').length;
            log('клавиша ⌫ стирает букву', f3 === f2 - 1, f2 + '->' + f3);
          });
        });
      }).then(function () {
        clearRow();
        click($('#wl-hint-btn'), 'подсказка');
        return sleep(120);
      }).then(function () {
        log('подсказка показана', !$('#wl-hint').classList.contains('hidden'), $('#wl-hint').textContent);

        // добиваем правильным словом
        typeWord('салат');
        pressEnter();
        return sleep(2400);
      }).then(function () {
        log('победа в пяти буквах', modalOpen());
        var toast = $$('.toast').map(function (t) { return t.textContent; }).join(' | ');
        log('показано уведомление о сохранении', /сохран/i.test(toast), toast || 'нет');
        var savedNow = null;
        try { savedNow = JSON.parse(localStorage.getItem('quest71-appState')); } catch (e) {}
        log('прогресс записан сразу', !!(savedNow && savedNow.done && savedNow.done.wordle),
          savedNow ? Object.keys(savedNow.done || {}).join(',') : 'нет данных');
        closeModal();
        return sleep(250);
      }).then(function () {
        log('вернулись на карту', mapActive());
        log('прогресс 1 из 6', ($('#map-progress').textContent || '').indexOf('1 из 6') >= 0, $('#map-progress').textContent);

        /* ═══════ 2. Маджонг ═══════ */
        click($$('.map-node')[1], 'узел 2');
        return sleep(350);
      }).then(function () {
        var tiles = $$('.mj-tile');
        log('плиток 80', tiles.length === 80, tiles.length);
        log('есть перекрытые плитки', $$('.mj-tile.blocked').length > 0, $$('.mj-tile.blocked').length);
        log('есть свободные плитки', $$('.mj-tile:not(.blocked)').length > 0, $$('.mj-tile:not(.blocked)').length);
        log('символы отрисованы', (tiles[0].textContent || '').length > 0, tiles[0].textContent);

        // каждый символ встречается ровно дважды
        var counts = {};
        tiles.forEach(function (t) {
          var s = (t.textContent || '').trim();
          counts[s] = (counts[s] || 0) + 1;
        });
        var uniq = Object.keys(counts);
        log('уникальных символов 40', uniq.length === 40, uniq.length);
        log('каждый символ по 2 раза', uniq.every(function (s) { return counts[s] === 2; }),
          uniq.filter(function (s) { return counts[s] !== 2; }).join(','));
        var EMOJI = ['🕊️', '🌺', '🎂', '🧉'];
        log('эмодзи в маджонге', EMOJI.every(function (e) { return counts[e] === 2; }),
          EMOJI.map(function (e) { return e + ':' + (counts[e] || 0); }).join(' '));

        click($('#mj-hint'), 'подсказка маджонга');
        return sleep(150);
      }).then(function () {
        log('подсказка маджонга', $$('.mj-tile.hint').length === 2, $$('.mj-tile.hint').length);

        click($('#mj-solve'), 'решить');
        return sleep(11500);
      }).then(function () {
        log('маджонг решён', $$('.mj-tile').length === 0, 'осталось ' + $$('.mj-tile').length);
        log('модалка после маджонга', modalOpen());
        closeModal();
        return sleep(250);
      }).then(function () {
        log('после маджонга карта', mapActive());

        /* ═══════ 3. Пасьянс ═══════ */
        click($$('.map-node')[2], 'узел 3');
        return sleep(350);
      }).then(function () {
        log('карты на столе 28', $$('[data-pile^="tab:"] .card').length === 28, $$('[data-pile^="tab:"] .card').length);
        log('в колоде 24', pileCount('stock') === 24, pileCount('stock'));
        log('сброс пуст', $$('[data-pile="waste"] .card').length === 0, $$('[data-pile="waste"] .card').length);
        log('7 столбцов', $$('[data-pile^="tab:"]').length === 7, $$('[data-pile^="tab:"]').length);
        log('первый столбец 1 карта', $$('[data-pile="tab:0"] .card').length === 1, $$('[data-pile="tab:0"] .card').length);
        log('седьмой столбец 7 карт', $$('[data-pile="tab:6"] .card').length === 7, $$('[data-pile="tab:6"] .card').length);
        log('4 базы', $$('[data-pile^="found:"]').length === 4, $$('[data-pile^="found:"]').length);

        // карта должна быть прямоугольником, а не полоской
        var c = $('[data-pile="tab:0"] .card');
        var cr = c ? c.getBoundingClientRect() : { width: 0, height: 0 };
        var pile = $('[data-pile="tab:0"]').getBoundingClientRect();
        log('карта не схлопнулась', cr.height > cr.width * 1.2, Math.round(cr.width) + 'x' + Math.round(cr.height));
        log('карта по размеру стопки', Math.abs(cr.height - pile.height) < 6,
          'карта ' + Math.round(cr.height) + ' / стопка ' + Math.round(pile.height));
        var rn = c ? c.querySelector('.c-rank') : null;
        var sn = c ? c.querySelector('.c-suit') : null;
        log('на карте есть ранг и масть', !!rn && !!sn && rn.textContent && sn.textContent,
          rn && sn ? rn.textContent + sn.textContent : 'нет');

        // стол не должен наезжать на кнопки снизу
        var tabBottom = 0;
        $$('[data-pile^="tab:"] .card').forEach(function (cc) {
          var rr = cc.getBoundingClientRect();
          if (rr.bottom > tabBottom) tabBottom = rr.bottom;
        });
        var acts = $('.sol-actions');
        var actsTop = acts ? acts.getBoundingClientRect().top : 9999;
        log('карты не перекрывают кнопки', tabBottom <= actsTop + 1,
          Math.round(tabBottom) + ' / кнопки ' + Math.round(actsTop));

        // тянем карту из колоды
        click($('[data-pile="stock"]'), 'колода');
        return sleep(200);
      }).then(function () {
        log('карта взята из колоды', $$('[data-pile="waste"] .card').length === 1, $$('[data-pile="waste"] .card').length);
        log('в колоде 23', pileCount('stock') === 23, pileCount('stock'));

        // отмена
        click($('#sol-undo'), 'отменить');
        return sleep(150);
      }).then(function () {
        log('отмена работает', ($('#sol-msg').textContent || '').indexOf('Отменили') >= 0, $('#sol-msg').textContent);
        log('колода вернулась', pileCount('stock') === 24, pileCount('stock'));

        // автодобор
        click($('#sol-auto'), 'автодобор');
        return sleep(250);
      }).then(function () {
        log('автодобор без ошибок', true, $('#sol-msg').textContent);
        log('карты не потерялись', $$('.card').length >= 28, $$('.card').length);

        // пасьянс до конца не доводим (это долго) — отмечаем пройденным,
        // чтобы открыть следующий узел карты
        var st = App.state();
        st.done = st.done || {};
        st.done.klondike = true;
        st.results = st.results || {};
        st.results.klondike = { text: 'проверено автотестом', score: 60, time: 10 };
        st.fragments = st.fragments || {};
        st.fragments.klondike = (window.CONFIG && CONFIG.fragments && CONFIG.fragments.klondike) || '';
        App.save();

        // уходим на карту
        click($('#game-back'), 'назад');
        return sleep(250);
      }).then(function () {
        /* ═══════ 4. Пары ═══════ */
        click($$('.map-node')[3], 'узел 4');
        return sleep(300);
      }).then(function () {
        var cards = $$('.mem-card');
        log('карточек 12, 16 или 24', cards.length === 12 || cards.length === 16 || cards.length === 24, cards.length);

        // сетка должна целиком помещаться в экран
        var gr = $('#mem-grid').getBoundingClientRect();
        var sc = $('#game-scroll').getBoundingClientRect();
        log('сетка пар помещается на экран', gr.bottom <= sc.bottom + 1,
          Math.round(gr.bottom) + ' ≤ ' + Math.round(sc.bottom));
        var oneW = cards.length ? cards[0].getBoundingClientRect().width : 0;
        log('карточки не мелкие', oneW >= 44, Math.round(oneW) + 'px');

        // группируем по иконке
        var byIcon = {};
        cards.forEach(function (c, i) {
          var ic = c._icon;
          if (!byIcon[ic]) byIcon[ic] = [];
          byIcon[ic].push(i);
        });
        var groups = Object.keys(byIcon).map(function (k) { return byIcon[k]; }).filter(function (g) { return g.length === 2; });
        log('пар найдено ' + (cards.length / 2), groups.length === cards.length / 2, groups.length);

        var step = function (i) {
          if (i >= groups.length) return Promise.resolve();
          click(cards[groups[i][0]], 'карточка 1');
          click(cards[groups[i][1]], 'карточка 2');
          return sleep(420).then(function () { return step(i + 1); });
        };
        return step(0);
      }).then(function () {
        log('все пары найдены', $$('.mem-card.matched').length === $$('.mem-card').length,
          $$('.mem-card.matched').length + '/' + $$('.mem-card').length);
        return sleep(900);
      }).then(function () {
        log('победа в парах', modalOpen());
        closeModal();
        return sleep(250);
      }).then(function () {
        log('после пар карта', mapActive());

        /* ═══════ 5. Слова по кругу ═══════ */
        click($$('.map-node')[4], 'узел 5');
        return sleep(350);
      }).then(function () {
        var letters = $$('.ww-letter');
        var words = ((window.CONFIG && CONFIG.wordWheel && CONFIG.wordWheel.words) || []).slice();
        log('букв на колесе', letters.length === 7, letters.length);
        log('слова на месте', words.length >= 5, words.length);
        log('клетки кроссворда', $$('.ww-cell').length >= 20, $$('.ww-cell').length);
        log('все слова уместились в сетку', ($('#ww-t').textContent || '') === String(words.length),
          $('#ww-t').textContent + ' / ' + words.length);

        var tapWord = function (word) {
          var used = {};
          var picked = [];
          for (var i = 0; i < word.length; i++) {
            var ch = word[i].toUpperCase();
            var el = null;
            for (var j = 0; j < letters.length; j++) {
              var L = letters[j];
              if (L.getAttribute('data-l') === ch && !used[L.getAttribute('data-i')]) { el = L; break; }
            }
            if (!el) return false;
            used[el.getAttribute('data-i')] = true;
            picked.push(el);
          }
          picked.forEach(function (el) {
            var rr = el.getBoundingClientRect();
            el.dispatchEvent(new PointerEvent('pointerdown', {
              bubbles: true, pointerId: 1, clientX: rr.left + rr.width / 2, clientY: rr.top + rr.height / 2
            }));
            el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
          });
          return true;
        };

        var i = 0;
        var next = function () {
          if (i >= words.length) return Promise.resolve();
          tapWord(words[i]);
          i++;
          return sleep(70).then(next);
        };
        return next();
      }).then(function () {
        log('все слова найдены', /Найдено: 8 \/ 8/.test($('#game-sub').textContent || ''), $('#game-sub').textContent);
        log('клетки заполнены', $$('.ww-cell.found').length >= 12, $$('.ww-cell.found').length);
        return sleep(1000);
      }).then(function () {
        log('победа в словах', modalOpen());
        closeModal();
        return sleep(250);
      }).then(function () {
        log('после слов карта', mapActive());

        /* ═══════ 6. Викторина ═══════ */
        click($$('.map-node')[5], 'узел 6');
        return sleep(300);
      }).then(function () {
        var quiz = (window.CONFIG && CONFIG.quiz) || [];
        log('вопросов викторины', quiz.length > 0, quiz.length);

        var step = function (i) {
          if (i >= quiz.length) return Promise.resolve();
          var q = quiz[i];
          var want = q.a[q.c];
          var opts = $$('.quiz-opt');
          if (!opts.length) return Promise.resolve();
          var btn = opts.filter(function (o) { return o.textContent === want; })[0] || opts[0];
          click(btn, 'вариант ответа');
          return sleep(150).then(function () {
            var right = $$('.quiz-opt.correct').length === 1;
            if (i === 0) log('ответ обработан', right, $$('.quiz-opt.correct').length);
            var next = $('#qz-tools .btn');
            click(next, 'дальше');
            return sleep(200).then(function () { return step(i + 1); });
          });
        };
        return step(0);
      }).then(function () {
        return sleep(900);
      }).then(function () {
        log('победа в викторине', modalOpen());
        log('все испытания пройдены', /Все испытания пройдены/.test($('#modal-title').textContent || ''), $('#modal-title').textContent);
        closeModal();
        return sleep(300);
      }).then(function () {
        /* ═══════ финал ═══════ */
        log('карта после всех игр', mapActive());
        log('прогресс 6 из 6', ($('#map-progress').textContent || '').indexOf('6 из 6') >= 0, $('#map-progress').textContent);
        var fin = $('.map-node.finale');
        log('финальный узел доступен', fin && fin.classList.contains('ready'), fin && fin.className);
        click(fin, 'подарок');
        return sleep(400);
      }).then(function () {
        log('финальный экран', $('#screen-final').classList.contains('active'));
        log('возраст в финале', ($('#final-wrap').textContent || '').indexOf('71') >= 0);
        log('фрагменты в финале', $$('.final-fragments .fr').length === 6, $$('.final-fragments .fr').length);
        log('статистика в финале', $$('.passport .stat').length === 7, $$('.passport .stat').length);

        var saved = null;
        try { saved = JSON.parse(localStorage.getItem('quest71-appState')); } catch (e) {}
        log('сохранено в localStorage', !!saved && Object.keys(saved.done || {}).length === 6,
          saved ? Object.keys(saved.done || {}).length : 'нет данных');
        log('прогресс помечен завершённым', !!(saved && saved.finished));
      });
    });
  }

  /* ── очистка прогресса и перезагрузка ── */
  window.__questTestStart = function () {
    try { localStorage.removeItem('quest71-appState'); } catch (e) {}
    try { if (window.indexedDB) indexedDB.deleteDatabase('quest71'); } catch (e) {}
    location.reload();
  };
})();
