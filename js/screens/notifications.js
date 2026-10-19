/* Màn Thông báo khách — #/notifications (task 9.1, ảnh 04). */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var rootEl = null;
  var items = [];
  var tab = 'all';
  var unwatch = null;
  var painted = false;

  function esc(v) { return TTV.Components.escape(v); }
  function t(key, vars) { return TTV.I18n.t(key, vars); }

  function catOf(row) {
    var c = String((row && row.category) || 'order');
    if (c === 'promo' || c === 'system' || c === 'order') return c;
    return 'order';
  }
  function catLabel(c) {
    if (c === 'promo') return t('noti.cat.promo');
    if (c === 'system') return t('noti.cat.system');
    return t('noti.cat.order');
  }
  function visible() {
    return items.filter(function (row) {
      return tab === 'all' || catOf(row) === tab;
    });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(iso) {
    var d = new Date(iso);
    if (!isFinite(d.getTime())) return '0';
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function dayLabel(key) {
    var now = new Date();
    var today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
    var y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    var yk = y.getFullYear() + '-' + pad(y.getMonth() + 1) + '-' + pad(y.getDate());
    if (key === today) return t('noti.today');
    if (key === yk) return t('noti.yesterday');
    var p = String(key).split('-');
    return t('noti.day', { d: Number(p[2]), m: Number(p[1]), y: p[0] });
  }
  function timeHm(iso) {
    var d = new Date(iso);
    if (!isFinite(d.getTime())) return '';
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function titleText(row) {
    var raw = String((row && row.title) || '');
    if (/đã được tạo/i.test(raw) && raw.indexOf('🎉') < 0) return '🎉 ' + raw;
    if (/Không tìm được thợ/i.test(raw) && raw.indexOf('⏰') < 0) return '⏰ ' + raw;
    if (/đã bị hủy/i.test(raw) && raw.indexOf('⏰') < 0) return '⏰ ' + raw;
    if (/Có đơn mới/i.test(raw) && raw.indexOf('📦') < 0) return '📦 ' + raw;
    if (/đã được chọn/i.test(raw) && raw.indexOf('🎉') < 0) return '🎉 ' + raw;
    if (/ghép thợ thành công/i.test(raw) && raw.indexOf('🎉') < 0) return '🎉 ' + raw;
    return raw;
  }
  function bodyText(row) {
    var body = String((row && row.body) || '');
    var code = row && row.order_id ? TTV.Utils.orderCode(row.order_id) : '';
    if (code) {
      body = body.replace(/Đơn\s+#?[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/ig, 'Đơn ' + code);
      body = body.replace(/Đơn\s+[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/ig, 'Đơn ' + code);
    }
    return body;
  }
  function grouped(list) {
    var map = {}, keys = [];
    list.forEach(function (row) {
      var k = dayKey(row.created_at);
      if (!map[k]) { map[k] = []; keys.push(k); }
      map[k].push(row);
    });
    keys.sort(function (a, b) { return a < b ? 1 : a > b ? -1 : 0; });
    return keys.map(function (k) { return { key: k, items: map[k] }; });
  }

  function rowHtml(row) {
    var unread = !row.is_read;
    return '<article class="nt-row' + (unread ? ' is-unread' : '') + '" data-nt-open="' + esc(row.id) + '">' +
      '<span class="nt-bell" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.7" d="M12 4.2a4.6 4.6 0 0 0-4.6 4.6v2.2c0 .8-.35 1.6-1 2.1l-.6.5c-.45.35-.2 1.15.5 1.15h10.4c.7 0 .95-.8.5 1.15l-.6-.5a3 3 0 0 1-1-2.1V8.8A4.6 4.6 0 0 0 12 4.2z"/><path fill="none" stroke="currentColor" stroke-width="1.7" d="M9.6 17.6a2.4 2.4 0 0 0 4.8 0"/></svg>' +
      '</span>' +
      '<div class="nt-main">' +
        '<p class="nt-cat">' + esc(catLabel(catOf(row))) + '</p>' +
        '<p class="nt-title">' + esc(titleText(row)) + '</p>' +
        '<p class="nt-body">' + esc(bodyText(row)) + '</p>' +
        '<p class="nt-time">' + esc(timeHm(row.created_at)) + '</p>' +
      '</div>' +
      '<div class="nt-side">' +
        (unread ? '<span class="nt-dot" aria-hidden="true"></span>' : '') +
        '<button type="button" class="nt-del" data-nt-del="' + esc(row.id) + '" aria-label="' + esc(t('noti.delete')) + '">' +
          '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.7" d="M5 7h14M10 7V5h4v2M8 7l.8 12h6.4L16 7"/></svg>' +
        '</button>' +
      '</div></article>';
  }

  function listHtml() {
    var list = visible();
    if (!list.length) {
      return '<div class="nt-empty">' +
        '<span class="nt-empty__ico" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M12 4.2a4.6 4.6 0 0 0-4.6 4.6v2.2c0 .8-.35 1.6-1 2.1l-.6.5c-.45.35-.2 1.15.5 1.15h10.4c.7 0 .95-.8.5 1.15l-.6-.5a3 3 0 0 1-1-2.1V8.8A4.6 4.6 0 0 0 12 4.2z"/><path fill="none" stroke="currentColor" stroke-width="1.6" d="M9.6 17.6a2.4 2.4 0 0 0 4.8 0"/></svg>' +
        '</span>' +
        '<h3>' + esc(t('noti.empty.title')) + '</h3>' +
        '<p>' + esc(t('noti.empty.desc')) + '</p></div>';
    }
    return grouped(list).map(function (g) {
      return '<h2 class="nt-day">' + esc(dayLabel(g.key)) + '</h2>' + g.items.map(rowHtml).join('');
    }).join('');
  }

  function paintShell() {
    var tabs = [
      { id: 'all', label: t('noti.tab.all') },
      { id: 'order', label: t('noti.tab.order') },
      { id: 'promo', label: t('noti.tab.promo') },
      { id: 'system', label: t('noti.tab.system') }
    ];
    rootEl.innerHTML =
      TTV.Components.header(t('noti.title')) +
      '<main class="nt-page">' +
        '<div class="nt-tabs" role="tablist">' + tabs.map(function (tb) {
          return '<button type="button" class="nt-tab' + (tab === tb.id ? ' is-on' : '') + '" data-nt-tab="' + tb.id + '" role="tab" aria-selected="' + (tab === tb.id) + '">' + esc(tb.label) + '</button>';
        }).join('') + '</div>' +
        '<div class="nt-meta"></div>' +
        '<div class="nt-list"></div>' +
      '</main>';
    painted = true;
  }

  function paintList() {
    if (!rootEl) return;
    if (!painted) paintShell();
    rootEl.querySelectorAll('[data-nt-tab]').forEach(function (btn) {
      var on = btn.getAttribute('data-nt-tab') === tab;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var list = visible();
    var unread = list.filter(function (r) { return !r.is_read; }).length;
    var meta = rootEl.querySelector('.nt-meta');
    if (meta) {
      meta.innerHTML = '<span>' + esc(t('noti.count', { n: list.length })) + '</span>' +
        (unread ? '<button type="button" class="nt-readall" data-nt-readall>' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m5 12 5 5 9-10"/></svg> ' +
          esc(t('noti.readAll')) + '</button>' : '');
    }
    var box = rootEl.querySelector('.nt-list');
    if (box) box.innerHTML = listHtml();
  }

  function applyRows(rows) {
    if (!rootEl) return;
    items = rows || [];
    paintList();
  }

  function openHref(row) {
    var href = TTV.api && TTV.api.notificationHref ? TTV.api.notificationHref(row) : '';
    if (href) TTV.Router.navigate(href);
  }

  function onClick(e) {
    if (!rootEl || !rootEl.contains(e.target)) return;
    var tb = e.target.closest('[data-nt-tab]');
    if (tb) { tab = tb.getAttribute('data-nt-tab'); paintList(); return; }
    var del = e.target.closest('[data-nt-del]');
    if (del) {
      e.preventDefault();
      e.stopPropagation();
      var delId = del.getAttribute('data-nt-del');
      TTV.api.deleteNotification(delId).then(function () {
        items = items.filter(function (r) { return r.id !== delId; });
        paintList();
      }).catch(function (err) {
        TTV.Components.toast((err && err.message) || t('noti.err'), 'danger');
      });
      return;
    }
    var all = e.target.closest('[data-nt-readall]');
    if (all) {
      if (all.getAttribute('data-busy')) return;
      all.setAttribute('data-busy', '1');
      all.disabled = true;
      items.forEach(function (r) { r.is_read = true; });
      paintList();
      TTV.api.markAllNotificationsRead().catch(function (err) {
        TTV.Components.toast((err && err.message) || t('noti.err'), 'danger');
      });
      return;
    }
    var open = e.target.closest('[data-nt-open]');
    if (!open) return;
    var id = open.getAttribute('data-nt-open');
    var row = null;
    items.forEach(function (r) { if (r.id === id) row = r; });
    function go() { openHref(row); }
    if (row && !row.is_read) {
      TTV.api.markNotificationRead(id).then(function () { row.is_read = true; go(); }).catch(go);
    } else go();
  }

  TTV.screens.notifications = {
    render: function (container) {
      this.destroy();
      rootEl = container;
      tab = 'all';
      painted = false;
      rootEl.innerHTML = TTV.Components.header(t('noti.title')) +
        '<main class="page">' + TTV.Components.loading(t('common.loading')) + '</main>';
      document.addEventListener('click', onClick);
      unwatch = TTV.NotiLive.watchList(applyRows);
    },
    destroy: function () {
      if (unwatch) { unwatch(); unwatch = null; }
      document.removeEventListener('click', onClick);
      rootEl = null;
      items = [];
      painted = false;
    }
  };
})(window.TTV);
