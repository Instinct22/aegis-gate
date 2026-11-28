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
      var text = { closed: 'нет ответа', check: 'проверяем…', idle: 'в запасе' };
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

  /* ---------- Downloads ---------- */

  function detectOs() {
    var ua = navigator.userAgent || '';
    if (/Android/i.test(ua)) return 'android';
    if (/Windows/i.test(ua)) return 'windows';
    if (/Linux/i.test(ua) && !/CrOS/i.test(ua)) return 'linux';
    return null;
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

  function initDownloads() {
    if (!$('[data-dl]')) return;
    var mine = detectOs();
    $$('[data-os]').forEach(function (tile) {
      var is = tile.getAttribute('data-os') === mine;
      tile.classList.toggle('is-mine', is);
      $$('.btn', tile).forEach(function (btn) {
        btn.classList.toggle('btn--ghost', !is && mine !== null);
      });
    });
    var note = $('[data-os-note]');
    if (note) {
      note.textContent = mine
        ? 'Систему определили по браузеру. Приложение бесплатное — без подписки оно просто не подключится.'
        : 'Выберите приложение для Windows, Android или Linux.';
    }

    var fb = CONFIG.downloads || {};
    var api = CONFIG.latestApi;
    var targets = [
      ['windows', 'windows', 'amd64', fb.windows],
      ['android-arm64', 'android', 'arm64', fb.android && fb.android.arm64],
      ['android-arm', 'android', 'arm', fb.android && fb.android.arm],
      ['android-x64', 'android', 'x64', fb.android && fb.android.x64],
      ['linux-deb-amd64', 'linux-deb', 'amd64'],
      ['linux-deb-arm64', 'linux-deb', 'arm64'],
      ['linux-rpm-amd64', 'linux-rpm', 'amd64'],
      ['linux-rpm-arm64', 'linux-rpm', 'arm64'],
      ['linux-arch-amd64', 'linux-arch', 'amd64'],
    ];
    targets.forEach(function (t) {
      if (t[3]) setDownload(t[0], t[3], fb.version);
    });
    if (!api || !window.fetch) return;
    targets.forEach(function (t) {
      var url = api + '?platform=' + t[1] + '&arch=' + t[2] + '&channel=' + encodeURIComponent(CONFIG.channel || 'stable');
      fetch(url, { headers: { Accept: 'application/json' } })
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (data) {
          if (data && data.url && data.version && /^https:\/\//.test(data.url)) setDownload(t[0], data.url, data.version);
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
