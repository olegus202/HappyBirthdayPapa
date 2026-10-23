/* ==========================================================================
   МИНИ-ИГРА «ВИКТОРИНА»
   ========================================================================== */
(function () {
  'use strict';

  App.registerGame({
    id: 'quiz',
    title: 'Викторина',
    icon: '❓',
    desc: 'Ответь на вопросы про именинника',
    init: function (root, api) {

      var cfg = window.CONFIG || {};
      var questions = (cfg.quiz && cfg.quiz.length) ? cfg.quiz.slice() : [{
        q: 'Сколько лет имениннику?', a: ['61', '71', '81'], c: 1, note: 'Ровно 71!'
      }];

      var idx = 0, score = 0, answered = false, finished = false;
      var timer = App.createTimer(function (s) { api.setSub('Вопрос ' + Math.min(idx + 1, questions.length) + ' из ' + questions.length); });
      timer.start();

      root.innerHTML =
        '<div class="game-card">' +
          '<div class="quiz-dots" id="qz-dots"></div>' +
          '<p class="quiz-q" id="qz-q">…</p>' +
          '<div class="quiz-opts" id="qz-opts"></div>' +
          '<div class="msg hidden" id="qz-msg"></div>' +
          '<div class="toolbar" id="qz-tools"></div>' +
        '</div>';

      var dots = root.querySelector('#qz-dots');
      var qEl = root.querySelector('#qz-q');
      var optsEl = root.querySelector('#qz-opts');
      var msg = root.querySelector('#qz-msg');
      var tools = root.querySelector('#qz-tools');

      function showMsg(text, kind) {
        msg.textContent = text;
        msg.className = 'msg' + (kind ? ' ' + kind : '');
        msg.classList.remove('hidden');
      }

      function renderDots() {
        dots.innerHTML = '';
        questions.forEach(function (q, i) {
          var d = App.el('i', i < idx ? 'done' : (i === idx ? 'cur' : ''));
          dots.appendChild(d);
        });
      }

      function render() {
        answered = false;
        var q = questions[idx];
        qEl.textContent = q.q;
        optsEl.innerHTML = '';
        msg.classList.add('hidden');
        renderDots();
        tools.innerHTML = '';
        api.setSub('Вопрос ' + (idx + 1) + ' из ' + questions.length);

        var shuffled = q.a.map(function (text, i) { return { text: text, i: i }; });
        App.shuffle(shuffled);

        shuffled.forEach(function (opt) {
          var b = App.el('button', 'quiz-opt', App.esc(opt.text));
          b.type = 'button';
          b.addEventListener('click', function () { answer(opt.i, b); });
          optsEl.appendChild(b);
        });
      }

      function answer(correctIndex, btn) {
        if (answered || finished) return;
        answered = true;
        var q = questions[idx];
        var correct = q.c === correctIndex;
        var buttons = optsEl.querySelectorAll('.quiz-opt');
        for (var i = 0; i < buttons.length; i++) {
          buttons[i].disabled = true;
        }
        // подсветим правильный ответ
        var idxCorrect = -1;
        for (var k = 0; k < q.a.length; k++) if (k === q.c) idxCorrect = k;
        var all = optsEl.querySelectorAll('.quiz-opt');
        for (var j = 0; j < all.length; j++) {
          if (all[j].textContent === q.a[idxCorrect]) all[j].classList.add('correct');
        }
        if (!correct) btn.classList.add('wrong');

        if (correct) { score++; SFX.play('good'); }
        else SFX.play('error');

        showMsg((correct ? '✓ Верно! ' : '✗ Не совсем. ') + (q.note || ''), correct ? 'ok' : 'warn');

        var next = App.el('button', 'btn btn-primary btn-block', idx + 1 < questions.length ? 'Дальше →' : 'Итоги');
        next.type = 'button';
        next.style.marginTop = '14px';
        next.addEventListener('click', function () { nextQuestion(); });
        tools.innerHTML = '';
        tools.appendChild(next);
      }

      function nextQuestion() {
        idx++;
        if (idx >= questions.length) { finish(); return; }
        render();
      }

      function finish() {
        finished = true;
        timer.stop();
        renderDots();
        SFX.play('win');
        var max = questions.length;
        api.setSub('Счёт: ' + score + ' из ' + max);
        setTimeout(function () {
          api.onWin({
            text: score + ' из ' + max + ' правильно',
            score: Math.round((score / max) * 100),
            time: timer.seconds()
          });
        }, 400);
      }

      render();

      return {
        destroy: function () { timer.stop(); }
      };
    }
  });
})();
