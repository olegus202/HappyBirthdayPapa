/* ==========================================================================
   МИНИ-ИГРА «НАЙДИ ПАРУ»
   ========================================================================== */
(function () {
  'use strict';

  App.registerGame({
    id: 'memory',
    title: 'Найди пару',
    icon: '🎴',
    desc: 'Открывай карточки и находи одинаковые',
    init: function (root, api) {

      var icons = (window.CONFIG && CONFIG.memoryIcons) || ['🎂','🎁','🎉','🥂','🎈','🎊','💐','🌟'];
      var cols = 4, rows = 4;
      var cards = [], openCards = [], matched = 0, moves = 0, busy = false, finished = false;
      var timer = App.createTimer(function (s) {
        api.setSub('Ходов: ' + moves + ' · ' + App.fmtTime(s));
      });
      timer.start();

      root.innerHTML =
        '<div class="game-card">' +
          '<p class="game-hint">Открывай по <b>две карточки</b> и находи одинаковые. Чем меньше ходов — тем лучше!</p>' +
          '<div class="game-status">' +
            '<div class="stat"><b id="mem-moves">0</b><span>ходов</span></div>' +
            '<div class="stat"><b id="mem-left">0</b><span>пар осталось</span></div>' +
            '<div class="stat"><b id="mem-time">0:00</b><span>время</span></div>' +
          '</div>' +
          '<div class="mem-grid" id="mem-grid"></div>' +
          '<div class="msg hidden" id="mem-msg"></div>' +
          '<div class="toolbar">' +
            '<button class="btn btn-sm btn-ghost" id="mem-new" type="button">Новая раскладка</button>' +
          '</div>' +
        '</div>';

      var grid = root.querySelector('#mem-grid');
      var msg = root.querySelector('#mem-msg');
      var elMoves = root.querySelector('#mem-moves');
      var elLeft = root.querySelector('#mem-left');
      var elTime = root.querySelector('#mem-time');

      function showMsg(text, kind) {
        msg.textContent = text;
        msg.className = 'msg' + (kind ? ' ' + kind : '');
        msg.classList.remove('hidden');
      }

      function build() {
        var width = root.clientWidth || 340;
        var scroll = document.getElementById('game-scroll');
        cols = width >= 720 ? 6 : 4;
        rows = 4;
        var pairs = cols * rows / 2;
        var set = icons.slice(0, pairs);
        while (set.length < pairs) set = set.concat(icons.slice(0, pairs - set.length));

        var deck = [];
        set.forEach(function (ic) { deck.push(ic, ic); });
        App.shuffle(deck);

        grid.style.setProperty('--cols', String(cols));
        grid.style.width = '100%';
        grid.innerHTML = '';
        cards = [];
        matched = 0; moves = 0; openCards = []; busy = false; finished = false;

        // подгонка размера карточек под экран
        var cardWrap = root.querySelector('.game-card');
        var gridW = grid.clientWidth || width - 40;
        var gap = 8;
        var maxCardW = (gridW - gap * (cols - 1)) / cols;
        var cardHGuess = maxCardW / 0.78;
        var others = 0;
        if (cardWrap) {
          var hintH = (root.querySelector('.game-hint') && root.querySelector('.game-hint').offsetHeight) || 0;
          var statusH = (root.querySelector('.game-status') && root.querySelector('.game-status').offsetHeight) || 0;
          var barH = (root.querySelector('.toolbar') && root.querySelector('.toolbar').offsetHeight) || 0;
          others = hintH + statusH + barH + 90;
        }
        var availH = scroll ? (scroll.clientHeight - others) : (window.innerHeight - 320 - others);
        var maxCardH = rows ? (availH - gap * (rows - 1)) / rows : cardHGuess;
        var cardW = Math.min(maxCardW, maxCardH * 0.78);
        if (cardW < 54 && cols === 4 && rows > 3) {
          // попробуем 3 ряда
          rows = 3;
          pairs = cols * rows / 2;
          set = icons.slice(0, pairs);
          while (set.length < pairs) set = set.concat(icons.slice(0, pairs - set.length));
          deck = [];
          set.forEach(function (ic) { deck.push(ic, ic); });
          App.shuffle(deck);
          maxCardH = rows ? ((availH + 40) - gap * (rows - 1)) / rows : cardHGuess;
          cardW = Math.min(maxCardW, maxCardH * 0.78);
        }
        cardW = Math.max(46, Math.min(cardW, width >= 720 ? 110 : 92));
        grid.style.setProperty('--mem-w', Math.floor(cardW) + 'px');
        grid.style.width = Math.floor(cols * cardW + gap * (cols - 1)) + 'px';

        deck.forEach(function (ic, i) {
          var c = App.el('div', 'mem-card');
          c.innerHTML =
            '<div class="mem-inner">' +
              '<div class="mem-face mem-front"></div>' +
              '<div class="mem-face mem-back">' + ic + '</div>' +
            '</div>';
          c.setAttribute('role', 'button');
          c.setAttribute('aria-label', 'карточка');
          c.addEventListener('click', function () { flip(c); });
          c._icon = ic;
          cards.push(c);
          grid.appendChild(c);
        });
        refresh();
      }

      function flip(c) {
        if (busy || finished) return;
        if (c.classList.contains('open') || c.classList.contains('matched')) return;
        c.classList.add('open');
        SFX.play('tap');
        openCards.push(c);
        if (openCards.length < 2) return;
        moves++;
        busy = true;
        refresh();
        var a = openCards[0], b = openCards[1];
        if (a._icon === b._icon) {
          setTimeout(function () {
            a.classList.add('matched');
            b.classList.add('matched');
            openCards = [];
            busy = false;
            matched++;
            SFX.play('match');
            refresh();
            checkWin();
          }, 320);
        } else {
          setTimeout(function () {
            a.classList.remove('open');
            b.classList.remove('open');
            openCards = [];
            busy = false;
            SFX.play('error');
            refresh();
          }, 780);
        }
      }

      function refresh() {
        elMoves.textContent = String(moves);
        elLeft.textContent = String(cards.length / 2 - matched);
        var s = timer.seconds();
        elTime.textContent = Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
      }

      function checkWin() {
        if (matched === cards.length / 2 && !finished) {
          finished = true;
          timer.stop();
          SFX.play('win');
          setTimeout(function () {
            api.onWin({
              text: 'все пары за ' + moves + ' ' + App.plural(moves, 'ход', 'хода', 'ходов'),
              score: Math.max(20, 110 - moves * 2),
              time: timer.seconds()
            });
          }, 500);
        }
      }

      root.querySelector('#mem-new').addEventListener('click', function () {
        build();
        showMsg('Новая раскладка!', 'ok');
      });

      build();
      var onResize = function () { build(); };
      window.addEventListener('resize', onResize);

      return {
        destroy: function () {
          timer.stop();
          window.removeEventListener('resize', onResize);
        }
      };
    }
  });
})();
