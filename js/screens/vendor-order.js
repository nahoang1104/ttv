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
  var unwatch = null, loading = false, pendingSilent = false, viewSig = '', stopUnread = null, missRetry = 0, lastView = null;
  var mapObj = null, mapGen = 0;

  function t(key, params) { return TTV.I18n.t(key, params); }
  function esc(v) { return C.escape(v); }
  function vnd(n) { return new Intl.NumberFormat('vi-VN').format(Number(n) || 0) + 'đ'; }
  function app() { var el = document.getElementById('app'); el.classList.remove('is-wide'); return el; }
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
    var tone = { finding: 'warning', matched: 'success', arriving: 'warning', working: 'info', completed: 'success', cancelled: 'neutral' }[status] || 'neutral';
    return C.badge(tOr('vendorOrder.status.' + status, status), tone);
  }
  function remainingLine(v) {
    if (v.status !== 'finding') return '';
    if (!(v.remaining_ms > 0)) return '<p class="vo-deadline is-expired">' + esc(t('vendorOrder.expired')) + '</p>';
    var min = Math.ceil(v.remaining_ms / 60000);
    return '<p class="vo-deadline">' + esc(min <= 1 ? t('vendorOrder.remainingLess') : t('vendorOrder.remaining', { n: min })) + '</p>';
  }

  function isWonJob(v) {
    return !!(v && v.is_mine && (v.status === 'matched' || v.status === 'arriving' || v.status === 'working' || v.status === 'completed'));
  }
  function amountCard(v) {
    var won = isWonJob(v);
    var price = won && v.final_price > 0 ? v.final_price : v.offer;
    var pb = v.price_breakdown, ref = '';
    if (pb && (pb.base != null || pb.weight != null || pb.floor != null || pb.distance != null)) {
      ref = '<div class="vo-ref"><h4>' + esc(t('vendorOrder.ref.title')) + '</h4>' +
        [['base', 'vendorOrder.ref.base'], ['weight', 'vendorOrder.ref.weight'], ['floor', 'vendorOrder.ref.floor'], ['distance', 'vendorOrder.ref.distance']]
          .filter(function (r) { return pb[r[0]] != null; })
          .map(function (r) { return '<div><span>' + esc(t(r[1])) + '</span><b>' + esc(vnd(pb[r[0]])) + '</b></div>'; }).join('') + '</div>';
    }
    var quote = (!won && v.my_quote)
      ? '<p class="vo-myquote">' + esc(t('vendorOrder.myQuote', { price: vnd(v.my_quote.price), status: tOr('vendorOrder.quote.' + v.my_quote.status, v.my_quote.status) })) + '</p>' : '';
    return '<section class="vo-card vo-amount">' +
      '<small>' + esc(t(won ? 'vendorOrder.amount.final' : 'vendorOrder.amount.max')) + '</small>' +
      '<strong>' + esc(vnd(price)) + '</strong>' +
      (won ? '' : (v.speed === 'urgent' ? '<p class="vo-urgent">' + esc(t('vendorOrder.amount.urgent')) + '</p>' : '')) +
      (won ? '' : '<p class="vo-mode">' + esc(t('vendorOrder.mode.bid')) + '</p>') +
      (won || v.workers < 2 ? '' : '<p class="vo-mode">' + esc(t('vendorOrder.mode.team', { n: v.workers })) + '</p>') +
      quote + remainingLine(v) + ref + '</section>';
  }
  function unmountMap() {
    mapGen += 1;
    if (mapObj) {
      try { mapObj.remove(); } catch (_) {}
      mapObj = null;
    }
  }
  function mountMap(v) {
    unmountMap();
    if (!rootEl || !v || v.status === 'cancelled' || !window.L) return;
    var el = rootEl.querySelector('[data-vo-map]');
    var pick = v.pickup || {}, drop = v.dropoff || {};
    if (!el || pick.lat == null || drop.lat == null) return;
    var gen = mapGen;
    mapObj = window.L.map(el, { zoomControl: false, attributionControl: false });
    window.L.control.zoom({ position: 'topright' }).addTo(mapObj);
    window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(mapObj);
    function pin(color) {
      return window.L.divIcon({
        className: 'od-pin',
        html: '<span class="od-pin__dot" style="background:' + color + '"></span>',
        iconSize: [22, 28],
        iconAnchor: [11, 26]
      });
    }
    var a = window.L.latLng(pick.lat, pick.lng);
    var b = window.L.latLng(drop.lat, drop.lng);
    var routeLayer = window.L.layerGroup().addTo(mapObj);
    window.L.marker(a, { icon: pin('#22c55e'), interactive: false }).addTo(mapObj);
    window.L.marker(b, { icon: pin('#ef4444'), interactive: false }).addTo(mapObj);
    mapObj.fitBounds(window.L.latLngBounds(a, b), { padding: [28, 28], maxZoom: 16 });
    function drawLine(latlngs) {
      if (!mapObj || gen !== mapGen || !latlngs || latlngs.length < 2) return;
      routeLayer.clearLayers();
      window.L.polyline(latlngs, { color: '#ffffff', weight: 7, opacity: 0.9, lineJoin: 'round', lineCap: 'round' }).addTo(routeLayer);
      window.L.polyline(latlngs, { color: '#1B7BE4', weight: 4, opacity: 1, lineJoin: 'round', lineCap: 'round' }).addTo(routeLayer);
      mapObj.fitBounds(window.L.latLngBounds(latlngs), { padding: [28, 28], maxZoom: 16 });
    }
    drawLine([[pick.lat, pick.lng], [drop.lat, drop.lng]]);
    if (TTV.map && TTV.map.routeLine) {
      TTV.map.routeLine(pick, drop).then(function (latlngs) { drawLine(latlngs); });
    }
    setTimeout(function () { if (mapObj && gen === mapGen) mapObj.invalidateSize(); }, 200);
  }
  function mapHtml(v) {
    if (!v || v.status === 'cancelled') return '';
    if (v.pickup && v.pickup.lat != null && v.dropoff && v.dropoff.lat != null) {
      return '<div class="od-map-wrap vo-map">' +
        '<div class="od-map" data-vo-map></div>' +
        '<p class="od-map-legend"><span><i class="od-leg od-leg--pick"></i>' + esc(t('od.map.pick')) + '</span>' +
          '<span><i class="od-leg od-leg--drop"></i>' + esc(t('od.map.drop')) + '</span></p></div>';
    }
    return '';
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
  function photoGrid(list) {
    if (!list.length) return '';
    return '<div class="od-photos">' + list.map(function (m) {
      return '<button type="button" class="od-photo" data-od-zoom="' + esc(m.path) + '"><img src="' + esc(m.path) + '" alt="" loading="lazy"></button>';
    }).join('') + '</div>';
  }
  function videoList(list) {
    return list.map(function (m) {
      return '<div class="od-video-wrap"><video class="od-video" controls preload="metadata" playsinline src="' + esc(m.path) + '"></video></div>';
    }).join('');
  }
  function mediaSection(tone, title, hint, imgs, vids) {
    if (!imgs.length && !vids.length) return '';
    var n = imgs.length + vids.length;
    var icon = tone === 'proof'
      ? '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="m8.2 12.2 2.5 2.5 5.2-5.4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none"><path d="M4.6 8.2h3.1l1.3-2h6l1.3 2h3.1v9.8H4.6z" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="13.1" r="2.8" stroke="currentColor" stroke-width="1.7"/></svg>';
    var body = '';
    if (imgs.length) body += photoGrid(imgs);
    if (vids.length) body += videoList(vids);
    return '<section class="od-media od-media--' + tone + '">' +
      '<header class="od-media__head">' +
        '<span class="od-media__icon" aria-hidden="true">' + icon + '</span>' +
        '<div><h2>' + esc(title) + '</h2>' + (hint ? '<p>' + esc(hint) + '</p>' : '') + '</div>' +
        '<span class="od-media__count">' + n + '</span></header>' +
      body + '</section>';
  }
  function mediaCard(v) {
    var job = (v.media || []).filter(function (m) { return m.role !== 'proof'; });
    var proofMedia = (v.media || []).filter(function (m) { return m.role === 'proof'; });
    return mediaSection('job', t('od.mediaJob'), t('od.mediaJobHint'),
        job.filter(function (m) { return m.kind === 'image'; }),
        job.filter(function (m) { return m.kind === 'video'; })) +
      mediaSection('proof', t('od.proofTitle'), t('od.proofHint'),
        proofMedia.filter(function (m) { return m.kind === 'image'; }),
        proofMedia.filter(function (m) { return m.kind === 'video'; }));
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

  function winBanner(v) {
    if (!v.is_mine) return '';
    var kind = v.status === 'matched' ? 'win' : v.status === 'arriving' ? 'go' : v.status === 'working' ? 'work' : v.status === 'completed' ? 'done' : '';
    if (!kind) return '';
    var icon = kind === 'win' || kind === 'done'
      ? '<path d="M7.5 12.4 10.4 15.2 16.5 8.8" stroke="#16a34a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'
      : kind === 'go'
        ? '<path d="M12 7.2v5.2l3.2 1.8" stroke="#d97706" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>'
        : '<path d="M8 8h8v8H8z" stroke="#1b7be4" stroke-width="2"/><path d="M8 11h8M11 8v8" stroke="#1b7be4" stroke-width="2"/>';
    return '<section class="vo-win vo-win--' + kind + '" role="status">' +
      '<span class="vo-win__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#fff"/>' + icon + '</svg></span>' +
      '<h3>' + esc(t('vendorOrder.' + kind + '.title')) + '</h3>' +
      '<p>' + esc(t('vendorOrder.' + kind + '.desc')) + '</p></section>';
  }
  function detailMarkup(v) {
    return '<main class="vo-main">' + winBanner(v) +
      '<section class="vo-card vo-top"><span class="vm-card__icon" aria-hidden="true">' + esc(v.service_icon) + '</span>' +
        '<div><strong>' + esc(v.service_name) + '</strong><span>' + esc(v.code) + ' · ' + esc(t('vendorOrder.createdAt', { time: TTV.Utils.relativeTime(v.created_at) })) + '</span></div>' +
        '<div class="vm-card__badges">' + (v.speed === 'urgent' ? C.badge(t('vendorOrder.speed.urgent'), 'danger') : v.speed === 'fast' ? C.badge(t('vendorOrder.speed.fast'), 'warning') : '') + statusBadge(v.status) + '</div></section>' +
      amountCard(v) + routeCard(v) + mapHtml(v) + infoCard(v) + mediaCard(v) + customerCard(v) +
      '</main><div class="vo-actions" id="vo-actions" hidden></div>';
  }
  function shell(inner) {
    var unread = TTV.NotiLive ? TTV.NotiLive.unread() : 0;
    return '<div class="vendor vo">' +
      '<header class="app-header"><button type="button" class="app-header__back" data-back aria-label="Quay lại">‹</button>' +
      '<h1>' + esc(t('vendorOrder.title')) + '</h1>' +
      '<button type="button" class="app-header__action vendor-hero__bell" data-route="/vendor/notifications" aria-label="' + esc(t('vendor.notifications')) + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 16.5v-5a5.5 5.5 0 0 1 11 0v5l1.4 1.5H5.1z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></svg>' +
        TTV.Utils.unreadBadge(unread) +
      '</button></header>' + inner + '</div>';
  }
  function errorMarkup(err) {
    var code = err && err.code, title = t('vendorOrder.loadError'), icon = '!', retry = true;
    if (code === 'ORDER_NOT_FOUND') { title = t('vendorOrder.notFound'); icon = '⌕'; retry = false; }
    else if (code === 'MATCHED_OTHER') { title = t('vendorOrder.matchedOther'); icon = 'ℹ'; retry = false; }
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
      try { if (fn(slot, v, reloadView)) used = true; } catch (e) { console.warn('[TTV] vendorOrder action:', e); }
    });
    slot.hidden = !used;
  }

  function onClick(e) {
    var ph = e.target.closest('[data-od-zoom], [data-vo-photo]');
    if (ph) { openLightbox(ph.getAttribute('data-od-zoom') || ph.getAttribute('data-vo-photo')); return; }
    if (e.target.closest('[data-vo-action="retry"]')) load(currentId, false);
  }
  function bindMedia() {
    rootEl.querySelectorAll('.vo-customer .avatar img').forEach(function (img) { // ảnh đại diện lỗi → về chữ cái đầu
      img.addEventListener('error', function () {
        var box = img.parentNode, name = (img.getAttribute('alt') || '?').trim();
        if (box) box.textContent = (name.charAt(0) || '?').toUpperCase();
      });
    });
    rootEl.querySelectorAll('.od-photo img, .vo-photo img').forEach(function (img) {
      img.addEventListener('error', function () {
        var b = img.closest('.od-photo, .vo-photo');
        if (b) b.classList.add('is-error');
      });
    });
  }

  function orderViewSig(v) {
    if (!v) return '';
    return [v.status, v.is_mine ? '1' : '0', v.final_price || '', v.offer || '',
      (v.customer && v.customer.phone) || '', (v.my_quote && v.my_quote.status) || '', v.action || ''].join('|');
  }
  function statusRank(st) {
    return { finding: 1, matched: 2, arriving: 3, working: 4, completed: 5 }[st] || 0;
  }
  function isOlderStatus(fetched, shown) {
    var a = statusRank(fetched), b = statusRank(shown);
    return a > 0 && b > 0 && a < b;
  }
  function paintView(v) {
    lastView = v;
    viewSig = orderViewSig(v);
    unmountMap();
    rootEl.innerHTML = shell(detailMarkup(v));
    bindMedia();
    mountActions(v);
    mountMap(v);
  }
  // Sau Bắt đầu đến / Đã đến: vẽ ngay từ bản ghi vừa ghi, không chờ KIO đọc lại.
  function applyLocalOrder(row) {
    if (!rootEl || !lastView || !row) return;
    if (String(row.id || '') !== String(lastView.id || currentId)) return;
    if (isOlderStatus(row.status, lastView.status)) return;
    paintView(Object.assign({}, lastView, {
      status: row.status,
      arriving_at: row.arriving_at || lastView.arriving_at,
      working_at: row.working_at || lastView.working_at,
      timeline: row.timeline || lastView.timeline,
      is_mine: true
    }));
  }
  function reloadView(row) {
    if (row && row.status) applyLocalOrder(row);
    load(currentId, true);
  }
  function load(id, silent, retriesLeft) {
    if (loading) { pendingSilent = true; return; }
    retriesLeft = retriesLeft == null ? 0 : retriesLeft;
    var my = ++token;
    currentId = id;
    loading = true;
    if (!silent) {
      unmountMap();
      rootEl.innerHTML = shell('<main class="vo-main">' + C.loading(t('common.loading')) + '</main>');
    }
    TTV.api.getMarketOrder(id).then(function (v) {
      loading = false;
      if (my !== token || !rootEl) return;
      missRetry = 0;
      if (lastView && isOlderStatus(v.status, lastView.status)) {
        if (pendingSilent) { pendingSilent = false; load(currentId, true); }
        return;
      }
      if (silent && retriesLeft > 0 && lastView && v.status === lastView.status) {
        setTimeout(function () { if (token === my && currentId) load(currentId, true, retriesLeft - 1); }, 400);
        return;
      }
      var sig = orderViewSig(v);
      if (silent && document.querySelector('[data-vj-proof]')) {
        lastView = v;
        viewSig = sig;
      } else if (!(silent && sig === viewSig)) paintView(v);
      else lastView = v;
      if (pendingSilent) { pendingSilent = false; load(currentId, true); }
    }).catch(function (err) {
      loading = false;
      if (my !== token || !rootEl) return;
      // Chỉ LOCKED = tài khoản bị khóa. NOT_FOUND hay gặp khi KIO đang ghép payload sau khi ghi (vd. jobs_done) — không đăng xuất.
      if (err && err.code === 'LOCKED') {
        TTV.api.logoutAndGo().then(function () { C.toast(t('vendor.locked'), 'danger'); });
        return;
      }
      // Đang xem chi tiết: không nhảy sang "Không tìm thấy" khi KIO chưa kịp ghép payload sau khi ghi.
      var keep = silent && viewSig;
      var queued = pendingSilent;
      pendingSilent = false;
      if ((keep || queued) && missRetry < 4) {
        missRetry += 1;
        setTimeout(function () {
          if (token === my && currentId) load(currentId, true);
        }, 280 * missRetry);
        return;
      }
      viewSig = '';
      unmountMap();
      rootEl.innerHTML = errorMarkup(err);
    });
  }

  function render(ctx) {
    destroy();
    rootEl = app();
    clickHandler = onClick;
    rootEl.addEventListener('click', clickHandler);
    load(ctx && ctx.params && ctx.params.id, false);
    if (TTV.Live && TTV.Live.watch) {
      unwatch = TTV.Live.watch('orders', function (fromPoll) {
        if (currentId) load(currentId, true, fromPoll ? 0 : 4);
      }, { immediate: false });
    }
    if (TTV.Utils && TTV.Utils.watchUnread) stopUnread = TTV.Utils.watchUnread(rootEl);
  }
  function destroy() {
    token++;
    loading = false;
    pendingSilent = false;
    missRetry = 0;
    lastView = null;
    viewSig = '';
    closeLightbox();
    unmountMap();
    if (unwatch) { unwatch(); unwatch = null; }
    if (stopUnread) { stopUnread(); stopUnread = null; }
    if (rootEl && clickHandler) rootEl.removeEventListener('click', clickHandler);
    rootEl = null; clickHandler = null;
  }

  TTV.screens.vendorOrder = {
    render: render, destroy: destroy,
    registerActions: function (fn) { if (typeof fn === 'function') actionRenderers.push(fn); }
  };
  TTV.Router.add('/vendor/market/:id', render, { roles: ['VENDOR'], loginRoute: '/staff-login', deniedRoute: '/staff-login', destroy: destroy });
})(window.TTV);
