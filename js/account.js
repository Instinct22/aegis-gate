(function () {
  var login = document.querySelector('[data-account-login]');
  var app = document.querySelector('[data-account-app]');
  if (!login || !app) return;

  var error = document.querySelector('[data-account-error]');
  var names = { telegram: 'Telegram', google: 'Google', yandex: 'Яндекс' };

  function showError(text) {
    if (error) error.textContent = text || '';
  }

  function wantsLogin() {
    return window.location.hash === '#login';
  }

  function showCabinet(data) {
    if (wantsLogin() && window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    login.hidden = true;
    app.hidden = false;
    app.querySelectorAll('[data-account-name]').forEach(function (node) {
      node.textContent = data.display_name || 'Личный кабинет';
    });
    var code = app.querySelector('[data-account-code]');
    var url = app.querySelector('[data-sub-url]');
    if (code) code.textContent = data.cabinet_account_id || '';
    if (url) url.textContent = data.sub_url || '';
    var list = app.querySelector('[data-identities]');
    if (list) {
      list.replaceChildren();
      (data.identities || []).forEach(function (item) {
        var row = document.createElement('div');
        row.className = 'account-kv';
        var title = document.createElement('b');
        title.textContent = names[item.provider] || item.provider;
        var value = document.createElement('span');
        value.textContent = 'Подключён';
        row.append(title, value);
        list.append(row);
      });
    }
    document.querySelectorAll('[data-account-link] span').forEach(function (label) {
      label.textContent = 'Личный кабинет';
    });
  }

  function showLogin() {
    login.hidden = false;
    app.hidden = true;
    document.querySelectorAll('[data-account-link] span').forEach(function (label) {
      label.textContent = 'Войти';
    });
  }

  document.querySelectorAll('[data-enter]').forEach(function (button) {
    button.addEventListener('click', function () {
      var provider = button.getAttribute('data-enter');
      var nonce = String(Date.now()) + Math.random().toString(16).slice(2);
      var width = 480;
      var height = 720;
      var left = Math.max(0, (screen.width - width) / 2);
      var top = Math.max(0, (screen.height - height) / 2);
      var features = 'popup=yes,width=' + width + ',height=' + height + ',left=' + left + ',top=' + top;
      var popup = window.open('/auth/' + provider + '?nonce=' + encodeURIComponent(nonce), 'aegis-auth', features);
      if (!popup) {
        window.location.assign('/auth/' + provider);
        return;
      }
      function finish(payload) {
        if (!payload || payload.nonce !== nonce) return;
        nonce = '';
        if (payload.error) {
          showError(payload.error);
          return;
        }
        fetch('/api/me', { headers: { Accept: 'application/json' } })
          .then(function (response) { return response.ok ? response.json() : null; })
          .then(function (data) {
            if (data && data.account_id) showCabinet(data);
          });
        try { popup.close(); } catch (ignore) {}
      }
      function onMessage(event) {
        if (event.origin !== window.location.origin) return;
        if (!event.data || event.data.type !== 'aegis-auth') return;
        finish(event.data);
      }
      function onStorage(event) {
        if (event.key !== 'aegis-auth-done' || !event.newValue) return;
        try { finish(JSON.parse(event.newValue)); } catch (ignore) {}
      }
      window.addEventListener('message', onMessage);
      window.addEventListener('storage', onStorage);
    });
  });

  var screen = 'overview';
  function paintScreen() {
    app.setAttribute('data-screen', screen);
    app.querySelectorAll('[data-go]').forEach(function (button) {
      if (button.getAttribute('data-go') === screen) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }

  app.querySelectorAll('[data-go]').forEach(function (button) {
    button.addEventListener('click', function () {
      var next = button.getAttribute('data-go');
      if (next === 'login') {
        fetch('/api/logout', { method: 'POST' }).finally(showLogin);
        return;
      }
      screen = next;
      paintScreen();
    });
  });

  var copy = document.querySelector('[data-copy-sub]');
  if (copy) {
    copy.addEventListener('click', function () {
      var url = (document.querySelector('[data-sub-url]') || {}).textContent || '';
      var label = copy.querySelector('span');
      var previous = label ? label.textContent : '';
      if (navigator.clipboard && url) navigator.clipboard.writeText(url).catch(function () {});
      if (label) label.textContent = 'Скопировано';
      window.setTimeout(function () {
        if (label) label.textContent = previous;
      }, 1400);
    });
  }

  var params = new URLSearchParams(window.location.search);
  if (params.get('auth_error')) showError(params.get('auth_error'));

  fetch('/api/me', { headers: { Accept: 'application/json' } })
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (data) {
      if (data && data.account_id && !wantsLogin()) showCabinet(data);
      else showLogin();
      paintScreen();
    })
    .catch(function () {
      showLogin();
      showError('Личный кабинет сейчас недоступен');
    });
})();
