/* Aegis Gate — поведение сайта: щит, живые сценки, мастер подключения, загрузки. */
(function () {
  'use strict';

  var CONFIG = window.AEGIS_CONFIG || {};
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var STATUS_LABEL = {
    off: 'Не защищено',
    connecting: 'Подключение…',
    on: 'Защищено',
    error: 'Серверы не отвечают',
  };

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /** Runs `start` while the element is on screen and `stop` when it leaves. */
  function whileVisible(el, start, stop) {
    if (!('IntersectionObserver' in window)) {
      start();
      return;
    }
    var running = false;
    new IntersectionObserver(
      function (entries) {
        var visible = entries[entries.length - 1].isIntersecting;
        if (visible && !running) {
          running = true;
          start();
        } else if (!visible && running) {
          running = false;
          stop();
        }
      },
      { threshold: 0.15 }
    ).observe(el);
  }

  /** Steps through phases with per-phase durations, only while visible. */
  function cycle(el, durations, onPhase) {
    var i = 0;
    var timer = 0;
    function step() {
      onPhase(i);
      timer = window.setTimeout(function () {
        i = (i + 1) % durations.length;
        step();
      }, durations[i]);
    }
    whileVisible(el, step, function () {
      window.clearTimeout(timer);
    });
  }

  /* ---------- Header ---------- */

  function initHeader() {
    var header = $('.site-header');
    var toggle = $('.menu-toggle');
    if (!header || !toggle) return;
    toggle.addEventListener('click', function () {
      var open = header.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    $$('.nav a', header).forEach(function (a) {
      a.addEventListener('click', function () {
        header.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('nav-open')) {
        header.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  /* ---------- Shield ---------- */

  /**
   * Same flow as the app: off/error → connecting → on, on → off.
   * The scope element carries data-status so the beam, status line and
   * services band react through CSS.
   */
  function Shield(scope) {
    this.scope = scope;
    this.emblem = $('[data-emblem]', scope);
    this.art = $('.emblem__art', this.emblem);
    this.status = 'off';
    this.timer = 0;
    var self = this;
    this.emblem.addEventListener('click', function () {
      self.tap();
    });
    this.render();
  }

  Shield.prototype.set = function (status) {
    var prev = this.status;
    this.status = status;
    window.clearTimeout(this.timer);
    if (status === 'connecting') {
      var self = this;
      this.timer = window.setTimeout(function () {
        self.set('on');
      }, REDUCED ? 0 : 2100);
    }
    if (status === 'on' && prev !== 'on' && !REDUCED) this.burst();
    this.render();
  };

  Shield.prototype.tap = function () {
    if (this.status === 'connecting') return;
    this.set(this.status === 'on' ? 'off' : 'connecting');
  };

  Shield.prototype.burst = function () {
    var emblem = this.emblem;
    $$('.emblem__wave', emblem).forEach(function (w) {
      w.remove();
    });
    for (var k = 0; k < 2; k++) {
      var wave = document.createElement('span');
      wave.className = 'emblem__wave';
      emblem.insertBefore(wave, this.art);
    }
    window.setTimeout(function () {
      $$('.emblem__wave', emblem).forEach(function (w) {
        w.remove();
      });
    }, 1700);
    this.art.classList.remove('is-flash');
    void this.art.offsetWidth;
    this.art.classList.add('is-flash');
  };

  Shield.prototype.render = function () {
    var s = this.status;
    this.scope.setAttribute('data-status', s);
    this.emblem.setAttribute('data-status', s);
    this.emblem.setAttribute('aria-pressed', String(s === 'on'));
    this.emblem.setAttribute('aria-label', s === 'on' ? 'Щит: нажмите, чтобы отключиться' : 'Щит: нажмите, чтобы подключиться');
    $$('[data-status-label]', this.scope).forEach(function (el) {
      el.textContent = STATUS_LABEL[s];
    });
    $$('[data-text-' + s + ']', this.scope).forEach(function (el) {
      el.textContent = el.getAttribute('data-text-' + s);
    });
    $$('[data-text-off]', this.scope).forEach(function (el) {
      if (!el.hasAttribute('data-text-' + s)) el.textContent = '';
    });
  };

  function initShields() {
    $$('[data-shield]').forEach(function (scope) {
      var shield = new Shield(scope);
      scope.shield = shield;
      if (scope.hasAttribute('data-autoplay')) {
        if (REDUCED) {
          shield.set('on');
        } else {
          window.setTimeout(function () {
            if (shield.status === 'off') shield.set('connecting');
          }, 1200);
        }
      }
    });
  }

  /* ---------- Advantage demos ---------- */

  function initDemos() {
    var status = $('[data-demo="status"]');
    if (status) {
      var statusImg = $('img', status);
      var statusTitle = $('b', status);
      var statusNote = $('small', status);
      var states = ['off', 'connecting', 'on'];
      var notes = { off: 'Нажмите на щит, чтобы подключиться', connecting: 'Подбираем маршрут', on: 'Можно пользоваться' };
      var colors = { off: 'var(--off)', connecting: 'var(--blue)', on: 'var(--cyan)' };
      cycle(status, [1500, 1900, 2800], function (i) {
        var s = states[i];
        statusImg.src = statusImg.getAttribute('data-src-' + s);
        statusTitle.textContent = STATUS_LABEL[s];
        statusTitle.style.color = colors[s];
        statusNote.textContent = notes[s];
      });
    }

    var route = $('[data-demo="route"]');
    if (route) {
      var rows = $$('.route', route);
      var note = $('.route-note', route);
      var text = { closed: 'провайдер закрыл', check: 'проверяем…', idle: 'в запасе' };
      var plan = [
        ['ok', 'idle', 'idle'],
        ['closed', 'check', 'idle'],
        ['closed', 'ok', 'idle'],
      ];
      cycle(route, [1900, 1400, 2900], function (i) {
        rows.forEach(function (row, r) {
          var state = plan[i][r];
          row.setAttribute('data-state', state);
          $('.route__state', row).textContent = state === 'ok' ? 'работает · ' + row.getAttribute('data-ms') : text[state];
        });
        note.classList.toggle('is-on', i === 2);
      });
    }

    var subDemo = $('[data-demo="sub"]');
    if (subDemo) {
      var subLabel = $('.demo-sub__text', subDemo);
      var subTimer = 0;
      whileVisible(
        subDemo,
        function () {
          if (subDemo.getAttribute('data-phase') === '1') return;
          subTimer = window.setTimeout(function () {
            subDemo.setAttribute('data-phase', '1');
            subLabel.textContent = 'Обновлено только что';
          }, 2400);
        },
        function () {
          window.clearTimeout(subTimer);
        }
      );
    }

    var chat = $('[data-demo="chat"]');
    if (chat) {
      cycle(chat, [1500, 1500, 3200], function (i) {
        chat.setAttribute('data-phase', String(i));
      });
    }
  }

  /* ---------- App mock: «Добавить подписку» как запись экрана ---------- */

  var SUB_URL = 'https://sub.aegis-gate.ru/u/7f3a9c2e41';
  // 0 idle · 1 to chevron · 2 open · 3 to field · 4 focus · 5 typing · 6 to «Добавить» · 7 updating · 8 active
  var ADD_TIMING = [1000, 650, 650, 650, 350, 1900, 650, 1200, 3200];
  var ADD_CURSOR = [
    [262, 384],
    [322, 299],
    [322, 299],
    [130, 122],
    [130, 122],
    [130, 122],
    [298, 158],
    [298, 158],
    [262, 384],
  ];

  function initAppMock() {
    var mock = $('[data-appmock]');
    if (!mock) return;
    var frame = mock.parentElement;
    var cursor = $('.am-cursor', mock);
    var typed = $('.am-field__text', mock);
    var statusEl = $('[data-am="status"]', mock);
    var termEl = $('[data-am="term"]', mock);
    var stats = $$('[data-am-stat]', mock);
    var steps = $$('[data-add-on]');
    var typeTimer = 0;

    function fit() {
      var box = frame.parentElement;
      var max = parseFloat(frame.getAttribute('data-max-scale') || '0.9');
      var s = Math.min(max, box.clientWidth / 360);
      frame.style.setProperty('--s', s.toFixed(3));
    }
    fit();
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(frame.parentElement);

    function setCell(el, value, color) {
      if (el.textContent === value) return;
      el.textContent = value;
      el.style.color = color || '';
      el.classList.remove('is-fresh');
      void el.offsetWidth;
      el.classList.add('is-fresh');
    }

    function click(x, y) {
      var ring = document.createElement('span');
      ring.className = 'am-click';
      ring.style.left = x + 'px';
      ring.style.top = y + 'px';
      mock.appendChild(ring);
      window.setTimeout(function () {
        ring.remove();
      }, 700);
    }

    function phase(ph) {
      var open = ph >= 2 && ph <= 6;
      var focus = ph >= 4 && ph <= 6;
      mock.classList.toggle('is-open', open);
      mock.classList.toggle('is-focus', focus);
      mock.classList.toggle('is-press', ph === 6);
      mock.classList.toggle('is-active', ph === 8);

      var pos = ADD_CURSOR[ph];
      cursor.style.left = pos[0] - 4 + 'px';
      cursor.style.top = pos[1] - 3 + 'px';
      var press = ph === 2 || ph === 4 || ph === 7;
      cursor.classList.toggle('is-press', press);
      if (press) click(pos[0], pos[1]);

      window.clearInterval(typeTimer);
      if (ph === 0) typed.textContent = '';
      if (ph === 5) {
        var n = 0;
        typeTimer = window.setInterval(function () {
          n = Math.min(SUB_URL.length, n + 1);
          typed.textContent = SUB_URL.slice(0, n);
          if (n === SUB_URL.length) window.clearInterval(typeTimer);
        }, 1500 / SUB_URL.length);
      }

      if (ph === 8) {
        setCell(statusEl, 'Активна', 'var(--lime)');
        setCell(termEl, '30 дн.');
      } else if (ph === 7) {
        setCell(statusEl, 'Обновляется', 'var(--blue)');
      } else if (ph === 0) {
        statusEl.textContent = 'Нет подписки';
        statusEl.style.color = 'var(--app-muted)';
        termEl.textContent = '—';
      }
      stats.forEach(function (el) {
        el.textContent = ph === 8 ? el.getAttribute('data-am-stat') : '—';
      });

      steps.forEach(function (li) {
        var on = li.getAttribute('data-add-on').split(',').indexOf(String(ph)) !== -1;
        li.classList.toggle('is-on', on);
      });
    }

    if (REDUCED) {
      phase(8);
      return;
    }
    cycle(mock, ADD_TIMING, phase);
  }

  /* ---------- Connect wizard ---------- */

  function initWizard() {
    var wizard = $('[data-wizard]');
    if (!wizard) return;
    var steps = $$('.step', wizard);
    var total = steps.length;
    var num = $('.stage__num', wizard);
    var tabs = $$('[data-goto]', wizard);
    var prev = $('[data-prev]', wizard);
    var next = $('[data-next]', wizard);
    var done = $('[data-done]', wizard);
    var mobileLabel = $('[data-step-label]', wizard);
    var bars = $$('.progress-mobile__bars span', wizard);
    var stage = $('.stage', wizard);
    var current = 0;

    function show(n, user) {
      n = Math.max(1, Math.min(total, n));
      if (n === current) return;
      current = n;
      steps.forEach(function (s, i) {
        s.hidden = i + 1 !== n;
      });
      num.textContent = '0' + n;
      tabs.forEach(function (t) {
        var k = Number(t.getAttribute('data-goto'));
        t.classList.toggle('is-done', k < n);
        t.classList.toggle('is-current', k === n);
        if (k === n) t.setAttribute('aria-current', 'step');
        else t.removeAttribute('aria-current');
      });
      bars.forEach(function (b, i) {
        b.classList.toggle('is-on', i < n);
      });
      if (mobileLabel) mobileLabel.textContent = 'Шаг ' + n + ' из ' + total;
      prev.setAttribute('aria-disabled', String(n === 1));
      next.hidden = n === total;
      done.hidden = n !== total;

      var shieldScope = $('[data-shield]', steps[total - 1]);
      if (shieldScope && shieldScope.shield && n !== total) shieldScope.shield.set('off');

      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', n === 1 ? window.location.pathname : '#step-' + n);
      }
      if (user) {
        var top = stage.getBoundingClientRect().top;
        if (top < 60 || top > window.innerHeight * 0.6) {
          stage.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
        }
        var heading = $('h2', steps[n - 1]);
        if (heading) heading.focus({ preventScroll: true });
      }
    }

    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        show(Number(t.getAttribute('data-goto')), true);
      });
    });
    prev.addEventListener('click', function () {
      show(current - 1, true);
    });
    next.addEventListener('click', function () {
      show(current + 1, true);
    });

    var m = /^#step-(\d)$/.exec(window.location.hash);
    show(m ? Number(m[1]) : 1, false);
    window.addEventListener('hashchange', function () {
      var h = /^#step-(\d)$/.exec(window.location.hash);
      if (h) show(Number(h[1]), true);
    });
  }

  /* ---------- VirusTotal ---------- */

  var VT_FILES = {
    windows: { group: 'windows', os: 'Windows', short: 'setup.exe' },
    'android-arm64': { group: 'android', os: 'Android', short: 'arm64.apk' },
    'android-arm': { group: 'android', os: 'Android', short: 'arm.apk' },
    'android-x64': { group: 'android', os: 'Android', short: 'x64.apk' },
  };

  var vtKnown = {};
  var vtReports = null;
  var vtOpen = null;
  var vtEventsReady = false;

  function vtPlural(n, one, few, many) {
    var n10 = n % 10;
    var n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
    return many;
  }

  function vtEl(tag, cls) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    return node;
  }

  function vtText(tag, cls, value) {
    var node = vtEl(tag, cls);
    node.textContent = value;
    return node;
  }

  function vtShortSha(sha) {
    return sha.slice(0, 4) + '...' + sha.slice(-4);
  }

  function vtWhen(iso, withTime) {
    var date = new Date(iso);
    if (!iso || isNaN(date.getTime())) return '';
    var text = date.toLocaleString(
      'ru-RU',
      withTime
        ? { timeZone: 'Europe/Moscow', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { timeZone: 'Europe/Moscow', day: 'numeric', month: 'short' }
    );
    return withTime ? text + ' МСК' : text.replace(/\.$/, '');
  }

  function vtTotal(report) {
    return (report.malicious || 0) + (report.suspicious || 0) + (report.undetected || 0) + (report.harmless || 0);
  }

  function vtResolve(key) {
    var known = vtKnown[key] || {};
    var sha = (known.sha || '').toLowerCase();
    var found = sha && vtReports && vtReports[sha];
    if (found && found.status === 'ready') return found;
    return {
      status: 'wait',
      phase: found && found.status === 'scanning' ? 'scan' : 'missing',
      sha: sha,
    };
  }

  function vtView(report, known) {
    if (report.status !== 'ready') {
      var scanning = report.phase === 'scan';
      return {
        wait: true,
        flag: false,
        num: scanning ? 'идёт' : vtReports === null ? '...' : 'нет',
        of: '',
        title: vtReports === null ? 'Загрузка' : scanning ? 'Проверяется' : 'Отчёта пока нет',
        sub: vtReports === null ? 'VirusTotal' : scanning ? 'движки ещё отвечают' : 'сборка ' + (known.version || ''),
        label: scanning ? 'Проверка VirusTotal ещё идёт' : 'Отчёта VirusTotal для этой сборки ещё нет',
      };
    }
    var total = vtTotal(report);
    var clean = !report.malicious && !report.suspicious;
    var num = report.malicious > 0 ? String(report.malicious) : String(report.suspicious || 0);
    var title = 'Чисто';
    var sub = vtWhen(report.scannedAt, false);
    if (known.sha) sub = (sub ? sub + ' · ' : '') + vtShortSha(known.sha);
    if (report.malicious > 0) {
      title = 'Есть ' + vtPlural(report.malicious, 'срабатывание', 'срабатывания', 'срабатываний');
      sub = report.suspicious > 0
        ? 'ещё ' + report.suspicious + ' ' + vtPlural(report.suspicious, 'подозрительный', 'подозрительных', 'подозрительных')
        : vtWhen(report.scannedAt, false);
    } else if (report.suspicious > 0) {
      title = 'Есть ' + vtPlural(report.suspicious, 'подозрение', 'подозрения', 'подозрений');
      sub = 'в отчёте только подозрение';
    }
    return {
      wait: false,
      flag: !clean,
      num: clean ? '0' : num,
      of: total ? 'из ' + total : '',
      title: title,
      sub: sub,
      total: total,
      label: clean ? 'Чисто, 0 из ' + total : title + ', ' + num + ' из ' + total,
    };
  }

  function vtNote(report, version) {
    if (report.status !== 'ready') {
      if (report.phase === 'scan') return 'Файл уже можно скачать. Цифры появятся на этом месте, когда движки закончат.';
      return 'Для сборки ' + version + ' сохранённого отчёта ещё нет. Сюда попадёт проверка этого хеша, когда она будет готова.';
    }
    if (!report.malicious && !report.suspicious) {
      return 'Это ответ VirusTotal по хешу файла. Подпись издателя остаётся отдельным вопросом, а каждая новая сборка считается заново.';
    }
    return 'Так часть антивирусов реагирует на установщик без подписи. В списке только движки, которые сработали.';
  }

  function vtHeroLine(report) {
    if (report.status !== 'ready') {
      return report.phase === 'scan' ? 'Движки ещё отвечают' : 'Для этой сборки отчёта ещё нет';
    }
    if (report.malicious > 0) {
      return vtPlural(report.malicious, 'движок пометил файл как вредоносный', 'движка пометили файл как вредоносный', 'движков пометили файл как вредоносный');
    }
    if (report.suspicious > 0) {
      return vtPlural(report.suspicious, 'движок отметил файл как подозрительный', 'движка отметили файл как подозрительный', 'движков отметили файл как подозрительный');
    }
    return 'Движки ничего не пометили';
  }

  function vtApply(key) {
    var btn = document.querySelector('.vt[data-vt="' + key + '"], .alt__vt[data-vt="' + key + '"]');
    var known = vtKnown[key];
    if (!btn || !known || !known.sha) return;
    var report = vtResolve(key);
    var view = vtView(report, known);
    btn.hidden = false;
    btn.classList.toggle('is-flag', view.flag);
    btn.classList.toggle('is-wait', view.wait);
    var count = btn.querySelector('[data-vt-count]');
    count.textContent = view.wait || !view.total ? view.num : view.num + '/' + view.total;
    var title = btn.querySelector('[data-vt-title]');
    var sub = btn.querySelector('[data-vt-sub]');
    if (title) title.textContent = view.title;
    if (sub) sub.textContent = view.sub;
    btn.setAttribute('aria-label', VT_FILES[key].short + ', ' + view.label + '. Подробный отчёт');
    if (vtOpen === key) vtRenderReport(key);
  }

  function vtRenderAll() {
    Object.keys(VT_FILES).forEach(vtApply);
  }

  function vtRenderReport(key) {
    var reportEl = $('#vtreport');
    var file = VT_FILES[key];
    var known = vtKnown[key] || {};
    var report = vtResolve(key);
    var view = vtView(report, known);
    var version = known.version || '';
    reportEl.classList.toggle('is-flag', view.flag);
    reportEl.classList.toggle('is-wait', view.wait);
    reportEl.replaceChildren();

    var head = vtEl('div', 'vtreport__head');
    var intro = vtEl('div');
    intro.appendChild(vtText('div', 'label', 'Отчёт VirusTotal'));
    intro.appendChild(vtText('p', 'vtreport__file', file.os + (version ? ' · v' + version : '') + ' · ' + file.short));
    var hero = vtEl('div', 'vtreport__hero');
    hero.appendChild(vtText('b', '', view.num));
    var heroText = vtEl('div');
    if (view.of) heroText.appendChild(vtText('div', 'vtreport__of', view.of));
    heroText.appendChild(vtText('div', 'vtreport__line', vtHeroLine(report)));
    hero.appendChild(heroText);
    head.appendChild(intro);
    head.appendChild(hero);
    reportEl.appendChild(head);

    var nav = vtEl('div', 'vtfiles');
    nav.setAttribute('role', 'group');
    nav.setAttribute('aria-label', 'Файл отчёта');
    Object.keys(VT_FILES).forEach(function (name) {
      var button = vtEl('button', 'vtfile');
      button.type = 'button';
      button.setAttribute('data-vt', name);
      var diamond = vtEl('span', 'diamond');
      diamond.setAttribute('aria-hidden', 'true');
      button.appendChild(diamond);
      button.appendChild(document.createTextNode(VT_FILES[name].short));
      nav.appendChild(button);
    });
    reportEl.appendChild(nav);

    if (report.status === 'ready') {
      var stats = vtEl('dl', 'vtstats');
      [
        ['Вредоносные', report.malicious || 0, (report.malicious || 0) > 0],
        ['Подозрительные', report.suspicious || 0, (report.suspicious || 0) > 0],
        ['Без детекта', report.undetected || 0, false],
        ['Без угрозы', report.harmless || 0, false],
      ].forEach(function (row) {
        var cell = vtEl('div');
        cell.appendChild(vtText('dt', '', row[0]));
        cell.appendChild(vtText('dd', row[2] ? 'is-hot' : '', String(row[1])));
        stats.appendChild(cell);
      });
      reportEl.appendChild(stats);
      var hits = report.hits || [];
      if (hits.length) {
        reportEl.appendChild(vtText('div', 'vtengines__title', 'Кто сработал'));
        var list = vtEl('ul', 'vtengines');
        hits.forEach(function (hit) {
          var item = vtEl('li');
          var kind = hit.category === 'suspicious' ? 'подозрительный' : 'вредоносный';
          item.appendChild(vtText('span', '', hit.name || 'Движок'));
          item.appendChild(vtText('span', '', kind + (hit.verdict ? ' · ' + hit.verdict : '')));
          list.appendChild(item);
        });
        reportEl.appendChild(list);
      }
    }

    var sha = known.sha || report.sha || '';
    if (sha) {
      var hash = vtEl('div', 'vthash');
      var hashBody = vtEl('div');
      hashBody.appendChild(vtText('div', 'label', 'SHA256'));
      hashBody.appendChild(vtText('code', '', sha));
      var when = report.scannedAt
        ? vtWhen(report.scannedAt, true)
        : report.phase === 'scan'
          ? 'Снимок появится, когда проверка закончится'
          : 'Этого хеша в снимках ещё нет';
      var filename = known.filename || '';
      hashBody.appendChild(vtText('div', 'vthash__when', filename ? when + ' · ' + filename : when));
      var copy = vtEl('button', 'copy');
      copy.type = 'button';
      copy.textContent = 'Копировать';
      copy.setAttribute('data-copy-hash', sha);
      hash.appendChild(hashBody);
      hash.appendChild(copy);
      reportEl.appendChild(hash);
    }

    if (report.status === 'ready' && sha) {
      var actions = vtEl('div', 'vtreport__actions');
      var link = vtEl('a', 'btn btn--ghost btn--sm');
      link.href = 'https://www.virustotal.com/gui/file/' + sha;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.appendChild(vtText('span', '', 'Открыть на VirusTotal'));
      actions.appendChild(link);
      reportEl.appendChild(actions);
    }

    reportEl.appendChild(vtText('p', 'vtnote', vtNote(report, version)));
  }

  function vtPlaceReport() {
    var reportEl = $('#vtreport');
    var grid = $('.os-grid');
    if (!reportEl || !grid || !vtOpen) return;
    if (window.matchMedia('(max-width: 720px)').matches) {
      var card = $('[data-os="' + VT_FILES[vtOpen].group + '"]');
      if (card) card.after(reportEl);
    } else {
      grid.after(reportEl);
    }
  }

  function vtMarkOpen() {
    $$('[data-vt]').forEach(function (btn) {
      var on = !!vtOpen && btn.getAttribute('data-vt') === vtOpen;
      btn.classList.toggle('is-open', on);
      if (btn.classList.contains('vt') || btn.classList.contains('alt__vt')) {
        btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      }
    });
  }

  function vtOpenReport(key, fromUser) {
    var reportEl = $('#vtreport');
    if (!reportEl || !VT_FILES[key]) return;
    vtOpen = key;
    vtPlaceReport();
    vtRenderReport(key);
    reportEl.hidden = false;
    vtMarkOpen();
    if (fromUser && !REDUCED) reportEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function vtCloseReport() {
    var reportEl = $('#vtreport');
    vtOpen = null;
    if (reportEl) reportEl.hidden = true;
    vtMarkOpen();
  }

  function initVt() {
    if (vtEventsReady || !$('#vtreport')) return;
    vtEventsReady = true;
    document.addEventListener('click', function (e) {
      var copyBtn = e.target.closest('[data-copy-hash]');
      if (copyBtn) {
        var idle = 'Копировать';
        copyText(copyBtn.getAttribute('data-copy-hash')).then(function () {
          copyBtn.textContent = 'Скопировано';
          copyBtn.classList.add('is-done');
          window.setTimeout(function () {
            copyBtn.textContent = idle;
            copyBtn.classList.remove('is-done');
          }, 1600);
        });
        return;
      }
      var button = e.target.closest('[data-vt]');
      if (!button || !VT_FILES[button.getAttribute('data-vt')]) return;
      var key = button.getAttribute('data-vt');
      if (vtOpen === key && !button.classList.contains('vtfile')) {
        vtCloseReport();
        return;
      }
      vtOpenReport(key, true);
    });
    window.addEventListener('resize', function () {
      if (vtOpen) vtPlaceReport();
    });
    var trustUrl = CONFIG.trustUrl || '/trust.json';
    if (!window.fetch) {
      vtReports = {};
      vtRenderAll();
      return;
    }
    fetch(trustUrl, { headers: { Accept: 'application/json' } })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        vtReports = (data && data.reports) || {};
        vtRenderAll();
      })
      .catch(function () {
        vtReports = {};
        vtRenderAll();
      });
  }

  /* ---------- Downloads ---------- */

  function detectOs() {
    var ua = navigator.userAgent || '';
    if (/Android/i.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && 'ontouchend' in document)) return 'ios';
    if (/Windows/i.test(ua)) return 'windows';
    if (/Macintosh|Mac OS X/i.test(ua)) return 'mac';
    return 'other';
  }

  function setDownload(key, url, version) {
    $$('[data-dl="' + key + '"]').forEach(function (a) {
      a.href = url;
    });
    var file = url.split('/').pop() || '';
    var tail = file.replace(/^AegisGate-.*?-(windows|android)-/, '').replace(/^amd64-/, '');
    $$('[data-dl-label="' + key + '"]').forEach(function (el) {
      el.textContent = 'v' + version + ' · ' + tail;
    });
  }

  function rememberDownload(key, url, version, sha) {
    if (url && version) setDownload(key, url, version);
    if (!vtKnown[key]) vtKnown[key] = {};
    if (url) {
      vtKnown[key].url = url;
      vtKnown[key].filename = url.split('/').pop() || '';
    }
    if (version) vtKnown[key].version = version;
    if (sha && /^[a-f0-9]{64}$/i.test(sha)) vtKnown[key].sha = sha.toLowerCase();
    vtApply(key);
  }

  function initDownloads() {
    if (!$('[data-dl]')) return;
    var os = detectOs();
    var mine = os === 'android' ? 'android' : os === 'windows' ? 'windows' : null;
    $$('[data-os]').forEach(function (tile) {
      var is = tile.getAttribute('data-os') === mine;
      tile.classList.toggle('is-mine', is);
      var btn = $('.btn', tile);
      if (btn) btn.classList.toggle('btn--ghost', !is && mine !== null);
    });
    var note = $('[data-os-note]');
    if (note) {
      note.textContent = mine
        ? 'Систему определили по браузеру. Приложение бесплатное — без подписки оно просто не подключится.'
        : 'Сейчас приложение есть для Windows и Android. Для других систем версии пока нет.';
    }

    var fb = CONFIG.downloads || {};
    var api = CONFIG.latestApi;
    var shaFb = fb.sha256 || {};
    var androidSha = shaFb.android || {};
    var targets = [
      ['windows', 'windows', 'amd64', fb.windows, shaFb.windows],
      ['android-arm64', 'android', 'arm64', fb.android && fb.android.arm64, androidSha.arm64],
      ['android-arm', 'android', 'arm', fb.android && fb.android.arm, androidSha.arm],
      ['android-x64', 'android', 'x64', fb.android && fb.android.x64, androidSha.x64],
    ];
    targets.forEach(function (t) {
      if (t[3]) rememberDownload(t[0], t[3], fb.version, t[4]);
    });
    if ($('#vtreport')) initVt();
    if (!api || !window.fetch) return;
    targets.forEach(function (t) {
      var url = api + '?platform=' + t[1] + '&arch=' + t[2] + '&channel=' + encodeURIComponent(CONFIG.channel || 'stable');
      fetch(url, { headers: { Accept: 'application/json' } })
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (data) {
          if (data && data.url && data.version && /^https:\/\//.test(data.url)) {
            rememberDownload(t[0], data.url, data.version, data.sha256 || t[4]);
          }
        })
        .catch(function () {});
    });
  }

  /* ---------- Copy message ---------- */

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      ta.remove();
      if (ok) resolve();
      else reject(new Error('copy failed'));
    });
  }

  function initCopy() {
    $$('[data-copy]').forEach(function (btn) {
      var source = $(btn.getAttribute('data-copy'));
      var idle = btn.textContent;
      btn.addEventListener('click', function () {
        copyText(source.textContent.trim()).then(function () {
          btn.textContent = 'Скопировано';
          btn.classList.add('is-done');
          window.setTimeout(function () {
            btn.textContent = idle;
            btn.classList.remove('is-done');
          }, 1600);
        });
      });
    });
  }

  /* ---------- Config-driven links ---------- */

  function initLinks() {
    if (CONFIG.telegram) {
      $$('[data-tg]').forEach(function (a) {
        var text = a.getAttribute('data-tg');
        a.href = CONFIG.telegram + (text ? '?text=' + encodeURIComponent(text) : '');
      });
    }
    if (CONFIG.email) {
      $$('[data-support-email]').forEach(function (a) {
        a.href = 'mailto:' + CONFIG.email;
        a.textContent = CONFIG.email;
      });
    }
  }

  function init() {
    initLinks();
    initHeader();
    initShields();
    initDemos();
    initWizard();
    initAppMock();
    initDownloads();
    initCopy();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
