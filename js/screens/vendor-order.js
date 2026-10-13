/* Chi tiết đơn (thợ) — task 5.3. Route: #/vendor/market/:id.
   Hiện: lộ trình, khoảng cách, thông tin việc, ảnh, video, số tiền khách trả (đơn Gấp hiển thị giá hiện tại).
   Nút Báo giá (5.4) / Nhận đơn (5.5) gắn vào ô đáy qua TTV.screens.vendorOrder.registerActions(fn(slot, view, reload)). */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components;
  var token = 0, rootEl = null, clickHandler = null, lightbox = null, currentId = '';
  var actionRenderers = [];

  function t(key, params) { return TTV.I18n.t(key, params); }
  function esc(v) { return C.escape(v); }
  function vnd(n) { return new Intl.NumberFormat('vi-VN').format(Number(n) || 0) + 'đ'; }
  function app() { var el = document.getElementById('app'); el.classList.remove('is-wide'); return el; }
  function mmss(sec) { sec = Math.max(0, Math.round(Number(sec) || 0)); return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); }
  function kmText(n) { return (Math.round((Number(n) || 0) * 10) / 10).toFixed(1).replace('.', ',') + ' km'; } // Chi tiết đơn: làm tròn 1 chữ số
  function tOr(key, fallback) { var v = t(key); return v === key ? fallback : v; }

  function row(label, value) {
    return '<div class="vo-row"><span>' + esc(label) + '</span><b>' + value + '</b></div>';
  }
  function floorText(floor, elevator) {
    var f = floor > 0 ? t('vendorOrder.floor', { n: floor }) : t('vendorOrder.floor.ground');
    return esc(f) + (floor > 0 ? ' · ' + esc(t(elevator ? 'vendorOrder.elevator.yes' : 'vendorOrder.elevator.no')) : '');
  }
  function statusBadge(status) {
    var tone = { finding: 'warning', matched: 'info', arriving: 'info', working: 'info', completed: 'success', cancelled: 'neutral' }[status] || 'neutral';
    return C.badge(tOr('vendorOrder.status.' + status, status), tone);
  }
  function remainingLine(v) {
    if (v.status !== 'finding') return '';
    if (!(v.remaining_ms > 0)) return '<p class="vo-deadline is-expired">' + esc(t('vendorOrder.expired')) + '</p>';
    var min = Math.ceil(v.remaining_ms / 60000);
    return '<p class="vo-deadline">' + esc(min <= 1 ? t('vendorOrder.remainingLess') : t('vendorOrder.remaining', { n: min })) + '</p>';
  }

  function amountCard(v) {
    var pb = v.price_breakdown, ref = '';
    if (pb && (pb.base != null || pb.weight != null || pb.floor != null || pb.distance != null)) {
      ref = '<div class="vo-ref"><h4>' + esc(t('vendorOrder.ref.title')) + '</h4>' +
        [['base', 'vendorOrder.ref.base'], ['weight', 'vendorOrder.ref.weight'], ['floor', 'vendorOrder.ref.floor'], ['distance', 'vendorOrder.ref.distance']]
          .filter(function (r) { return pb[r[0]] != null; })
          .map(function (r) { return '<div><span>' + esc(t(r[1])) + '</span><b>' + esc(vnd(pb[r[0]])) + '</b></div>'; }).join('') + '</div>';
    }
    var quote = v.my_quote
      ? '<p class="vo-myquote">' + esc(t('vendorOrder.myQuote', { price: vnd(v.my_quote.price), status: tOr('vendorOrder.quote.' + v.my_quote.status, v.my_quote.status) })) + '</p>' : '';
    return '<section class="vo-card vo-amount">' +
      '<small>' + esc(t('vendorOrder.amount.max')) + '</small>' +
      '<strong>' + esc(vnd(v.offer)) + '</strong>' +
      (v.speed === 'urgent' ? '<p class="vo-urgent">' + esc(t('vendorOrder.amount.urgent')) + '</p>' : '') +
      '<p class="vo-mode">' + esc(t('vendorOrder.mode.bid')) + '</p>' +
      (v.workers >= 2 ? '<p class="vo-mode">' + esc(t('vendorOrder.mode.team', { n: v.workers })) + '</p>' : '') +
      quote + remainingLine(v) + ref + '</section>';
  }
  function routeCard(v) {
    return '<section class="vo-card"><h3>' + esc(t('vendorOrder.route.title')) + '</h3>' +
      '<ul class="vm-route vo-route">' +
        '<li><i class="vm-dot vm-dot--from"></i><div><small>' + esc(t('vendorOrder.route.pickup')) + '</small><span>' + esc(v.pickup.addr || t('vendorMarket.noAddr')) + '</span></div></li>' +
        '<li><i class="vm-dot vm-dot--to"></i><div><small>' + esc(t('vendorOrder.route.dropoff')) + '</small><span>' + esc(v.dropoff.addr || t('vendorMarket.noAddr')) + '</span></div></li>' +
      '</ul>' +
      (v.distance_km > 0 ? '<div class="vo-distance"><span>' + esc(t('vendorOrder.route.distance')) + '</span><b>' + esc(kmText(v.distance_km)) + '</b></div>' : '') +
      '</section>';
  }
  function infoCard(v) {
    var rows = [
      row(t('vendorOrder.info.service'), esc(v.service_name)),
      row(t('vendorOrder.info.weight'), esc(v.weight_name || '—') + (v.weight_hint ? '<em>' + esc(v.weight_hint) + '</em>' : '')),
      row(t('vendorOrder.info.pickupFloor'), floorText(v.pickup_floor, v.pickup_elevator)),
      row(t('vendorOrder.info.needUnload'), esc(t(v.need_unload ? 'vendorOrder.yes' : 'vendorOrder.no')))
    ];
    if (v.need_unload) rows.push(row(t('vendorOrder.info.dropFloor'), floorText(v.drop_floor, v.drop_elevator)));
    rows.push(
      row(t('vendorOrder.info.workers'), esc(String(v.workers))),
      row(t('vendorOrder.info.speed'), esc(tOr('vendorOrder.speed.' + v.speed, v.speed))),
      row(t('vendorOrder.info.provider'), esc(tOr('vendorOrder.provider.' + v.provider_type, v.provider_type))),
      row(t('vendorOrder.info.pay'), esc(tOr('vendorOrder.pay.' + v.pay_method, v.pay_method)))
    );
    return '<section class="vo-card"><h3>' + esc(t('vendorOrder.info.title')) + '</h3>' + rows.join('') +
      '<div class="vo-note"><small>' + esc(t('vendorOrder.info.note')) + '</small><p>' + (v.note ? esc(v.note) : '<i>' + esc(t('vendorOrder.noNote')) + '</i>') + '</p></div></section>';
  }
  function mediaCard(v) {
    var photos = v.media.filter(function (m) { return m.kind === 'image'; });
    var videos = v.media.filter(function (m) { return m.kind === 'video'; });
    var body = '';
    if (photos.length) {
      body += '<h4>' + esc(t('vendorOrder.media.photos', { n: photos.length })) + '</h4><div class="vo-photos">' +
        photos.map(function (m) {
          return '<button type="button" class="vo-photo" data-vo-photo="' + esc(m.path) + '"><img src="' + esc(m.path) + '" alt="" loading="lazy"><span>' + esc(t('vendorOrder.media.error')) + '</span></button>';
        }).join('') + '</div>';
    }
    videos.forEach(function (m) {
      body += '<h4>' + esc(t('vendorOrder.media.video', { time: mmss(m.duration) })) + '</h4>' +
        '<video class="vo-video" controls playsinline preload="metadata" src="' + esc(m.path) + '"></video>';
    });
    if (!body) body = '<p class="vo-empty">' + esc(t('vendorOrder.media.none')) + '</p>';
    return '<section class="vo-card"><h3>' + esc(t('vendorOrder.media.title')) + '</h3>' + body + '</section>';
  }
  function customerCard(v) {
    var body;
    if (v.customer) {
      // Tên luôn hiện; SĐT + nút Gọi chỉ khi API trả phone (đơn của thợ, đã ghép)
      var phone = v.customer.phone, tel = String(phone || '').replace(/[^\d+]/g, '');
      body = '<div class="vo-customer">' + C.avatar(v.customer.name || '?', v.customer.avatar || '', { size: 'md' }) +
        '<div><b>' + esc(v.customer.name || t('vendorOrder.customer.noName')) + '</b>' +
          (phone ? '<span>' + esc(phone) + '</span>' : '<span class="vo-locked">🔒 ' + esc(t('vendorOrder.customer.phoneHidden')) + '</span>') + '</div>' +
        (phone && tel ? '<a class="btn btn-secondary" href="tel:' + esc(tel) + '">' + esc(t('vendorOrder.customer.call')) + '</a>' : '') + '</div>';
    } else body = '<p class="vo-empty">' + esc(t('vendorOrder.customer.hidden')) + '</p>';
    return '<section class="vo-card"><h3>' + esc(t('vendorOrder.customer.title')) + '</h3>' + body + '</section>';
  }

  function detailMarkup(v) {
    return '<main class="vo-main">' +
      '<section class="vo-card vo-top"><span class="vm-card__icon" aria-hidden="true">' + esc(v.service_icon) + '</span>' +
        '<div><strong>' + esc(v.service_name) + '</strong><span>' + esc(v.code) + ' · ' + esc(t('vendorOrder.createdAt', { time: TTV.Utils.relativeTime(v.created_at) })) + '</span></div>' +
        '<div class="vm-card__badges">' + (v.speed === 'urgent' ? C.badge(t('vendorOrder.speed.urgent'), 'danger') : v.speed === 'fast' ? C.badge(t('vendorOrder.speed.fast'), 'warning') : '') + statusBadge(v.status) + '</div></section>' +
      amountCard(v) + routeCard(v) + infoCard(v) + mediaCard(v) + customerCard(v) +
      '</main><div class="vo-actions" id="vo-actions" hidden></div>';
  }
  function shell(inner) {
    return '<div class="vendor vo">' + C.header(t('vendorOrder.title')) + inner + '</div>';
  }
  function errorMarkup(err) {
    var code = err && err.code, title = t('vendorOrder.loadError'), icon = '!', retry = true;
    if (code === 'ORDER_NOT_FOUND') { title = t('vendorOrder.notFound'); icon = '⌕'; retry = false; }
    else if (code === 'UNAVAILABLE') { title = t('vendorOrder.unavailable'); icon = '⏳'; retry = false; }
    else if (code === 'NOT_ELIGIBLE') { title = t('vendorOrder.notEligible'); icon = '⛔'; retry = false; }
    var msg = (code === 'ORDER_NOT_FOUND') ? t('vendorOrder.notFound.desc') : ((err && err.message) || t('common.error'));
    return shell('<main class="vo-main">' + C.emptyState(title, msg, { icon: icon }) +
      (retry ? '<button type="button" class="btn btn-secondary btn-block" data-vo-action="retry">' + esc(t('vendorOrder.retry')) + '</button>' : '') +
      '<button type="button" class="btn btn-primary btn-block vo-gap" data-route="/vendor/market">' + esc(t('vendorOrder.backToMarket')) + '</button></main>');
  }

  function openLightbox(src) {
    closeLightbox();
    var el = document.createElement('div');
    el.className = 'vo-lightbox'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = '<button type="button" class="vo-lightbox__close" aria-label="' + esc(t('vendorOrder.media.close')) + '">×</button><img src="' + esc(src) + '" alt="">';
    el.addEventListener('click', closeLightbox);
    document.body.appendChild(el); lightbox = el;
  }
  function closeLightbox() { if (lightbox && lightbox.parentNode) lightbox.parentNode.removeChild(lightbox); lightbox = null; }

  function mountActions(v) {
    var slot = rootEl && rootEl.querySelector('#vo-actions'); if (!slot) return;
    var used = false;
    actionRenderers.forEach(function (fn) {
      try { if (fn(slot, v, function () { load(currentId, true); })) used = true; } catch (e) { console.warn('[TTV] vendorOrder action:', e); }
    });
    slot.hidden = !used;
  }

  function onClick(e) {
    var ph = e.target.closest('[data-vo-photo]');
    if (ph) { openLightbox(ph.getAttribute('data-vo-photo')); return; }
    if (e.target.closest('[data-vo-action="retry"]')) load(currentId, false);
  }
  function bindMedia() {
    rootEl.querySelectorAll('.vo-customer .avatar img').forEach(function (img) { // ảnh đại diện lỗi → về chữ cái đầu
      img.addEventListener('error', function () {
        var box = img.parentNode, name = (img.getAttribute('alt') || '?').trim();
        if (box) box.textContent = (name.charAt(0) || '?').toUpperCase();
      });
    });
    rootEl.querySelectorAll('.vo-photo img').forEach(function (img) {
      img.addEventListener('error', function () { var b = img.closest('.vo-photo'); if (b) b.classList.add('is-error'); });
    });
  }

  function load(id, silent) {
    var my = ++token;
    currentId = id;
    if (!silent) rootEl.innerHTML = shell('<main class="vo-main">' + C.loading(t('common.loading')) + '</main>');
    TTV.api.getMarketOrder(id).then(function (v) {
      if (my !== token || !rootEl) return;
      rootEl.innerHTML = shell(detailMarkup(v));
      bindMedia(); mountActions(v);
    }).catch(function (err) {
      if (my !== token || !rootEl) return;
      if (err && (err.code === 'LOCKED' || err.code === 'NOT_FOUND' || err.code === 'FORBIDDEN')) {
        TTV.api.logoutAndGo().then(function () { C.toast(t('vendor.locked'), 'danger'); });
        return;
      }
      rootEl.innerHTML = errorMarkup(err);
    });
  }

  function render(ctx) {
    destroy();
    rootEl = app();
    clickHandler = onClick;
    rootEl.addEventListener('click', clickHandler);
    load(ctx && ctx.params && ctx.params.id, false);
  }
  function destroy() {
    token++;
    closeLightbox();
    if (rootEl && clickHandler) rootEl.removeEventListener('click', clickHandler);
    rootEl = null; clickHandler = null;
  }

  TTV.screens.vendorOrder = {
    render: render, destroy: destroy,
    registerActions: function (fn) { if (typeof fn === 'function') actionRenderers.push(fn); }
  };
  TTV.Router.add('/vendor/market/:id', render, { roles: ['VENDOR'], loginRoute: '/staff-login', deniedRoute: '/staff-login', destroy: destroy });
})(window.TTV);
