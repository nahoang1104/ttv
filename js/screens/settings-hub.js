/* Cài đặt chung — Cá nhân → bánh răng / menu Cài đặt (#/settings, ảnh 17). Chỉ giao diện. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components, esc = C.escape;
  var customerOnly = { roles: ['CUSTOMER'], loginRoute: '/login', deniedRoute: '/login' };

  function t(key, params) { return TTV.I18n.t(key, params); }
  function app() { var el = document.getElementById('app'); el.classList.remove('is-wide'); return el; }
  function svg(inner) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }
  var ICO = {
    globe: svg('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.8 2.6 4.2 5.5 4.2 8.5s-1.4 5.9-4.2 8.5M12 3.5C9.2 6.1 7.8 9 7.8 12s1.4 5.9 4.2 8.5"/>'),
    palette: svg('<path d="M12 3.8A8.2 8.2 0 1 0 12 20.2c1.1 0 1.6-.8 1.6-1.6 0-.5-.2-1-.2-1.5 0-1.2 1.1-1.7 2.2-1.7h.8A4.6 4.6 0 0 0 20.2 10 8.2 8.2 0 0 0 12 3.8z"/><circle cx="8.2" cy="10.2" r="1.15" fill="currentColor" stroke="none"/><circle cx="12" cy="7.6" r="1.15" fill="currentColor" stroke="none"/><circle cx="15.8" cy="10.2" r="1.15" fill="currentColor" stroke="none"/><circle cx="9.5" cy="14.4" r="1.15" fill="currentColor" stroke="none"/>'),
    sun: svg('<circle cx="12" cy="12" r="3.2"/><path d="M12 4.5v1.6M12 17.9v1.6M4.5 12h1.6M17.9 12h1.6M6.4 6.4l1.1 1.1M16.5 16.5l1.1 1.1M17.6 6.4l-1.1 1.1M7.5 16.5l-1.1 1.1"/>'),
    moon: svg('<path d="M15.5 4.8A7.6 7.6 0 1 0 19 16.2 6.2 6.2 0 0 1 15.5 4.8z"/>'),
    trash: svg('<path d="M5 7.5h14M9.5 7.5V5.8A1.3 1.3 0 0 1 10.8 4.5h2.4A1.3 1.3 0 0 1 14.5 5.8V7.5M8 7.5l.7 11.2h6.6L16 7.5"/>'),
    info: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.2M12 8.2v.2"/>'),
    chev: svg('<path d="m9.5 6 6 6-6 6"/>'),
    logout: svg('<path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10"/><path d="M14 8l4 4-4 4M18 12H9.5"/>')
  };

  function ico(name) { return '<span class="st-ico">' + ICO[name] + '</span>'; }
  function row(action, icon, title, extra) {
    return '<button type="button" class="st-row" data-st="' + esc(action) + '">' +
      ico(icon) +
      '<span class="st-text"><b>' + esc(title) + '</b>' + (extra && extra.hint ? '<small>' + esc(extra.hint) + '</small>' : '') + '</span>' +
      (extra && extra.value ? '<span class="st-val">' + esc(extra.value) + '</span>' : '') +
      '<span class="st-chev">' + ICO.chev + '</span></button>';
  }

  function markup() {
    return C.header(t('set.title'), { back: true }) +
      '<main class="page st-page">' +
        '<h2 class="st-sec">' + esc(t('set.general')) + '</h2>' +
        '<section class="st-card">' +
          row('lang', 'globe', t('set.lang'), { value: t('set.lang.vi') }) +
          '<div class="st-theme-block">' +
            '<div class="st-row st-row--static">' + ico('palette') + '<span class="st-text"><b>' + esc(t('set.theme')) + '</b></span></div>' +
            '<div class="st-themes" role="group" aria-label="' + esc(t('set.theme')) + '">' +
              '<button type="button" class="st-theme is-on" data-st-theme="light">' + ICO.sun + '<span>' + esc(t('set.theme.light')) + '</span></button>' +
              '<button type="button" class="st-theme" data-st-theme="dark">' + ICO.moon + '<span>' + esc(t('set.theme.dark')) + '</span></button>' +
            '</div>' +
          '</div>' +
        '</section>' +
        '<h2 class="st-sec">' + esc(t('set.data')) + '</h2>' +
        '<section class="st-card">' +
          row('cache', 'trash', t('set.cache'), { hint: t('set.cache.hint') }) +
        '</section>' +
        '<h2 class="st-sec">' + esc(t('set.aboutSec')) + '</h2>' +
        '<section class="st-card">' +
          row('about', 'info', t('set.about'), { hint: t('set.version') }) +
        '</section>' +
        '<button type="button" class="st-logout" data-st="logout">' + ICO.logout + '<span>' + esc(t('profile.logout')) + '</span></button>' +
      '</main>';
  }

  function confirmLogout() {
    document.body.insertAdjacentHTML('beforeend', C.modal(t('profile.logout'), '<p>' + esc(t('profile.logout.confirm')) + '</p>', {
      footer: '<button type="button" class="btn btn-secondary" data-modal-close>' + esc(t('common.cancel')) + '</button>' +
        '<button type="button" class="btn btn-danger" data-st="logout-ok">' + esc(t('profile.logout')) + '</button>'
    }));
  }

  function render() {
    var root = app();
    root.innerHTML = markup();
    var back = root.querySelector('[data-back]');
    if (back) back.setAttribute('data-back-fallback', '/profile');
  }

  document.addEventListener('click', function (e) {
    var theme = e.target.closest('[data-st-theme]');
    if (theme) {
      var group = theme.parentNode;
      if (!group) return;
      group.querySelectorAll('.st-theme').forEach(function (btn) { btn.classList.toggle('is-on', btn === theme); });
      return;
    }
    var ok = e.target.closest('[data-st="logout-ok"]');
    if (ok) {
      var overlay = ok.closest('.modal-backdrop'); if (overlay) overlay.remove();
      TTV.api.logoutAndGo().then(function () { C.toast(t('profile.logout.done'), 'success'); });
      return;
    }
    var btn = e.target.closest('[data-st]');
    if (!btn) return;
    var act = btn.getAttribute('data-st');
    if (act === 'logout') { confirmLogout(); return; }
    if (act === 'about') { TTV.Router.navigate('/policies'); return; }
    if (act === 'lang' || act === 'cache') C.toast(t('common.comingSoon'));
  });

  TTV.screens.settingsHub = { render: render, destroy: function () {} };
  TTV.Router.add('/settings', render, customerOnly);
})(window.TTV);
