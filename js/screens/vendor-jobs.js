/* Việc của tôi — đơn đã ghép cho thợ. Cập nhật live khi khách chọn thợ (TTV.Live topic orders). */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components;
  var token = 0;
  var boxEl = null, clickHandler = null, unwatch = null;
  var jobs = [];
  var listSig = '';
  var orderStamp = '';
  var loading = false;
  var pendingSilent = false;

  function t(key, params) { return TTV.I18n.t(key, params); }
  function esc(v) { return C.escape(v); }
  function vnd(n) { return new Intl.NumberFormat('vi-VN').format(Number(n) || 0) + 'đ'; }

  function statusBadge(st) {
    if (st === 'arriving') return C.badge(t('vendorOrder.status.arriving'), 'warning');
    if (st === 'working') return C.badge(t('vendorOrder.status.working'), 'info');
    return C.badge(t('vendorOrder.status.matched'), 'success');
  }
  function cardMarkup(o) {
    return '<a class="vm-card" href="#/vendor/market/' + esc(o.id) + '">' +
      '<div class="vm-card__head">' +
        '<span class="vm-card__icon" aria-hidden="true">' + esc(o.service_icon) + '</span>' +
        '<div class="vm-card__title"><strong>' + esc(o.service_name) + '</strong>' +
          '<span>' + esc(o.code) + ' · ' + esc(TTV.Utils.relativeTime(o.matched_at || o.created_at)) + '</span></div>' +
        '<div class="vm-card__badges">' + statusBadge(o.status) + '</div>' +
      '</div>' +
      '<ul class="vm-route">' +
        '<li><i class="vm-dot vm-dot--from"></i><span>' + esc((o.pickup && o.pickup.addr) || t('vendorMarket.noAddr')) + '</span></li>' +
        '<li><i class="vm-dot vm-dot--to"></i><span>' + esc((o.dropoff && o.dropoff.addr) || t('vendorMarket.noAddr')) + '</span></li>' +
      '</ul>' +
      '<div class="vm-card__foot">' +
        '<div class="vm-offer"><small>' + esc(t('vendorJobs.pay')) + '</small><b>' + esc(vnd(o.final_price)) + '</b></div>' +
      '</div></a>';
  }
  function jobsSig(list) {
    return (list || []).map(function (o) { return o.id + ':' + o.status + ':' + o.final_price; }).join('|');
  }
  function paint() {
    if (!boxEl) return;
    if (!jobs.length) {
      boxEl.innerHTML = C.emptyState(t('vendor.jobs.soon'), t('vendor.jobs.soon.desc'), { icon: '☑' });
      return;
    }
    boxEl.innerHTML = '<div class="vm-meta"><span>' + esc(t('vendorJobs.count', { n: jobs.length })) + '</span></div>' +
      '<div class="vm-list">' + jobs.map(cardMarkup).join('') + '</div>';
  }
  function load(silent, retriesLeft, forceFull) {
    if (loading) { pendingSilent = true; return; }
    retriesLeft = retriesLeft == null ? 0 : retriesLeft;
    var my = ++token;
    loading = true;
    if (!silent && boxEl && !jobs.length) boxEl.innerHTML = C.loading(t('common.loading'));
    TTV.api.listVendorJobs({
      poll: !!silent && !forceFull,
      since: orderStamp,
      full: !!forceFull
    }).then(function (res) {
      loading = false;
      if (my !== token || !boxEl) return;
      if (res && res.unchanged) {
        if (pendingSilent) { pendingSilent = false; load(true); }
        return;
      }
      if (res && res.stamp) orderStamp = res.stamp;
      var next = (res && res.jobs) || [];
      var nextSig = jobsSig(next);
      if (silent && retriesLeft > 0 && nextSig === listSig) {
        setTimeout(function () { if (token === my && boxEl) load(true, retriesLeft - 1); }, 400);
        return;
      }
      if (!(silent && nextSig === listSig)) {
        listSig = nextSig;
        jobs = next;
        paint();
      }
      if (pendingSilent) { pendingSilent = false; load(true); }
    }).catch(function (err) {
      loading = false;
      if (my !== token || !boxEl) return;
      if (err && err.code === 'LOCKED') {
        TTV.api.logoutAndGo().then(function () { C.toast(t('vendor.locked'), 'danger'); });
        return;
      }
      boxEl.innerHTML = C.emptyState(t('vendorJobs.loadError'), (err && err.message) || t('common.error'), { icon: '!' }) +
        '<button type="button" class="btn btn-secondary btn-block" data-vj-action="refresh">' + esc(t('vendorJobs.retry')) + '</button>';
    });
  }
  function onClick(e) {
    var btn = e.target.closest('[data-vj-action="refresh"]');
    if (btn && boxEl && boxEl.contains(btn)) load(false, 0, true);
  }
  function render(box) {
    destroy();
    boxEl = box;
    clickHandler = onClick;
    box.addEventListener('click', clickHandler);
    if (jobs.length) paint();
    load(!!jobs.length);
    if (TTV.Live && TTV.Live.watch) {
      unwatch = TTV.Live.watch('orders', function (fromPoll) { load(true, fromPoll ? 0 : 4); }, { immediate: false });
    }
  }
  function destroy() {
    token++;
    loading = false;
    pendingSilent = false;
    if (unwatch) { unwatch(); unwatch = null; }
    if (boxEl && clickHandler) boxEl.removeEventListener('click', clickHandler);
    boxEl = null; clickHandler = null;
  }

  TTV.screens.vendorJobs = { render: render, destroy: destroy };
  if (TTV.screens.vendor && TTV.screens.vendor.register) TTV.screens.vendor.register('jobs', { render: render, destroy: destroy });
})(window.TTV);
