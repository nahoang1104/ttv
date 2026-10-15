/* Chi tiết đơn khách — #/orders/:id (task 6.2). */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var SERVICE_IMG = {
    moving: 'uploads/img-giaodien/chuyennha.png',
    warehouse: 'uploads/img-giaodien/bocxepkho1.png',
    furniture: 'uploads/img-giaodien/noithat.png',
    office: 'uploads/img-giaodien/vanphong.png',
    construction: 'uploads/img-giaodien/congtrinh.png',
    hourly: 'uploads/img-giaodien/theogio.png',
    goods: 'uploads/img-giaodien/bocvachanghoa.png'
  };
  var STEPS = ['created', 'matched', 'arriving', 'working', 'completed'];
  var STEP_STATUS = { finding: 0, matched: 1, arriving: 2, working: 3, completed: 4 };

  var rootEl = null;
  var order = null;
  var media = [];
  var services = {};
  var mapObj = null;
  var mapGen = 0;

  function esc(v) { return TTV.Components.escape(v); }
  function t(key, vars) { return TTV.I18n.t(key, vars); }
  function vnd(n) { return TTV.Utils.money(n, { currency: false }) + 'đ'; }
  function codeOf(o) { return TTV.Utils.orderCode((o && (o.code || o.id)) || ''); }

  function serviceName(code) {
    var s = services[code];
    return (s && s.name) || code || 'Đơn bốc vác';
  }
  function weightName(id) {
    var list = TTV.pricing && TTV.pricing.weightTiers ? TTV.pricing.weightTiers() : [];
    var found = null;
    list.forEach(function (w) { if (w.id === id) found = w; });
    return (found && found.name) || '';
  }
  function kmOne(n) {
    var x = Math.round((Number(n) || 0) * 10) / 10;
    return x.toFixed(1) + ' km';
  }
  function kmPay(n) {
    return (Number(n) || 0).toFixed(3) + ' km';
  }
  function createdStamp(iso) {
    var d = new Date(iso);
    if (!isFinite(d.getTime())) return '';
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ' ' + p(d.getDate()) + '-' + p(d.getMonth() + 1);
  }
  function floorText(n, elevator) {
    return t('od.floor', { n: Math.max(0, Math.round(Number(n) || 0)), lift: t(elevator ? 'od.lift.yes' : 'od.lift.no') });
  }
  function statusKey(st) {
    if (t('od.status.' + st) !== 'od.status.' + st) return 'od.status.' + st;
    return 'orders.status.finding';
  }
  function heroTone(st) {
    if (st === 'cancelled') return 'cancelled';
    if (st === 'completed') return 'done';
    return 'live';
  }
  function svcIcon(code) {
    var src = SERVICE_IMG[code] || SERVICE_IMG.goods;
    return '<img src="' + esc(src) + '" alt="">';
  }

  function unmountMap() {
    mapGen += 1;
    if (mapObj) {
      try { mapObj.remove(); } catch (_) {}
      mapObj = null;
    }
  }
  function mountMap() {
    unmountMap();
    if (!rootEl || !order || order.status === 'cancelled' || !window.L) return;
    var el = rootEl.querySelector('[data-od-map]');
    var pick = order.pickup || {}, drop = order.dropoff || {};
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
      TTV.map.routeLine(pick, drop).then(function (latlngs) {
        drawLine(latlngs);
      });
    }
    setTimeout(function () { if (mapObj && gen === mapGen) mapObj.invalidateSize(); }, 200);
  }

  function timelineHtml() {
    if (!order || order.status === 'cancelled') {
      return '<p class="od-cancel-note">' + esc(t('od.cancelledBanner')) + '</p>';
    }
    var on = STEP_STATUS[order.status];
    if (on == null) on = 0;
    return '<ol class="od-steps">' + STEPS.map(function (id, i) {
      var cls = i < on ? ' is-done' : (i === on ? ' is-on' : '');
      var time = (id === 'created' && i === on) ? createdStamp(order.created_at) : '';
      return '<li class="od-step' + cls + '"><span class="od-step__dot" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m6.5 12 3.6 3.6 7.4-8"/></svg>' +
        '</span><span class="od-step__label">' + esc(t('od.step.' + id)) + (time ? '<small>' + esc(time) + '</small>' : '') + '</span></li>';
    }).join('') + '</ol>';
  }

  function mapHtml() {
    if (!order || order.status === 'cancelled') return '';
    if (order.pickup && order.pickup.lat != null && order.dropoff && order.dropoff.lat != null) {
      return '<div class="od-map-wrap">' +
        '<div class="od-map" data-od-map></div>' +
        '<p class="od-map-legend"><span><i class="od-leg od-leg--pick"></i>' + esc(t('od.map.pick')) + '</span>' +
          '<span><i class="od-leg od-leg--drop"></i>' + esc(t('od.map.drop')) + '</span></p>' +
        '</div>';
    }
    return '';
  }

  function infoRows() {
    var w = weightName(order.weight_tier);
    var rows = [
      [t('od.weight'), w ? '(' + w + ')' : '—'],
      [t('od.pickupFloor'), floorText(order.pickup_floor, order.pickup_elevator)],
      [t('od.needUnload'), t(order.need_unload ? 'od.yes' : 'od.no')]
    ];
    if (order.need_unload !== false) rows.push([t('od.dropFloor'), floorText(order.drop_floor, order.drop_elevator)]);
    rows.push([t('od.workers'), t('od.workersN', { n: order.workers || 1 })]);
    rows.push([t('od.note'), order.note ? order.note : '—']);
    return rows.map(function (r) {
      return '<div class="od-row"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>';
    }).join('');
  }

  function photosHtml() {
    var imgs = media.filter(function (m) { return m.kind === 'image'; });
    var vids = media.filter(function (m) { return m.kind === 'video'; });
    var html = '';
    if (imgs.length) {
      html += '<h2 class="od-h">' + esc(t('od.photos', { n: imgs.length })) + '</h2>' +
        '<div class="od-photos">' + imgs.map(function (m) {
          return '<button type="button" class="od-photo" data-od-zoom="' + esc(m.path) + '"><img src="' + esc(m.path) + '" alt=""></button>';
        }).join('') + '</div>';
    }
    if (vids.length) {
      html += '<h2 class="od-h">' + esc(t('od.video')) + '</h2>' + vids.map(function (m) {
        return '<video class="od-video" controls preload="metadata" src="' + esc(m.path) + '"></video>';
      }).join('');
    }
    return html;
  }

  function typeText(v) {
    var base = t('quotes.type.' + (v.type || 'personal'));
    if (base === 'quotes.type.' + (v.type || 'personal')) base = t('quotes.vendor.unknown');
    return v.type === 'personal' ? base : base + ' · ' + t('quotes.team', { n: v.team_size || 1 });
  }
  function vendorHtml() {
    var st = order.status;
    var live = st === 'matched' || st === 'arriving' || st === 'working' || st === 'completed';
    var v = order.vendor;
    if (!live || !v) return '';
    var q = order.accepted_quote || {};
    var price = order.final_price != null ? order.final_price : q.price;
    var tel = String(v.phone || '').replace(/[^\d+]/g, '');
    var rating = Number(v.rating) > 0
      ? '★ ' + Number(v.rating).toFixed(1).replace('.', ',')
      : t('quotes.noRating');
    return '<h2 class="od-h">' + esc(t('od.vendor')) + '</h2>' +
      '<section class="od-card od-vendor">' +
        '<header class="qc-head">' + TTV.Components.avatar(v.name || '?', v.avatar_path, { size: 'md' }) +
          '<div class="qc-who"><b>' + esc(v.name || t('quotes.vendor.unknown')) + '</b>' +
            '<span>' + esc(typeText(v)) + '</span></div>' +
          '<div class="qc-price"><b>' + esc(vnd(price)) + '</b><small>' + esc(t('od.pay.total')) + '</small></div></header>' +
        '<p class="qc-meta">' + esc(rating) + ' · ' + esc(t('quotes.jobs', { n: Number(v.jobs_done) || 0 })) + '</p>' +
        (q.eta_min ? '<p class="qc-meta qc-meta--eta">' + esc(t('quotes.eta', { n: q.eta_min })) + '</p>' : '') +
        (q.message ? '<p class="qc-msg">“' + esc(q.message) + '”</p>' : '') +
        (tel ? '<a class="btn btn-secondary btn-block qc-call" href="tel:' + esc(tel) + '">' + esc(t('quotes.call', { phone: v.phone })) + '</a>' : '') +
      '</section>';
  }
  function payHtml() {
    var pb = order.price_breakdown || {};
    var w = weightName(order.weight_tier);
    var lines = [
      [t('od.pay.base'), vnd(pb.base)],
      [t('od.pay.weight', { name: w || '—' }), vnd(pb.weight)]
    ];
    if (Number(pb.floor) > 0) lines.push([t('od.pay.floor'), vnd(pb.floor)]);
    lines.push([t('od.pay.km', { km: kmPay(order.distance_km) }), vnd(pb.distance)]);
    var matched = order.final_price != null && order.status !== 'finding';
    var totalLabel = matched ? t('od.pay.total') : t('od.pay.max');
    var total = matched ? order.final_price : order.user_offer;
    var pay = order.pay_method === 'wallet' ? t('od.pay.wallet') : t('od.pay.cash');
    return '<section class="od-card od-pay">' +
      '<h2 class="od-h od-h--in">' + esc(t('od.pay')) + '</h2>' +
      lines.map(function (r) {
        return '<div class="od-row od-row--soft"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>';
      }).join('') +
      '<div class="od-row od-row--total"><span>' + esc(totalLabel) + '</span><b>' + esc(vnd(total)) + '</b></div>' +
      '<div class="od-row od-row--soft"><span>' + esc(t('od.pay.method')) + '</span><b>' + esc(pay) + '</b></div>' +
      '</section>';
  }

  function actionsHtml() {
    var st = order.status;
    if (st === 'finding') {
      return '<div class="od-bar">' +
        '<button type="button" class="btn btn-primary od-bar__go" data-od-quotes>' + esc(t('od.quotes')) + '</button>' +
        '<button type="button" class="od-bar__cancel" data-od-cancel>' + esc(t('quotes.cancel')) + '</button>' +
        '</div>';
    }
    if (st === 'cancelled' || st === 'completed') {
      return '<div class="od-bar od-bar--one">' +
        '<button type="button" class="btn btn-primary od-bar__go" data-od-reorder>' + esc(t('od.reorder')) + '</button>' +
        '</div>';
    }
    return '';
  }

  function closeDlg() {
    var dlg = document.querySelector('[data-quotes-dlg]');
    if (dlg) dlg.remove();
  }
  function openCancelDlg() {
    if (!order) return;
    closeDlg();
    document.body.insertAdjacentHTML('beforeend',
      '<div class="quotes-dlg" data-quotes-dlg>' +
        '<div class="quotes-dlg__card" role="dialog" aria-modal="true">' +
          '<h3>' + esc(t('quotes.cancel.title')) + '</h3>' +
          '<p>' + esc(t('quotes.cancel.body')) + '</p>' +
          '<div class="quotes-dlg__acts">' +
            '<button type="button" class="quotes-dlg__no" data-quotes-dlg-no>' + esc(t('quotes.cancel.no')) + '</button>' +
            '<button type="button" class="quotes-dlg__yes" data-quotes-dlg-yes>' + esc(t('quotes.cancel.yes')) + '</button>' +
          '</div></div></div>');
    var dlg = document.querySelector('[data-quotes-dlg]');
    if (!dlg) return;
    dlg.querySelector('[data-quotes-dlg-no]').addEventListener('click', closeDlg);
    dlg.querySelector('[data-quotes-dlg-yes]').addEventListener('click', function () {
      closeDlg();
      TTV.api.cancelFindingOrder(order.id).then(function () {
        TTV.Components.toast(t('quotes.cancel.done'), 'success');
        TTV.Router.navigate('/orders');
      }).catch(function (err) {
        TTV.Components.toast((err && err.message) || t('quotes.cancel.fail'), 'danger');
      });
    });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) closeDlg(); });
  }

  function copyCode() {
    var text = codeOf(order);
    var ok = function () { TTV.Components.toast(t('od.copy'), 'success'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok).catch(function () {
        TTV.Components.toast(t('od.copyFail'), 'danger');
      });
    } else TTV.Components.toast(t('od.copyFail'), 'danger');
  }

  function openZoom(src) {
    closeZoom();
    document.body.insertAdjacentHTML('beforeend',
      '<div class="vo-lightbox" data-od-lb><button type="button" class="vo-lightbox__close" data-od-lb-x aria-label="Đóng">×</button>' +
      '<img src="' + esc(src) + '" alt=""></div>');
    var lb = document.querySelector('[data-od-lb]');
    if (!lb) return;
    lb.addEventListener('click', function (e) {
      if (e.target === lb || e.target.closest('[data-od-lb-x]')) closeZoom();
    });
  }
  function closeZoom() {
    var lb = document.querySelector('[data-od-lb]');
    if (lb) lb.remove();
  }

  function paint() {
    if (!rootEl || !order) return;
    var st = order.status;
    var pick = (order.pickup && order.pickup.addr) || '—';
    var drop = (order.dropoff && order.dropoff.addr) || '—';
    rootEl.classList.add('is-order');
    rootEl.innerHTML =
      '<header class="app-header od-header">' +
        '<button type="button" class="app-header__back" data-back data-after-place="' + esc(order.id) + '" data-back-fallback="/orders" aria-label="Quay lại">‹</button>' +
        '<h1>' + esc(t('od.title')) + '</h1>' +
        '<div class="od-head-acts">' +
          '<button type="button" data-od-share aria-label="Chia sẻ"><svg viewBox="0 0 24 24" width="22" height="22"><circle cx="18" cy="5" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="6" cy="12" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="19" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="m8 13 8 5M8 11l8-5"/></svg></button>' +
          '<button type="button" data-od-mark aria-label="Đánh dấu"><svg viewBox="0 0 24 24" width="22" height="22"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M7 4.5h10v15l-5-3.2-5 3.2z"/></svg></button>' +
        '</div></header>' +
      '<main class="od-page">' +
        '<section class="od-hero od-hero--' + heroTone(st) + '">' +
          '<span class="od-hero__ico">' + svcIcon(order.service) + '</span>' +
          '<div><p class="od-hero__st">' + esc(t(statusKey(st))) + '</p>' +
            '<p class="od-hero__svc">' + esc(serviceName(order.service)) + '</p>' +
            '<button type="button" class="od-hero__code" data-od-copy>' + esc(codeOf(order)) +
              '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="8" y="8" width="10" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path fill="none" stroke="currentColor" stroke-width="1.7" d="M6 16V5.5h9"/></svg></button>' +
            '<p class="od-hero__ago">' + esc(TTV.Utils.relativeTime(order.created_at)) + '</p></div></section>' +
        timelineHtml() +
        mapHtml() +
        '<h2 class="od-h">' + esc(t('od.route')) + '</h2>' +
        '<section class="od-card">' +
          '<div class="od-stop"><i class="od-ico od-ico--pick"></i><div><small>' + esc(t('od.route.pick')) + '</small><p>' + esc(pick) + '</p></div></div>' +
          '<div class="od-stop"><i class="od-ico od-ico--drop"></i><div><small>' + esc(t('od.route.drop')) + '</small><p>' + esc(drop) + '</p></div></div>' +
          '<div class="od-stop od-stop--km"><i class="od-ico od-ico--km"></i><div><small>' + esc(t('od.route.km')) + '</small><p>' + esc(kmOne(order.distance_km)) + '</p></div></div>' +
        '</section>' +
        '<h2 class="od-h">' + esc(t('od.info')) + '</h2>' +
        '<section class="od-card od-card--rows">' + infoRows() + '</section>' +
        vendorHtml() +
        photosHtml() +
        payHtml() +
      '</main>' +
      actionsHtml();
    bind();
    mountMap();
  }

  function bind() {
    if (!rootEl) return;
    var copy = rootEl.querySelector('[data-od-copy]');
    if (copy) copy.addEventListener('click', copyCode);
    var share = rootEl.querySelector('[data-od-share]');
    if (share) share.addEventListener('click', function () { TTV.Components.toast(t('od.shareSoon'), 'info'); });
    var quotes = rootEl.querySelector('[data-od-quotes]');
    if (quotes) quotes.addEventListener('click', function () { TTV.Router.navigate('/orders/' + order.id + '/quotes'); });
    var cancel = rootEl.querySelector('[data-od-cancel]');
    if (cancel) cancel.addEventListener('click', openCancelDlg);
    var reorder = rootEl.querySelector('[data-od-reorder]');
    if (reorder) reorder.addEventListener('click', function () {
      TTV.Router.navigate('/create/order?reorder=' + encodeURIComponent(order.id));
    });
    rootEl.querySelectorAll('[data-od-zoom]').forEach(function (btn) {
      btn.addEventListener('click', function () { openZoom(btn.getAttribute('data-od-zoom')); });
    });
  }

  function paintError(msg) {
    if (!rootEl) return;
    unmountMap();
    rootEl.classList.add('is-order');
    var oid = order && order.id ? order.id : '';
    rootEl.innerHTML = '<header class="app-header od-header"><button type="button" class="app-header__back" data-back data-after-place="' + esc(oid) + '" data-back-fallback="/orders" aria-label="Quay lại">‹</button><h1>' +
      esc(t('od.title')) + '</h1></header><main class="page">' + TTV.Components.emptyState(t('od.err'), msg || '') + '</main>';
  }

  TTV.screens.orderDetail = {
    render: function (container, ctx) {
      this.destroy();
      rootEl = container;
      var id = ctx && ctx.params && ctx.params.id;
      rootEl.classList.add('is-order');
      rootEl.innerHTML = '<header class="app-header od-header"><button type="button" class="app-header__back" data-back data-after-place="' + esc(id || '') + '" data-back-fallback="/orders" aria-label="Quay lại">‹</button><h1>' +
        esc(t('od.title')) + '</h1></header><main class="page">' + TTV.Components.loading(t('common.loading')) + '</main>';
      var ready = TTV.pricing && TTV.pricing.ready ? TTV.pricing.ready() : Promise.resolve();
      ready.then(function () {
        return Promise.all([TTV.api.getOrder(id), TTV.api.listServices(), TTV.api.listOrderMedia(id)]);
      }).then(function (pack) {
        order = pack[0];
        services = {};
        (pack[1] || []).forEach(function (s) { services[s.code || s.id] = s; });
        media = pack[2] || [];
        paint();
      }).catch(function (err) {
        paintError((err && err.message) || t('od.err'));
      });
    },
    destroy: function () {
      unmountMap();
      closeDlg();
      closeZoom();
      if (rootEl) rootEl.classList.remove('is-order');
      rootEl = null;
      order = null;
      media = [];
    }
  };
})(window.TTV);
