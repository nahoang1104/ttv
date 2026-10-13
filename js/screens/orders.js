/* Danh sách đơn khách — #/orders (task 6.1). */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var rootEl = null;
  var orders = [];
  var services = {};
  var tab = 'all';
  var q = '';

  function esc(v) { return TTV.Components.escape(v); }
  function t(key, vars) { return TTV.I18n.t(key, vars); }
  function money(n) { return TTV.Utils.money(n); }

  function serviceIcon(code) {
    var icons = {
      moving: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#eef6ff"/><path fill="#1b7be4" d="M14 28.5V20l10-7 10 7v8.5h-4.2V24h-11.6v4.5z"/><path fill="#3d9cf0" d="M18.4 26.2h4.1v5.4h-4.1zm7.1 0h4.1v5.4h-4.1z"/><rect x="16.6" y="31.2" width="14.8" height="3.2" rx="1" fill="#f4b942"/></svg>',
      warehouse: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#eef6ff"/><path fill="#1b7be4" d="M12 29.5 24 18.2 36 29.5H12z"/><rect x="16" y="27" width="6.2" height="6.2" rx="1" fill="#f4b942"/><rect x="25.8" y="27" width="6.2" height="6.2" rx="1" fill="#f4b942"/></svg>',
      furniture: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#eef6ff"/><path fill="#1b7be4" d="M13 24c0-5 4.8-8.2 11-8.2S35 19 35 24v3.4H13V24z"/><rect x="12" y="26.8" width="24" height="5.2" rx="2" fill="#3d9cf0"/></svg>',
      office: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#eef6ff"/><path fill="#1b7be4" d="M17 33V18.5h14V33H17z"/></svg>',
      construction: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#eef6ff"/><rect x="14" y="26.5" width="20" height="8" rx="1.4" fill="#1b7be4"/></svg>',
      hourly: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#eef6ff"/><circle cx="24" cy="23" r="9.2" fill="none" stroke="#1b7be4" stroke-width="2.4"/></svg>',
      goods: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#eef6ff"/><rect x="16" y="18" width="16" height="12" rx="2" fill="#1b7be4"/></svg>'
    };
    return icons[code] || icons.goods;
  }
  function statusGroup(st) {
    if (st === 'finding') return 'finding';
    if (st === 'completed') return 'done';
    if (st === 'cancelled') return 'cancelled';
    return 'doing';
  }
  function statusMeta(st) {
    var g = statusGroup(st);
    if (g === 'finding') return { label: t('orders.status.finding'), cls: 'finding' };
    if (g === 'done') return { label: t('orders.status.done'), cls: 'done' };
    if (g === 'cancelled') return { label: t('orders.status.cancelled'), cls: 'cancelled' };
    return { label: t('orders.status.doing'), cls: 'doing' };
  }
  function shortAddr(s) {
    s = String(s || '').trim().replace(/\s+/g, ' ');
    if (s.length <= 42) return s;
    return s.slice(0, 40) + '…';
  }
  function fmtWhen(iso) {
    var d = new Date(iso);
    if (!isFinite(d.getTime())) return '';
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' · ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function monthKey(iso) {
    var d = new Date(iso);
    if (!isFinite(d.getTime())) return '0-0';
    return d.getFullYear() + '-' + (d.getMonth() + 1);
  }
  function monthLabel(key) {
    var p = String(key).split('-');
    return t('orders.month', { m: p[1], y: p[0] });
  }
  function serviceName(code) {
    var s = services[code];
    return (s && s.name) || code || 'Đơn bốc vác';
  }
  function matchesQuery(o) {
    var needle = q.trim().toLowerCase();
    if (!needle) return true;
    var code = String(o.code || TTV.Utils.orderCode(o.id) || '').replace(/^#/, '').toLowerCase();
    var pick = ((o.pickup && o.pickup.addr) || '').toLowerCase();
    var drop = ((o.dropoff && o.dropoff.addr) || '').toLowerCase();
    return code.indexOf(needle.replace(/^#/, '')) >= 0 || pick.indexOf(needle) >= 0 || drop.indexOf(needle) >= 0;
  }
  function visible() {
    return orders.filter(function (o) {
      if (tab !== 'all' && statusGroup(o.status) !== tab) return false;
      return matchesQuery(o);
    });
  }
  function grouped(list) {
    var map = {}, keys = [];
    list.forEach(function (o) {
      var k = monthKey(o.created_at);
      if (!map[k]) { map[k] = []; keys.push(k); }
      map[k].push(o);
    });
    keys.sort(function (a, b) { return a < b ? 1 : a > b ? -1 : 0; });
    return keys.map(function (k) { return { key: k, items: map[k] }; });
  }

  function cardHtml(o) {
    var st = statusMeta(o.status);
    var pick = (o.pickup && o.pickup.addr) || '—';
    var drop = (o.dropoff && o.dropoff.addr) || '—';
    var amt = o.final_price != null ? o.final_price : o.user_offer;
    var act = o.status === 'finding'
      ? '<button type="button" class="jobs-card__act jobs-card__act--follow" data-follow="' + esc(o.id) + '">' + esc(t('orders.follow')) + ' <span>›</span></button>'
      : '<button type="button" class="jobs-card__act jobs-card__act--reorder" data-reorder="' + esc(o.id) + '">' + esc(t('orders.reorder')) + ' <span>→</span></button>';
    return '<article class="jobs-card" data-open="' + esc(o.id) + '" data-status="' + esc(o.status) + '">' +
      '<div class="jobs-card__top">' +
        '<span class="jobs-card__ico">' + serviceIcon(o.service) + '</span>' +
        '<div class="jobs-card__main">' +
          '<div class="jobs-card__title"><strong>' + esc(serviceName(o.service)) + '</strong><span class="jobs-badge jobs-badge--' + st.cls + '">' + esc(st.label) + '</span></div>' +
          '<p class="jobs-card__when">' + esc(fmtWhen(o.created_at)) + '</p>' +
          '<p class="jobs-card__addr"><span class="jobs-dot jobs-dot--pick"></span>' + esc(shortAddr(pick)) + '</p>' +
          '<p class="jobs-card__addr"><span class="jobs-dot jobs-dot--drop"></span>' + esc(shortAddr(drop)) + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="jobs-card__foot"><b>' + money(amt) + '</b>' + act + '</div>' +
      '</article>';
  }

  function listHtml() {
    var list = visible();
    if (!orders.length) return TTV.Components.emptyState(t('orders.empty.title'), t('orders.empty.desc'));
    if (!list.length) return TTV.Components.emptyState(t('orders.empty.filter'), t('orders.empty.desc'));
    return grouped(list).map(function (g) {
      return '<h2 class="jobs-month">' + esc(monthLabel(g.key)) + '</h2>' + g.items.map(cardHtml).join('');
    }).join('');
  }

  function paint() {
    if (!rootEl) return;
    var tabs = [
      { id: 'all', label: t('orders.tab.all') },
      { id: 'finding', label: t('orders.tab.finding') },
      { id: 'doing', label: t('orders.tab.doing') },
      { id: 'done', label: t('orders.tab.done') },
      { id: 'cancelled', label: t('orders.tab.cancelled') }
    ];
    rootEl.innerHTML =
      '<header class="app-header">' +
        '<h1>' + esc(t('orders.title')) + '</h1>' +
        '<button type="button" class="app-header__action" data-orders-focus-search aria-label="' + esc(t('orders.search')) + '">' +
          '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="11" cy="11" r="6.2" fill="none" stroke="#fff" stroke-width="1.8"/><path fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" d="m16 16 4 4"/></svg>' +
        '</button>' +
      '</header>' +
      '<main class="jobs-page">' +
        '<div class="jobs-tabs" role="tablist">' + tabs.map(function (tb) {
          return '<button type="button" class="jobs-tab' + (tab === tb.id ? ' is-on' : '') + '" data-jobs-tab="' + tb.id + '" role="tab" aria-selected="' + (tab === tb.id) + '">' + esc(tb.label) + '</button>';
        }).join('') + '</div>' +
        '<label class="jobs-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="m16 16 4 4"/></svg>' +
          '<input type="search" data-jobs-q placeholder="' + esc(t('orders.search')) + '" value="' + esc(q) + '">' +
        '</label>' +
        '<div class="jobs-list">' + listHtml() + '</div>' +
      '</main>' +
      TTV.Components.bottomTab('history');
    bind();
  }

  function bind() {
    if (!rootEl) return;
    var input = rootEl.querySelector('[data-jobs-q]');
    if (input) {
      input.addEventListener('input', function () {
        q = input.value;
        var box = rootEl.querySelector('.jobs-list');
        if (box) box.innerHTML = listHtml();
      });
    }
  }

  function onClick(e) {
    if (!rootEl || !rootEl.contains(e.target)) return;
    var focus = e.target.closest('[data-orders-focus-search]');
    if (focus) {
      var inp = rootEl.querySelector('[data-jobs-q]');
      if (inp) { inp.focus(); inp.select(); }
      return;
    }
    var tb = e.target.closest('[data-jobs-tab]');
    if (tb) { tab = tb.getAttribute('data-jobs-tab'); paint(); return; }
    var follow = e.target.closest('[data-follow]');
    if (follow) {
      e.preventDefault();
      TTV.Router.navigate('/orders/' + follow.getAttribute('data-follow') + '/quotes');
      return;
    }
    var reorder = e.target.closest('[data-reorder]');
    if (reorder) {
      e.preventDefault();
      TTV.Router.navigate('/create/order?reorder=' + encodeURIComponent(reorder.getAttribute('data-reorder')));
      return;
    }
    var open = e.target.closest('[data-open]');
    if (open) {
      var id = open.getAttribute('data-open');
      var st = open.getAttribute('data-status');
      if (st === 'finding') TTV.Router.navigate('/orders/' + id + '/quotes');
    }
  }

  TTV.screens.orders = {
    render: function (container) {
      this.destroy();
      rootEl = container;
      tab = 'all';
      q = '';
      rootEl.innerHTML = TTV.Components.header(t('orders.title'), { back: false }) +
        '<main class="page">' + TTV.Components.loading(t('common.loading')) + '</main>' +
        TTV.Components.bottomTab('history');
      document.addEventListener('click', onClick);
      Promise.all([TTV.api.listMyOrders(), TTV.api.listServices()]).then(function (pack) {
        orders = pack[0] || [];
        services = {};
        (pack[1] || []).forEach(function (s) { services[s.code || s.id] = s; });
        paint();
      }).catch(function () {
        rootEl.innerHTML = TTV.Components.header(t('orders.title'), { back: false }) +
          '<main class="page">' + TTV.Components.emptyState(t('orders.err'), '') + '</main>' +
          TTV.Components.bottomTab('history');
      });
    },
    destroy: function () {
      document.removeEventListener('click', onClick);
      rootEl = null;
      orders = [];
    }
  };
})(window.TTV);
