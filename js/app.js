/* ==========================================================================
   ЯДРО КВЕСТА: состояние, экраны, карта, модальные окна, финал
   ========================================================================== */
(function () {
  'use strict';

  var App = {
    games: [],
    _current: null,
    _screen: 'screen-title'
  };
  window.App = App;

  /* ─────────────────────────  Хранилище  ─────────────────────────
     IndexedDB — не очищается на iOS автоматически (в отличие от localStorage).
     Fallback на localStorage, если IndexedDB недоступна. */

  var memoryStore = null;               // запасной вариант, если localStorage недоступен

  function storeGet() {
    if (window.Storage && window.Storage.isIDB()) {
      return window.Storage.get();
    }
    try {
      var raw = window.localStorage.getItem('quest71-appState');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return memoryStore; }
  }
  function storeSet(value) {
    memoryStore = value;
    if (window.Storage) { window.Storage.set(value); return; }
    try { window.localStorage.setItem('quest71-appState', JSON.stringify(value)); }
    catch (e) { /* приватный режим — держим в памяти */ }
  }
  function storeClear() {
    memoryStore = null;
    if (window.Storage) { window.Storage.clear(); return; }
    try { window.localStorage.removeItem('quest71-appState'); } catch (e) {}
  }

  function defaultState() {
    return {
      v: 1,
      name: (window.CONFIG && CONFIG.birthday && CONFIG.birthday.name) || 'Папа',
      started: false,
      finished: false,
      unlockedAll: false,
      done: {},
      results: {},
      fragments: {},
      time: 0,
      settings: { sound: true, anim: true }
    };
  }

  var state = defaultState();

  function applyLoaded(raw) {
    if (!raw || typeof raw !== 'object') return;
    var d = defaultState();
    state = {
      v: 1,
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.slice(0, 40) : d.name,
      started: !!raw.started,
      finished: !!raw.finished,
      unlockedAll: !!raw.unlockedAll,
      done: (raw.done && typeof raw.done === 'object') ? raw.done : {},
      results: (raw.results && typeof raw.results === 'object') ? raw.results : {},
      fragments: (raw.fragments && typeof raw.fragments === 'object') ? raw.fragments : {},
      time: typeof raw.time === 'number' && isFinite(raw.time) ? raw.time : 0,
      settings: {
        sound: raw.settings && typeof raw.settings.sound === 'boolean' ? raw.settings.sound : true,
        anim: raw.settings && typeof raw.settings.anim === 'boolean' ? raw.settings.anim : true
      }
    };
  }

  function load() {
    applyLoaded(storeGet());
  }
  var lastSaveToast = 0;
  function save() {
    storeSet(state);
    var now = Date.now();
    if (now - lastSaveToast > 2500) {
      lastSaveToast = now;
      App.toast('✓ Прогресс сохранён');
    }
  }

  App.state = function () { return state; };
  App.save = save;

  /* ─────────────────────────  Утилиты  ───────────────────────── */

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  App.el = el;

  function $(sel) { return document.querySelector(sel); }
  App.$ = $;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  App.esc = esc;

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0, t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  App.shuffle = shuffle;

  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  App.pick = pick;

  /* Таймер, который не тикает в фоновых вкладках */
  App.createTimer = function (onTick) {
    var id = null, seconds = 0;
    function tick() {
      if (document.hidden) return;
      seconds++;
      try { onTick(seconds); } catch (e) {}
    }
    return {
      start: function () { if (!id) id = setInterval(tick, 1000); },
      stop: function () { if (id) { clearInterval(id); id = null; } },
      seconds: function () { return seconds; },
      isRunning: function () { return !!id; }
    };
  };

  function fmtTime(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    if (m >= 60) {
      var h = Math.floor(m / 60);
      return h + ' ч ' + (m % 60) + ' мин';
    }
    return m + ' мин ' + (s < 10 ? '0' : '') + s + ' с';
  }
  App.fmtTime = fmtTime;

  /* ─────────────────────────  Экраны  ───────────────────────── */

  function showScreen(id) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) {
      screens[i].classList.toggle('active', screens[i].id === id);
    }
    App._screen = id;
    if (id !== 'screen-game' && App._current) {
      App.destroyGame();
    }
    if (id === 'screen-map') renderMap();
    if (id === 'screen-title') renderTitle();
    if (id === 'screen-final') renderFinal();
  }
  App.showScreen = showScreen;

  /* ─────────────────────────  Модальные окна  ───────────────────────── */

  var modalOpen = false;

  App.modal = function (opts) {
    var backdrop = $('#modal-backdrop');
    var body = $('#modal-body');
    var actions = $('#modal-actions');
    var titleEl = $('#modal-title');
    if (!backdrop) return;

    titleEl.textContent = opts.title || '';
    body.innerHTML = opts.html || '';
    actions.innerHTML = '';
    (opts.buttons || [{ label: 'Продолжить', primary: true }]).forEach(function (b) {
      var btn = el('button', 'btn ' + (b.primary ? 'btn-primary' : 'btn-ghost'), esc(b.label));
      btn.type = 'button';
      btn.addEventListener('click', function () {
        if (!b.keepOpen) closeModal();
        if (typeof b.onClick === 'function') { try { b.onClick(); } catch (e) {} }
      });
      actions.appendChild(btn);
    });

    backdrop.classList.remove('hidden');
    backdrop.onclick = function (e) { if (e.target === backdrop && opts.dismissible !== false) closeModal(); };
    modalOpen = true;
    if (opts.onOpen) { try { opts.onOpen(); } catch (e) {} }
  };

  function closeModal() {
    var backdrop = $('#modal-backdrop');
    if (backdrop) backdrop.classList.add('hidden');
    modalOpen = false;
  }
  App.closeModal = closeModal;
  App.isModalOpen = function () { return modalOpen; };

  /* ─────────────────────────  Короткие уведомления  ───────────────────────── */

  App.toast = function (text, ms) {
    var host = document.getElementById('toast-host');
    if (!host) {
      host = el('div', 'toast-host');
      host.id = 'toast-host';
      document.body.appendChild(host);
    }
    var t = el('div', 'toast', esc(text));
    host.appendChild(t);
    while (host.children.length > 3) host.removeChild(host.firstChild);
    setTimeout(function () {
      t.classList.add('out');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 400);
    }, ms || 1900);
    return t;
  };

  /* ─────────────────────────  Секрет: клавиша «Ё»  ───────────────────────── */

  /* Секрет работает только на компьютере: на телефоне клавиши «Ё» нет,
     а на сенсорном экране мышь/указатель «точный» (pointer:fine) не срабатывает. */
  function isComputer() {
    try {
      if (!window.matchMedia) return true;
      return window.matchMedia('(pointer:fine)').matches;
    } catch (e) { return true; }
  }

  function isSecretKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (e.key !== 'Ё' && e.key !== 'ё') return false;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return false;
    return isComputer();
  }

  function secretUnlockAll() {
    if (state.unlockedAll) {
      App.toast('Все испытания уже открыты 🔓');
      return;
    }
    state.unlockedAll = true;
    state.started = true;
    save();
    renderMap();
    SFX.play('win');
    if (window.Confetti) Confetti.rain(45);
    App.modal({
      title: 'Секрет открыт! 🔓',
      html: '<p>Все <b>' + App.games.length + ' испытаний</b> открыты сразу — можно играть в любом порядке.</p>' +
        '<p style="color:#a99ad0">Этот секрет работает только на компьютере: на телефоне клавиши «Ё» нет.</p>',
      buttons: [{ label: 'Ура! 🎉', primary: true }]
    });
  }
  App.secretUnlockAll = secretUnlockAll;

  /* ─────────────────────────  Титульный экран  ───────────────────────── */

  function renderTitle() {
    var cfg = (window.CONFIG && CONFIG.birthday) || {};
    var nameEl = $('#hero-title');
    if (nameEl) nameEl.textContent = 'Приключенческий квест';
    var subEl = $('#hero-sub');
    if (subEl) subEl.textContent = cfg.intro || '';

    var doneCount = App.games.filter(function (g) { return state.done[g.id]; }).length;
    var startBtn = $('#btn-start');
    var contBtn = $('#btn-continue');
    if (startBtn) startBtn.classList.toggle('hidden', state.started);
    if (contBtn) {
      contBtn.classList.toggle('hidden', !state.started);
      contBtn.textContent = doneCount === App.games.length
        ? 'Открыть подарок 🎁'
        : 'Продолжить (' + doneCount + '/' + App.games.length + ')';
    }

    var chips = $('#title-chips');
    if (chips) {
      chips.innerHTML = '';
      App.games.forEach(function (g) {
        var isDone = !!state.done[g.id];
        var chip = el('span', 'chip' + (isDone ? ' done' : ''), g.icon + ' ' + esc(g.title));
        chips.appendChild(chip);
      });
    }
  }

  /* ─────────────────────────  Карта  ───────────────────────── */

  var NODE_POS = [
    { x: 50, y: 272 },
    { x: 21, y: 231 },
    { x: 77, y: 190 },
    { x: 26, y: 149 },
    { x: 76, y: 108 },
    { x: 43, y: 67 },
    { x: 57, y: 24 }
  ];

  function smoothPath(pts) {
    if (!pts.length) return '';
    var d = 'M ' + pts[0].x + ' ' + pts[0].y;
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
      var c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
      var c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
      d += ' C ' + c1x.toFixed(2) + ' ' + c1y.toFixed(2) + ', ' + c2x.toFixed(2) + ' ' + c2y.toFixed(2) + ', ' + p2.x + ' ' + p2.y;
    }
    return d;
  }

  function renderMap() {
    var holder = $('#map-nodes');
    if (!holder) return;
    holder.innerHTML = '';

    var games = App.games;
    var total = games.length;
    var doneCount = games.filter(function (g) { return state.done[g.id]; }).length;
    var currentAssigned = false;

    var progress = $('#map-progress');
    if (progress) progress.textContent = 'Пройдено ' + doneCount + ' из ' + total;

    // дорожка
    var base = $('#road-base'), done = $('#road-done');
    if (base && done) {
      var pts = NODE_POS.slice(0, Math.min(total + 1, NODE_POS.length));
      var d = smoothPath(pts);
      base.setAttribute('d', d);
      done.setAttribute('d', d);
      try {
        var len = done.getTotalLength();
        done.style.strokeDasharray = len + ' ' + len;
        var ratio = total ? doneCount / total : 0;
        done.style.strokeDashoffset = String(len * (1 - ratio));
      } catch (e) {}
    }

    games.forEach(function (g, i) {
      var pos = NODE_POS[i] || NODE_POS[NODE_POS.length - 1];
      var done_ = !!state.done[g.id];
      var unlocked = state.unlockedAll || i === 0 || !!state.done[games[i - 1].id];
      var isCurrent = unlocked && !done_ && !currentAssigned;
      if (isCurrent) currentAssigned = true;

      var node = el('button', 'map-node' + (done_ ? ' done' : '') + (unlocked ? '' : ' locked') + (isCurrent ? ' current' : ''));
      node.type = 'button';
      node.style.left = pos.x + '%';
      node.style.top = (pos.y / 300 * 100) + '%';
      node.setAttribute('aria-label', g.title + (unlocked ? '' : ' (закрыто)'));
      node.innerHTML = '<span class="node-icon">' + g.icon + '</span>' +
        (done_ ? '<span class="node-badge">✓</span>' : (unlocked ? '' : '<span class="node-lock">🔒</span>'));

      node.addEventListener('click', function () {
        if (!unlocked) { App.modal({ title: 'Пока закрыто', html: '<p>Сначала пройди предыдущее испытание — так в этом и смысл квеста.</p>' }); return; }
        SFX.play('click');
        if (done_) showRecap(g); else openGame(g.id);
      });
      holder.appendChild(node);

      var label = el('div', 'map-label' + (done_ ? ' done' : ''), esc(g.title));
      label.style.left = pos.x + '%';
      label.style.top = (pos.y / 300 * 100 + 6.5) + '%';
      holder.appendChild(label);
    });

    // финальный узел
    var finPos = NODE_POS[NODE_POS.length - 1];
    var allDone = doneCount === total && total > 0;
    var fin = el('button', 'map-node finale' + (allDone ? ' ready' : ' locked'));
    fin.type = 'button';
    fin.style.left = finPos.x + '%';
    fin.style.top = (finPos.y / 300 * 100) + '%';
    fin.setAttribute('aria-label', 'Подарок');
    fin.innerHTML = '<span class="node-icon">🎁</span>' + (allDone ? '' : '<span class="node-lock">🔒</span>');
    fin.addEventListener('click', function () {
      if (!allDone) {
        App.modal({
          title: 'Подарок пока закрыт',
          html: '<p>Осталось пройти ещё <b>' + (total - doneCount) + '</b> ' + plural(total - doneCount, 'испытание', 'испытания', 'испытаний') + '.</p>'
        });
        return;
      }
      SFX.play('click');
      state.finished = true; save();
      showScreen('screen-final');
      Confetti.rain(70);
    });
    holder.appendChild(fin);
  }

  function plural(n, one, few, many) {
    var n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
    return many;
  }
  App.plural = plural;

  function showRecap(g) {
    var r = state.results[g.id] || {};
    App.modal({
      title: g.icon + ' ' + g.title,
      html: '<p>' + esc(g.desc || '') + '</p>' +
        (r.text ? '<p><b>Результат:</b> ' + esc(r.text) + '</p>' : '') +
        '<p style="color:#a99ad0">' + esc(state.fragments[g.id] || '') + '</p>',
      buttons: [
        { label: 'Играть ещё раз', primary: true, onClick: function () { openGame(g.id); } },
        { label: 'Закрыть' }
      ]
    });
  }

  /* ─────────────────────────  Запуск мини-игры  ───────────────────────── */

  App.registerGame = function (def) { App.games.push(def); };

  function findGame(id) {
    for (var i = 0; i < App.games.length; i++) if (App.games[i].id === id) return App.games[i];
    return null;
  }
  App.findGame = findGame;

  function openGame(id) {
    var g = findGame(id);
    if (!g) return;
    App._currentGameId = id;
    var root = $('#game-root');
    if (!root) return;
    App.destroyGame();

    root.innerHTML = '';
    $('#game-title').textContent = g.title;
    $('#game-sub').textContent = g.desc || 'Мини-игра';

    var api = {
      root: root,
      onWin: function (result) { completeGame(g, result || {}); },
      setSub: function (txt) { $('#game-sub').textContent = txt; },
      setTitle: function (txt) { $('#game-title').textContent = txt; },
      exit: function () { showScreen('screen-map'); }
    };

    showScreen('screen-game');
    try {
      App._current = g.init(root, api) || { destroy: function () {} };
    } catch (err) {
      root.innerHTML = '<div class="game-card"><p class="game-hint">Не удалось запустить мини-игру. Вернись на карту и попробуй ещё раз.</p></div>';
      if (window.console) console.error(err);
    }
    $('#game-scroll').scrollTop = 0;
  }
  App.openGame = openGame;

  App.destroyGame = function () {
    if (App._current && typeof App._current.destroy === 'function') {
      try { App._current.destroy(); } catch (e) {}
    }
    App._current = null;
  };

  function completeGame(g, result) {
    state.done[g.id] = true;
    state.results[g.id] = result;
    state.fragments[g.id] = (window.CONFIG && CONFIG.fragments && CONFIG.fragments[g.id]) || '';
    state.started = true;
    if (typeof result.time === 'number') state.time += result.time;
    save();

    var total = App.games.length;
    var doneCount = App.games.filter(function (x) { return state.done[x.id]; }).length;
    var allDone = doneCount === total;

    SFX.play('win');
    if (window.Confetti) Confetti.rain(60);

    App.modal({
      title: allDone ? 'Все испытания пройдены! 🎉' : 'Испытание пройдено!',
      html:
        '<p style="text-align:center"><b>' + esc(result.text || 'Отличная работа!') + '</b></p>' +
        '<div style="margin:14px 0;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);font-style:italic">' +
        esc(state.fragments[g.id] || '') + '</div>' +
        (allDone
          ? '<p style="text-align:center">Осталось совсем немного — <b>подарок в конце пути</b> ждёт тебя!</p>'
          : '<p style="text-align:center">Пройдено <b>' + doneCount + ' из ' + total + '</b>. Дорога ждёт.</p>'),
      buttons: [
        { label: allDone ? 'К подарку 🎁' : 'Дальше по карте', primary: true, onClick: function () {
            if (allDone) { showScreen('screen-map'); setTimeout(function () { scrollToFinale(); }, 120); }
            else showScreen('screen-map');
          } }
      ]
    });
  }

  function scrollToFinale() {
    var sc = $('#map-scroll');
    if (sc) sc.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ─────────────────────────  Финал  ───────────────────────── */

  function renderFinal() {
    var wrap = $('#final-wrap');
    if (!wrap) return;
    var cfg = (window.CONFIG && CONFIG.birthday) || {};
    var name = state.name || cfg.name || 'Папа';
    var age = cfg.age || 71;
    var games = App.games;

    var fragsHtml = games.map(function (g) {
      var f = state.fragments[g.id];
      if (!f) return '';
      return '<div class="fr"><b>' + esc(g.title) + ':</b> ' + esc(f) + '</div>';
    }).join('');

    var resultsHtml = games.map(function (g) {
      var r = state.results[g.id] || {};
      return '<div class="stat"><b>' + esc(r.text || '—') + '</b><span>' + esc(g.title) + '</span></div>';
    }).join('');

    wrap.innerHTML =
      '<div class="final-card">' +
        '<div class="ribbon">С Днём Рождения</div>' +
        '<div class="final-num">' + esc(age) + '</div>' +
        '<h2 class="final-title">' + esc(name) + ', ' + esc(cfg.title || 'с Днём Рождения!') + '</h2>' +
        '<p class="final-text">' + esc(cfg.finalText || '') + '</p>' +
        '<div class="final-fragments">' + fragsHtml + '</div>' +
        '<div class="passport">' + resultsHtml + '<div class="stat"><b>' + fmtTime(state.time) + '</b><span>в пути</span></div></div>' +
        '<div style="margin-top:20px;display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn btn-primary" id="btn-final-again" type="button">Пройти ещё раз</button>' +
          '<button class="btn btn-ghost" id="btn-final-map" type="button">К карте</button>' +
        '</div>' +
      '</div>';

    var again = $('#btn-final-again');
    if (again) again.addEventListener('click', function () {
      resetProgress(false);
      showScreen('screen-title');
    });
    var toMap = $('#btn-final-map');
    if (toMap) toMap.addEventListener('click', function () { showScreen('screen-map'); });
  }

  function resetProgress(ask) {
    var doReset = function () {
      state = defaultState();
      state.settings = { sound: true, anim: true };
      storeClear();
      save();
      applySettings();
      renderTitle();
      SFX.play('click');
      App.modal({
        title: 'Прогресс сброшен',
        html: '<p>Путь начинается сначала. Удачи!</p>',
        buttons: [{ label: 'Начать заново', primary: true, onClick: function () { showScreen('screen-title'); } }]
      });
    };
    if (ask === false) { doReset(); return; }
    App.modal({
      title: 'Сбросить прогресс?',
      html: '<p>Все пройденные испытания и найденные фрагменты будут удалены.</p>',
      buttons: [
        { label: 'Да, начать заново', onClick: doReset },
        { label: 'Отмена', primary: true }
      ]
    });
  }
  App.resetProgress = resetProgress;

  /* ─────────────────────────  Настройки  ───────────────────────── */

  function applySettings() {
    document.body.classList.toggle('no-anim', !state.settings.anim);
    if (window.SFX) SFX.setEnabled(state.settings.sound);
  }

  function openSettings() {
    var html =
      '<div class="field"><label for="set-name">Как обращаться к имениннику</label>' +
      '<input type="text" id="set-name" maxlength="40" value="' + esc(state.name) + '"></div>' +
      '<div class="switch-row"><span>Звуки</span><button class="switch' + (state.settings.sound ? ' on' : '') + '" id="sw-sound" type="button" aria-label="Звук"></button></div>' +
      '<div class="switch-row"><span>Анимации</span><button class="switch' + (state.settings.anim ? ' on' : '') + '" id="sw-anim" type="button" aria-label="Анимации"></button></div>' +
      '<div style="margin-top:18px"><button class="btn btn-ghost btn-block" id="set-reset" type="button">Сбросить весь прогресс</button></div>' +
      '<p style="margin-top:14px;color:#a99ad0;font-size:13px">Именинник: <b>' + esc((window.CONFIG && CONFIG.birthday && CONFIG.birthday.name) || '') +
      '</b>, дата: <b>' + esc((window.CONFIG && CONFIG.birthday && CONFIG.birthday.date) || '') + '</b></p>';

    App.modal({
      title: 'Настройки',
      html: html,
      buttons: [{ label: 'Готово', primary: true }],
      onOpen: function () {
        var nameInput = $('#set-name');
        if (nameInput) {
          var nameTimer = null;
          var applyName = function () {
            var v = (nameInput.value || '').trim().slice(0, 40);
            state.name = v || ((window.CONFIG && CONFIG.birthday && CONFIG.birthday.name) || 'Папа');
            save();
            renderTitle();
          };
          nameInput.addEventListener('change', applyName);
          nameInput.addEventListener('input', function () {
            if (nameTimer) clearTimeout(nameTimer);
            nameTimer = setTimeout(applyName, 600);   /* сохраняем, даже если сразу уйдём со страницы */
          });
          nameInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') nameInput.blur(); });
        }
        var swS = $('#sw-sound');
        if (swS) swS.addEventListener('click', function () {
          state.settings.sound = !state.settings.sound;
          swS.classList.toggle('on', state.settings.sound);
          applySettings(); save();
          if (state.settings.sound) SFX.play('click');
        });
        var swA = $('#sw-anim');
        if (swA) swA.addEventListener('click', function () {
          state.settings.anim = !state.settings.anim;
          swA.classList.toggle('on', state.settings.anim);
          applySettings(); save();
        });
        var rst = $('#set-reset');
        if (rst) rst.addEventListener('click', function () {
          App.closeModal();
          setTimeout(function () { resetProgress(true); }, 60);
        });
      }
    });
  }
  App.openSettings = openSettings;

  /* ─────────────────────────  Как играть  ───────────────────────── */

  function openHow() {
    App.modal({
      title: 'Как играть',
      html:
        '<p>Это квест-путешествие: <b>' + App.games.length + ' мини-игр</b>, и каждая открывает следующую.</p>' +
        '<ul>' +
          '<li>Нажимай на круглые узлы карты — они открываются по порядку.</li>' +
          '<li>Выигрывай мини-игру, чтобы получить <b>фрагмент письма</b> и открыть следующий узел.</li>' +
          '<li>Все задания можно перепроходить — результаты только улучшаются.</li>' +
          '<li>Прогресс сохраняется автоматически в этом браузере.</li>' +
          '<li>Игра работает и мышкой, и пальцем. На телефоне просто касайся карточек.</li>' +
        '</ul>' +
        '<p style="color:#a99ad0">Совет: в «Пяти буквах» можно подсмотреть подсказку, а в маджонге — перемешать кости.</p>' +
        '<p style="color:#a99ad0">А на компьютере у квеста есть один секретный ключ — попробуй найти его.</p>',
      buttons: [{ label: 'Понятно', primary: true }]
    });
  }

  /* ─────────────────────────  События  ───────────────────────── */

  function bindUI() {
    var startBtn = $('#btn-start');
    if (startBtn) startBtn.addEventListener('click', function () {
      SFX.unlock(); SFX.play('click');
      state.started = true; save();
      showScreen('screen-map');
    });

    /* Поделиться (Web Share API, на iOS работает через Share sheet) */
    var shareBtn = $('#btn-share');
    if (shareBtn) {
      if (navigator.share) {
        shareBtn.classList.remove('hidden');
        shareBtn.addEventListener('click', function () {
          SFX.play('click');
          navigator.share({
            title: 'Квест ко дню рождения — 71',
            text: (window.CONFIG && CONFIG.birthday && CONFIG.birthday.intro) || 'Приключенческий квест ко дню рождения',
            url: location.href
          }).catch(function () {});
        });
      } else {
        shareBtn.classList.add('hidden');
      }
    }

    var contBtn = $('#btn-continue');
    if (contBtn) contBtn.addEventListener('click', function () {
      SFX.unlock(); SFX.play('click');
      var total = App.games.length;
      var allDone = App.games.every(function (g) { return state.done[g.id]; });
      if (allDone) { showScreen('screen-map'); setTimeout(scrollToFinale, 150); }
      else showScreen('screen-map');
    });

    var howBtn = $('#btn-how');
    if (howBtn) howBtn.addEventListener('click', function () { SFX.play('click'); openHow(); });

    var setBtn = $('#btn-settings');
    if (setBtn) setBtn.addEventListener('click', function () { SFX.play('click'); openSettings(); });

    var mapBack = $('#map-back');
    if (mapBack) mapBack.addEventListener('click', function () { SFX.play('click'); showScreen('screen-title'); });

    var mapJournal = $('#map-journal');
    if (mapJournal) mapJournal.addEventListener('click', function () { SFX.play('click'); openJournal(); });

    var toFinal = $('#btn-to-final');
    if (toFinal) toFinal.addEventListener('click', function () { SFX.play('click'); scrollToFinale(); });

    var gameBack = $('#game-back');
    if (gameBack) gameBack.addEventListener('click', function () { SFX.play('click'); showScreen('screen-map'); });

    var gameRestart = $('#game-restart');
    if (gameRestart) gameRestart.addEventListener('click', function () {
      SFX.play('click');
      var id = App._currentGameId;
      if (id) openGame(id);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modalOpen) { closeModal(); }
      if (isSecretKey(e)) { e.preventDefault(); secretUnlockAll(); }
    });

    /* разблокируем звук после первого касания */
    ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
      document.addEventListener(ev, function once() {
        SFX.unlock();
        document.removeEventListener(ev, once);
      }, { passive: true });
    });

    /* Баннер установки на iOS */
    maybeShowIosBanner();
  }

  /* ─────────────────────────  Баннер установки на iOS  ───────────────────────── */

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function maybeShowIosBanner() {
    if (!isIOS() || isStandalone()) return;
    try {
      if (window.localStorage.getItem('ios-banner-dismissed')) return;
    } catch (e) {}
    var banner = document.getElementById('ios-banner');
    if (!banner) return;
    banner.classList.remove('hidden');
    var closeBtn = document.getElementById('ios-banner-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        banner.classList.add('hidden');
        try { window.localStorage.setItem('ios-banner-dismissed', '1'); } catch (e) {}
      });
    }
  }

  function openJournal() {
    var games = App.games;
    var rows = games.map(function (g) {
      var done = !!state.done[g.id];
      var r = state.results[g.id] || {};
      var frag = state.fragments[g.id];
      return '<div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,.08)">' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<b>' + g.icon + ' ' + esc(g.title) + '</b>' +
          '<span style="margin-left:auto;font-size:13px;color:' + (done ? '#8ff3c8' : '#a99ad0') + '">' +
          (done ? '✓ ' + esc(r.text || 'пройдено') : '🔒 ещё не пройдено') + '</span>' +
        '</div>' +
        (frag ? '<div style="font-size:13px;color:#cfc4ea;margin-top:5px;font-style:italic">«' + esc(frag) + '»</div>' : '') +
        '</div>';
    }).join('');
    App.modal({
      title: '📖 Дневник квеста',
      html: rows || '<p>Пока пусто.</p>',
      buttons: [{ label: 'Закрыть', primary: true }]
    });
  }

  /* ─────────────────────────  Запуск  ───────────────────────── */

  function boot() {
    function start() {
      load();
      applySettings();

      // подставляем имя именинника
      var cfg = (window.CONFIG && CONFIG.birthday) || {};
      if (cfg.name && !state.name) state.name = cfg.name;

      bindUI();
      showScreen('screen-title');

      if (window.Confetti) Confetti.rain(26);

      document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
          save();   /* уходим в фон — сохраняем всё, что накопилось */
        }
      });

      /* страховка: сохраняем при закрытии вкладки/окна */
      window.addEventListener('pagehide', function () { save(); });
      window.addEventListener('beforeunload', function () { save(); });

      if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
        try { navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) {}
      }
    }

    /* Инициализируем IndexedDB (быстро), потом запускаем */
    if (window.Storage) {
      window.Storage.init().then(function (data) {
        if (data) applyLoaded(data);
        start();
      }).catch(function () { start(); });
    } else {
      start();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
