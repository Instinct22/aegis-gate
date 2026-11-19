(function () {
  var link = document.querySelector('[data-account-link]');
  if (!link) return;
  fetch('/api/me', { headers: { Accept: 'application/json' } })
    .then(function (response) {
      return response.ok ? response.json() : null;
    })
    .then(function (data) {
      if (!data || !data.account_id) return;
      var label = link.querySelector('span');
      if (label) label.textContent = 'Личный кабинет';
    })
    .catch(function () {});
})();
