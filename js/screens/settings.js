/* Cài đặt thông báo — Cá nhân → Hỗ trợ & Cài đặt → Thông báo (#/settings/notifications, ảnh 21). */
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
    order: svg('<rect x="5" y="8" width="14" height="12" rx="2"/><path d="M9 8V6.5A3 3 0 0 1 15 6.5V8"/>'),
    promo: svg('<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M12 7v13M5 11h14"/><path d="M12 7c0-2 1.2-3.5 2.8-3.5C16.6 3.5 18 5 18 7M12 7C12 5 10.8 3.5 9.2 3.5 7.4 3.5 6 5 6 7"/>'),
    system: svg('<path d="M6.5 16.5v-5a5.5 5.5 0 0 1 11 0v5l1.4 1.5H5.1z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>'),
    sound: svg('<path d="M4.5 10.5v3h3l4 3.5v-10l-4 3.5z"/><path d="M15.2 9.2a4.2 4.2 0 0 1 0 5.6M17.4 7.2a7 7 0 0 1 0 9.6"/>')
  };

  function switchHtml(key, on) {
    return '<label class="ns-switch">' +
      '<input type="checkbox" data-ns-key="' + esc(key) + '"' + (on ? ' checked' : '') + '>' +
      '<span></span></label>';
  }
  function textHtml(title, hint) {
    return '<div class="ns-text"><b>' + esc(title) + '</b>' + (hint ? '<small>' + esc(hint) + '</small>' : '') + '</div>';
  }
  function soonRow(icon, title, hint) {
    return '<button type="button" class="ns-row is-soon" data-ns-soon>' +
      '<span class="ns-ico">' + ICO[icon] + '</span>' +
      textHtml(title, hint) +
      '<span class="ns-soon">' + esc(t('common.comingSoon')) + '</span></button>';
  }
  function soundRow(on) {
    return '<div class="ns-row">' +
      '<span class="ns-ico">' + ICO.sound + '</span>' +
      textHtml(t('ns.sound'), '') +
      switchHtml('sound_vibrate', on) +
    '</div>';
  }

  function paintNoti(root, st) {
    root.innerHTML = C.header(t('ns.title'), { back: true }) +
      '<main class="page ns-page"><section class="ns-card">' +
        soonRow('order', t('ns.order'), t('ns.order.hint')) +
        soonRow('promo', t('ns.promo'), t('ns.promo.hint')) +
        soonRow('system', t('ns.system'), t('ns.system.hint')) +
        soundRow(st.sound_vibrate) +
      '</section></main>';
    var back = root.querySelector('[data-back]');
    if (back) back.setAttribute('data-back-fallback', '/profile');
  }

  function renderNoti() {
    var root = app();
    root.innerHTML = C.header(t('ns.title'), { back: true }) + '<main class="page ns-page">' + C.loading(t('common.loading')) + '</main>';
    TTV.api.getNotificationSettings().then(function (st) {
      paintNoti(root, st);
    }).catch(function (err) {
      root.innerHTML = C.header(t('ns.title'), { back: true }) +
        '<main class="page ns-page">' + C.emptyState(t('ns.loadError'), (err && err.message) || '') + '</main>';
    });
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-ns-soon]')) return;
    C.toast(t('common.comingSoon'));
  });
  document.addEventListener('change', function (e) {
    var input = e.target.closest('[data-ns-key]');
    if (!input || input.getAttribute('data-ns-key') !== 'sound_vibrate') return;
    var patch = { sound_vibrate: !!input.checked };
    input.disabled = true;
    TTV.api.saveNotificationSettings(patch).then(function () {
      input.disabled = false;
    }).catch(function (err) {
      input.checked = !input.checked;
      input.disabled = false;
      C.toast((err && err.message) || t('common.error'), 'danger');
    });
  });

  TTV.screens.settings = { renderNoti: renderNoti, destroy: function () {} };
  TTV.Router.add('/settings/notifications', renderNoti, customerOnly);
})(window.TTV);
