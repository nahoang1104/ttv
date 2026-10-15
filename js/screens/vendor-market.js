/* Chợ đơn (thợ) — task 5.2. Gắn vào tab "Chợ đơn" của khung app thợ (vendor.js) qua TTV.screens.vendor.register('market', …).
   Dữ liệu: api.listMarketOrders (đã lọc theo loại nhà cung cấp / số thợ / dịch vụ / khu vực), sắp xếp mới nhất / gấp nhất / gần nhất. */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components;
  var token = 0;          // callback bất đồng bộ cũ thấy lệch token thì bỏ qua
  var boxEl = null, clickHandler = null;
  var sort = 'newest';    // giữ lựa chọn sắp xếp khi quay lại từ chi tiết đơn
  var data = null;        // kết quả api.listMarketOrders gần nhất
  var unwatch = null;
  var listSig = '';
  var loading = false;
  var pendingSilent = false;

  function t(key, params) { return TTV.I18n.t(key, params); }
  function esc(v) { return C.escape(v); }
  function vnd(n) { return new Intl.NumberFormat('vi-VN').format(Number(n) || 0) + 'đ'; }
  function kmText(n) { return (Math.round((Number(n) || 0) * 10) / 10).toFixed(1).replace('.', ',') + ' km'; }

  var SORTS = [
    { id: 'newest', label: 'vendorMarket.sort.newest' },
    { id: 'urgent', label: 'vendorMarket.sort.urgent' },
    { id: 'nearest', label: 'vendorMarket.sort.nearest' }
  ];

  function remainingText(ms) {
    if (!(ms > 0)) return '';
    var min = Math.ceil(ms / 60000);
    return min <= 1 ? t('vendorMarket.remainingLess') : t('vendorMarket.remaining', { n: min });
  }
  function speedBadge(speed) {
    if (speed === 'urgent') return C.badge(t('vendorOrder.speed.urgent'), 'danger');
    if (speed === 'fast') return C.badge(t('vendorOrder.speed.fast'), 'warning');
    return '';
  }

  function cardMarkup(o) {
    var chips = [];
    if (o.distance_km > 0) chips.push(kmText(o.distance_km));
    if (o.weight_name) chips.push(o.weight_name);
    chips.push(t('vendorMarket.workers', { n: o.workers }));
    var rem = remainingText(o.remaining_ms);
    return '<a class="vm-card" href="#/vendor/market/' + esc(o.id) + '">' +
      '<div class="vm-card__head">' +
        '<span class="vm-card__icon" aria-hidden="true">' + esc(o.service_icon) + '</span>' +
        '<div class="vm-card__title"><strong>' + esc(o.service_name) + '</strong>' +
          '<span>' + esc(o.code) + ' · ' + esc(TTV.Utils.relativeTime(o.created_at)) + '</span></div>' +
        '<div class="vm-card__badges">' + speedBadge(o.speed) + (o.my_quote && o.my_quote.status === 'pending' ? C.badge(t('vendorMarket.quoted'), 'info') : '') + '</div>' +
      '</div>' +
      '<ul class="vm-route">' +
        '<li><i class="vm-dot vm-dot--from"></i><span>' + esc(o.pickup.addr || t('vendorMarket.noAddr')) + '</span></li>' +
        '<li><i class="vm-dot vm-dot--to"></i><span>' + esc(o.dropoff.addr || t('vendorMarket.noAddr')) + '</span></li>' +
      '</ul>' +
      '<div class="vm-chips">' + chips.map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + '</div>' +
      '<div class="vm-card__foot">' +
        '<div class="vm-offer"><small>' + esc(t('vendorMarket.offer')) + '</small><b>' + esc(vnd(o.offer)) + '</b></div>' +
        (rem ? '<span class="vm-remaining">' + esc(rem) + '</span>' : '') +
      '</div></a>';
  }

  function toolbarMarkup(count) {
    return '<div class="vm-sorts" role="group" aria-label="Sắp xếp">' +
      SORTS.map(function (s) { return C.chip(t(s.label), s.id === sort, { action: 'vm-sort:' + s.id }); }).join('') + '</div>' +
      '<div class="vm-meta"><span>' + esc(t('vendorMarket.count', { n: count })) + '</span>' +
      '<button type="button" class="link-btn" data-vm-action="refresh">' + esc(t('vendorMarket.refresh')) + '</button></div>' +
      (sort === 'nearest' ? '<p class="vm-hint">' + esc(t('vendorMarket.sort.hint')) + '</p>' : '');
  }

  function paint() {
    if (!boxEl) return;
    var d = data, r = d.readiness;
    if (!r.ready) {
      if (r.blocked) {
        boxEl.innerHTML = C.notice(t('vendorMarket.blocked.desc', { limit: vnd(Math.abs(r.limit)) }), t('vendorMarket.blocked.title'));
      } else {
        boxEl.innerHTML = C.emptyState(t('vendorMarket.off.title'), t('vendorMarket.off.desc'), { icon: '⏻' }) +
          '<button type="button" class="btn btn-primary btn-block" data-route="/vendor">' + esc(t('vendorMarket.off.cta')) + '</button>';
      }
      return;
    }
    var list = TTV.api.sortMarketOrders(d.orders, sort);
    boxEl.innerHTML = toolbarMarkup(list.length) +
      (list.length
        ? '<div class="vm-list">' + list.map(cardMarkup).join('') + '</div>'
        : C.emptyState(t('vendorMarket.empty.title'), t('vendorMarket.empty.desc'), { icon: '▤' }));
  }

  function marketSig(res) {
    var r = (res && res.readiness) || {};
    var orders = (res && res.orders) || [];
    return [r.ready ? '1' : '0', r.blocked ? '1' : '0'].join(':') + '|' + orders.map(function (o) {
      return o.id + ':' + ((o.my_quote && o.my_quote.status) || '') + ':' + o.offer;
    }).join('|');
  }
  function load(silent) {
    if (loading) { pendingSilent = true; return; }
    var my = ++token;
    loading = true;
    if (!silent && boxEl) boxEl.innerHTML = C.loading(t('common.loading'));
    TTV.api.listMarketOrders({ sort: sort }).then(function (res) {
      loading = false;
      if (my !== token || !boxEl) return;
      var nextSig = marketSig(res);
      if (!(silent && nextSig === listSig && data)) {
        listSig = nextSig;
        data = res;
        paint();
      }
      if (pendingSilent) { pendingSilent = false; load(true); }
    }).catch(function (err) {
      loading = false;
      if (my !== token || !boxEl) return;
      if (err && (err.code === 'LOCKED' || err.code === 'NOT_FOUND' || err.code === 'FORBIDDEN')) {
        TTV.api.logoutAndGo().then(function () { C.toast(t('vendor.locked'), 'danger'); });
        return;
      }
      boxEl.innerHTML = C.emptyState(t('vendorMarket.loadError'), (err && err.message) || t('common.error'), { icon: '!' }) +
        '<button type="button" class="btn btn-secondary btn-block" data-vm-action="refresh">' + esc(t('vendorMarket.retry')) + '</button>';
    });
  }

  function onClick(e) {
    var chip = e.target.closest('[data-action^="vm-sort:"]');
    if (chip && boxEl && boxEl.contains(chip)) {
      var next = chip.getAttribute('data-action').slice('vm-sort:'.length);
      if (next !== sort && data) { sort = next; paint(); }
      return;
    }
    var btn = e.target.closest('[data-vm-action="refresh"]');
    if (btn && boxEl && boxEl.contains(btn)) load(false);
  }

  function render(box) {
    destroy();
    boxEl = box;
    clickHandler = onClick;
    box.addEventListener('click', clickHandler);
    load(false);
    if (TTV.Live && TTV.Live.watch) {
      unwatch = TTV.Live.watch('orders', function () { load(true); }, { immediate: false });
    }
  }
  function destroy() {
    token++;
    loading = false;
    pendingSilent = false;
    listSig = '';
    if (unwatch) { unwatch(); unwatch = null; }
    if (boxEl && clickHandler) boxEl.removeEventListener('click', clickHandler);
    boxEl = null; clickHandler = null;
  }

  TTV.screens.vendorMarket = { render: render, destroy: destroy };
  if (TTV.screens.vendor && TTV.screens.vendor.register) TTV.screens.vendor.register('market', { render: render, destroy: destroy });
})(window.TTV);
