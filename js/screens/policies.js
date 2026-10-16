/* Điều khoản & Chính sách — #/policies?tab=terms|privacy|refund (ảnh 27). Tab Điều khoản làm trước. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components, esc = C.escape;
  var TABS = [
    { id: 'terms', label: 'policy.tab.terms' },
    { id: 'privacy', label: 'policy.tab.privacy' },
    { id: 'refund', label: 'policy.tab.refund' }
  ];

  function t(key, params) { return TTV.I18n.t(key, params); }
  function tabOf(ctx) {
    var q = ctx && ctx.query && String(ctx.query.tab || '').toLowerCase();
    if (q === 'privacy' || q === 'refund' || q === 'terms') return q;
    return 'terms';
  }
  function updatedLine(iso) {
    var d = new Date(iso);
    if (!isFinite(d.getTime())) return '';
    function p(n) { return (n < 10 ? '0' : '') + n; }
    var text = p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
    return '<p class="pol-updated">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path fill="none" stroke="currentColor" stroke-width="1.7" d="M8 3.5v3M16 3.5v3M4 10h16"/></svg>' +
      '<span>' + esc(t('policy.updated')) + ' <b>' + esc(text) + '</b></span></p>';
  }
  function bodyHtml(row) {
    if (!row) return '<p class="pol-empty">' + esc(t('policy.empty')) + '</p>';
    var sections = Array.isArray(row.sections) ? row.sections : [];
    var inner;
    if (sections.length) {
      inner = sections.map(function (sec) {
        var paras = (sec.paras || []).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
        var head = sec.title ? '<h3>' + esc(sec.title) + '</h3>' : '';
        return '<section class="pol-sec">' + head + paras + '</section>';
      }).join('');
    } else if (row.content) {
      inner = '<section class="pol-sec"><p>' + esc(row.content) + '</p></section>';
    } else {
      inner = '<p class="pol-empty">' + esc(t('policy.empty')) + '</p>';
    }
    return inner + updatedLine(row.updated_at);
  }

  TTV.screens = TTV.screens || {};
  TTV.screens.policies = {
    bodyHtml: bodyHtml,
    render: function (container, ctx) {
      this.destroy();
      var root = container || document.getElementById('app');
      var tab = tabOf(ctx);
      root.classList.remove('is-wide');
      root.innerHTML = C.header(t('policy.title'), { back: true }) +
        '<main class="page pol-page">' + C.loading(t('common.loading')) + '</main>';
      TTV.api.getPolicy(tab).then(function (row) {
        var tabs = '<div class="pol-tabs" role="tablist">' + TABS.map(function (it) {
          var on = it.id === tab;
          return '<button type="button" role="tab" class="pol-tab' + (on ? ' is-on' : '') + '"' +
            (on ? ' aria-selected="true"' : ' aria-selected="false"') +
            ' data-pol-tab="' + it.id + '">' + esc(t(it.label)) + '</button>';
        }).join('') + '</div>';
        root.innerHTML = C.header(t('policy.title'), { back: true }) +
          '<main class="page pol-page">' + tabs +
          '<article class="pol-card">' + bodyHtml(row) + '</article></main>';
        var back = root.querySelector('[data-back]');
        if (back) back.setAttribute('data-back-fallback', '/profile');
      }).catch(function (err) {
        root.innerHTML = C.header(t('policy.title'), { back: true }) +
          '<main class="page pol-page">' + C.emptyState(t('policy.loadError'), (err && err.message) || '') + '</main>';
      });
    },
    destroy: function () {}
  };

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-pol-tab]');
    if (!btn) return;
    var next = btn.getAttribute('data-pol-tab');
    if (!next) return;
    TTV.Router.navigate('/policies?tab=' + next, { replace: true });
  });

  TTV.Router.add('/policies', function (ctx) {
    TTV.screens.policies.render(document.getElementById('app'), ctx);
  }, { roles: ['CUSTOMER'], loginRoute: '/login', deniedRoute: '/login', destroy: function () { TTV.screens.policies.destroy(); } });
})(window.TTV);
