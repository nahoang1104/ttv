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
  var tabsScroll = 0;
  var tabsSwipeOff = null;

  function esc(v) { return TTV.Components.escape(v); }
  function t(key, vars) { return TTV.I18n.t(key, vars); }
  function money(n) { return TTV.Utils.money(n); }

  function serviceIcon(code) {
    var photos = {
      moving: 'uploads/img-giaodien/chuyennha.png',
      warehouse: 'uploads/img-giaodien/bocxepkho1.png',
      furniture: 'uploads/img-giaodien/noithat.png',
      office: 'uploads/img-giaodien/vanphong.png',
      construction: 'uploads/img-giaodien/congtrinh.png',
      hourly: 'uploads/img-giaodien/theogio.png',
      goods: 'uploads/img-giaodien/bocvachanghoa.png'
    };
    var src = photos[code] || photos.goods;
    return '<img src="' + esc(src) + '" alt="">';
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
    var prevTabs = rootEl.querySelector('.jobs-tabs');
    if (prevTabs) tabsScroll = prevTabs.scrollLeft;
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
      '<div class="jobs-tabs" role="tablist">' + tabs.map(function (tb) {
        return '<button type="button" class="jobs-tab' + (tab === tb.id ? ' is-on' : '') + '" data-jobs-tab="' + tb.id + '" role="tab" aria-selected="' + (tab === tb.id) + '">' + esc(tb.label) + '</button>';
      }).join('') + '</div>' +
      '<main class="jobs-page">' +
        '<label class="jobs-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="m16 16 4 4"/></svg>' +
          '<input type="search" data-jobs-q placeholder="' + esc(t('orders.search')) + '" value="' + esc(q) + '">' +
        '</label>' +
        '<div class="jobs-list">' + listHtml() + '</div>' +
      '</main>' +
      TTV.Components.bottomTab('history');
    bind();
  }

  function showActiveTab(el) {
    var btn = el.querySelector('.jobs-tab.is-on');
    if (!btn) { el.scrollLeft = tabsScroll; return; }
    var pad = 16;
    var left = btn.offsetLeft;
    var right = left + btn.offsetWidth;
    var viewL = el.scrollLeft;
    var viewR = viewL + el.clientWidth;
    if (left < viewL + pad) el.scrollLeft = Math.max(0, left - pad);
    else if (right > viewR - pad) el.scrollLeft = right - el.clientWidth + pad;
  }

  function bindTabsSwipe(el) {
    if (tabsSwipeOff) tabsSwipeOff();
    var x0 = 0, left0 = 0, pid = null, moved = false, btn = null;
    function onMove(e) {
      if (pid == null || e.pointerId !== pid) return;
      var dx = e.clientX - x0;
      if (!moved && Math.abs(dx) < 14) return;
      moved = true;
      el.scrollLeft = left0 - dx;
    }
    function onUp(e) {
      if (pid == null || (e && e.pointerId !== pid)) return;
      pid = null;
      if (!moved && btn) {
        var id = btn.getAttribute('data-jobs-tab');
        if (id && id !== tab) {
          tab = id;
          paint();
        }
      }
      btn = null;
      moved = false;
    }
    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pid = e.pointerId;
      x0 = e.clientX;
      left0 = el.scrollLeft;
      moved = false;
      btn = e.target.closest('[data-jobs-tab]');
    });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    tabsSwipeOff = function () {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      tabsSwipeOff = null;
    };
  }

  function bind() {
    if (!rootEl) return;
    var tabsEl = rootEl.querySelector('.jobs-tabs');
    if (tabsEl) {
      bindTabsSwipe(tabsEl);
      showActiveTab(tabsEl);
    }
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
    if (e.target.closest('[data-jobs-tab]')) return;
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
      TTV.Router.navigate('/orders/' + open.getAttribute('data-open'));
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
      if (tabsSwipeOff) tabsSwipeOff();
      rootEl = null;
      orders = [];
    }
  };
})(window.TTV);
