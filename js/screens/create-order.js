/* Màn Đặt đơn bốc vác — giao diện (bám docs/reference/05-*). Chưa tạo đơn / tính giá. */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var WEIGHTS = [
    { id: 'light', name: 'Nhẹ', hint: 'Dưới 30kg · vài thùng, đồ lặt vặt' },
    { id: 'medium', name: 'Vừa', hint: '30-100kg · đồ 1 phòng, vài món nội thất' },
    { id: 'heavy', name: 'Nặng', hint: '100-300kg · đồ cả căn hộ' },
    { id: 'very_heavy', name: 'Rất nặng', hint: 'Trên 300kg · nhà nguyên căn, kho hàng' }
  ];
  var SPEEDS = [
    { id: 'default', name: 'Mặc định', desc: 'Giá tốt nhất — chờ thợ báo giá (thường vài chục phút)' },
    { id: 'fast', name: 'Nhanh', desc: 'Nhận thợ nhanh hơn — giá nhà hơn Mặc định' },
    { id: 'urgent', name: 'Gấp', desc: 'Ưu tiên tốc độ tuyệt đối — giá tăng dần tới khi có thợ nhận' }
  ];
  var PROVIDERS = [
    { id: 'any', name: 'Không quan trọng' },
    { id: 'personal', name: 'Cá nhân' },
    { id: 'team', name: 'Tổ đội' },
    { id: 'company', name: 'Công ty' }
  ];
  var SERVICE_IMG = { moving: 'uploads/img-giaodien/chuyennha.png', goods: 'uploads/img-giaodien/bocvachanghoa.png' };

  var MAX_PHOTOS = 7;
  var PHOTO_LOAD_MS = 12000;
  var MIN_OFFER = 10000;
  var DRAFT_KEY = 'ttv_draft_order';
  var state = null;
  var services = [];
  var rootEl = null;

  function esc(v) { return TTV.Components.escape(v); }
  function persistDraft() {
    if (!state) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        service: state.service, pickup: state.pickup, pickupLat: state.pickupLat, pickupLng: state.pickupLng,
        dropoff: state.dropoff, dropLat: state.dropLat, dropLng: state.dropLng, weight: state.weight,
        pickupFloor: state.pickupFloor, pickupElevator: state.pickupElevator, needUnload: state.needUnload,
        dropFloor: state.dropFloor, dropElevator: state.dropElevator, workers: state.workers, note: state.note,
        speed: state.speed, provider: state.provider, offer: state.offer, pay: state.pay
      }));
    } catch (_) {}
  }
  function readDraft() {
    try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null'); } catch (_) { return null; }
  }
  function money(n) { return TTV.Utils.money(n); }
  function weightHint() {
    var w = WEIGHTS.filter(function (x) { return x.id === state.weight; })[0];
    return w ? w.hint : '';
  }
  function speedLabel() {
    var s = SPEEDS.filter(function (x) { return x.id === state.speed; })[0];
    var name = s ? s.name : 'Mặc định';
    if (state.offer) return name + ' · ' + money(state.offer);
    return name;
  }
  function ico(name) {
    var map = {
      pin: '<svg viewBox="0 0 24 24"><path fill="#22a06b" d="M12 3.2a5.4 5.4 0 0 0-5.4 5.4c0 4 5.4 11.2 5.4 11.2s5.4-7.2 5.4-11.2A5.4 5.4 0 0 0 12 3.2zm0 7.3a1.9 1.9 0 1 1 0-3.8 1.9 1.9 0 0 1 0 3.8z"/></svg>',
      flag: '<svg viewBox="0 0 24 24"><path fill="#e5484d" d="M7 4.2h.2c2.4 1.6 4.6 1.6 7.1 0l.7-.4v11.2c-2.6 1.7-5 1.7-7.6 0H7z"/><path fill="#e5484d" d="M7 3.5h1.4v17H7z"/></svg>',
      swap: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M7 8h10M14.5 5.5 17 8l-2.5 2.5M17 16H7M9.5 13.5 7 16l2.5 2.5"/></svg>',
      weight: '<svg viewBox="0 0 24 24"><path fill="none" stroke="#5b6b80" stroke-width="1.7" d="M7 10h10l-1.4 8H8.4z"/><circle cx="12" cy="7" r="2.1" fill="none" stroke="#5b6b80" stroke-width="1.7"/></svg>',
      floor: '<svg viewBox="0 0 24 24"><path fill="none" stroke="#5b6b80" stroke-width="1.7" d="M4 18h16M6 18V8l6-3 6 3v10"/></svg>',
      lift: '<svg viewBox="0 0 24 24"><rect x="7" y="4" width="10" height="16" rx="1.4" fill="none" stroke="#5b6b80" stroke-width="1.7"/><path fill="none" stroke="#5b6b80" stroke-width="1.6" d="m10 11 2-2 2 2M10 14h4"/></svg>',
      people: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="2.1" fill="none" stroke="#5b6b80" stroke-width="1.7"/><circle cx="15.2" cy="8.4" r="1.7" fill="none" stroke="#5b6b80" stroke-width="1.6"/><path fill="none" stroke="#5b6b80" stroke-width="1.7" d="M5.4 17.5c.6-2.8 2.4-4.2 4.8-4.2s4.2 1.4 4.8 4.2M15 13.6c1.6.2 2.8 1.3 3.3 3.4"/></svg>',
      note: '<svg viewBox="0 0 24 24"><path fill="none" stroke="#5b6b80" stroke-width="1.7" d="M7 4.5h10v15H7z"/><path stroke="#5b6b80" stroke-width="1.6" d="M9.5 8.5h5M9.5 12h5M9.5 15.5h3.5"/></svg>',
      clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="#5b6b80" stroke-width="1.7"/><path stroke="#5b6b80" stroke-width="1.7" stroke-linecap="round" d="M12 8v4.2l3 1.8"/></svg>',
      cam: '<svg viewBox="0 0 24 24"><path fill="none" stroke="#8b96a8" stroke-width="1.7" d="M4.5 8.2h3l1.4-2.2h6.2L16.5 8.2h3v10.2h-15z"/><circle cx="12" cy="13.2" r="3.1" fill="none" stroke="#8b96a8" stroke-width="1.7"/></svg>',
      trash: '<svg viewBox="0 0 24 24"><path fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" d="M8 8h8M10 8V6.8h4V8M9.2 8l.6 10h4.4l.6-10"/></svg>',
      video: '<svg viewBox="0 0 24 24"><rect x="4" y="7" width="11" height="10" rx="2" fill="none" stroke="#fff" stroke-width="1.7"/><path fill="#fff" d="m16 10 4-2v8l-4-2z"/></svg>',
      play: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M9 6.8v10.4L19 12z"/></svg>',
      playOk: '<svg viewBox="0 0 24 24"><path fill="#16a34a" d="M9 6.8v10.4L19 12z"/></svg>',
      redo: '<svg viewBox="0 0 24 24"><path fill="none" stroke="#2563eb" stroke-width="1.8" stroke-linecap="round" d="M7.2 8.2A6.2 6.2 0 1 1 6 12"/><path fill="#2563eb" d="M7.2 4.8v4.2h4.2"/></svg>',
      trashRed: '<svg viewBox="0 0 24 24"><path fill="none" stroke="#e11d48" stroke-width="1.8" stroke-linecap="round" d="M8 8h8M10 8V6.8h4V8M9.2 8l.6 10h4.4l.6-10"/></svg>',
      cash: '<svg viewBox="0 0 24 24"><rect x="3.5" y="7" width="17" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.1" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
      wallet: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.7" d="M4.5 8h15v9.5h-15z"/><path fill="none" stroke="currentColor" stroke-width="1.7" d="M4.8 8 13.5 5.2 19.2 8"/><circle cx="16.2" cy="12.8" r="1" fill="currentColor"/></svg>',
      pencil: '<svg viewBox="0 0 24 24"><path fill="none" stroke="#1b7be4" stroke-width="1.7" d="M5 16.8 15.6 6.2l2.2 2.2L7.2 19H5z"/></svg>'
    };
    return map[name] || '';
  }

  function rowIcon(name, title, sub, extra) {
    return '<div class="order-row">' +
      '<span class="order-row__ico">' + ico(name) + '</span>' +
      '<div class="order-row__txt"><strong>' + esc(title) + '</strong>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>' +
      (extra || '') + '</div>';
  }

  function stepper(key, value, min, max) {
    return '<div class="order-stepper" data-step-key="' + key + '" data-min="' + min + '" data-max="' + max + '">' +
      '<button type="button" data-step="-1" aria-label="Giảm">−</button>' +
      '<output>' + esc(value) + '</output>' +
      '<button type="button" data-step="1" aria-label="Tăng">+</button></div>';
  }

  function toggle(key, on) {
    return '<label class="order-switch"><input type="checkbox" data-toggle="' + key + '"' + (on ? ' checked' : '') + '><span></span></label>';
  }

  function photoById(id) {
    var list = (state && state.images) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function revokePhoto(item) {
    if (item && item.loadTimer) {
      clearTimeout(item.loadTimer);
      item.loadTimer = null;
    }
    if (item && item.previewUrl && item.previewUrl.indexOf('blob:') === 0) {
      try { URL.revokeObjectURL(item.previewUrl); } catch (_) {}
    }
  }
  function photoMarkup() {
    var list = (state && state.images) || [];
    var fail = 0;
    var thumbs = list.map(function (item) {
      if (item.status === 'error') fail += 1;
      var cls = 'order-thumb' + (item.status === 'error' ? ' is-error' : '') + (item.status === 'uploading' ? ' is-uploading' : '');
      return '<div class="' + cls + '" data-photo-id="' + esc(item.id) + '">' +
        '<img src="' + esc(item.previewUrl || item.path || '') + '" alt="">' +
        '<button type="button" class="order-thumb__del" data-action="remove-photo" data-id="' + esc(item.id) + '" aria-label="Xóa ảnh">' + ico('trash') + '</button>' +
        '</div>';
    }).join('');
    if (list.length < MAX_PHOTOS) {
      thumbs += '<button type="button" class="order-add-photo" data-action="add-photo">' + ico('cam') + '<small>Thêm</small></button>';
    }
    var failLine = fail
      ? '<p class="order-media-error">' + fail + ' ảnh tải không thành công (mạng chậm, tải quá lâu)</p>'
      : '';
    return '<div class="order-media-head"><p>Thêm tối đa 7 ảnh để thợ hình dung công việc</p><span>' + list.length + '/' + MAX_PHOTOS + '</span></div>' +
      '<div class="order-thumbs">' + thumbs + '</div>' + failLine;
  }
  function videoMarkup() {
    var v = state && state.video;
    if (!v) {
      return '<button type="button" class="order-card order-video" data-action="add-video">' +
        '<span class="order-video__thumb" aria-hidden="true"><span class="order-video__play">' + ico('play') + '</span></span>' +
        '<span class="order-video__txt"><strong>Quay video hiện trạng</strong><small>Tối đa 2 phút — bằng chứng bổ sung ngoài ảnh</small></span>' +
        '</button>';
    }
    var mmss = TTV.ui.orderMedia.formatDuration(v.duration);
    var thumbInner = v.poster
      ? '<img class="order-video__poster" src="' + esc(v.poster) + '" alt="">'
      : '<span class="order-video__play">' + ico('play') + '</span>';
    return '<section class="order-card order-video is-ready">' +
      '<button type="button" class="order-video__thumb" data-action="play-video" aria-label="Xem lại video">' + thumbInner + '</button>' +
      '<div class="order-video__txt">' +
        '<button type="button" class="order-video__ok" data-action="play-video">' + ico('playOk') + ' Đã quay video ' + esc(mmss) + '</button>' +
        '<div class="order-video__acts">' +
          '<button type="button" data-action="add-video">' + ico('redo') + ' Quay lại</button>' +
          '<button type="button" data-action="remove-video">' + ico('trashRed') + ' Xóa</button>' +
        '</div></div></section>';
  }
  function pickPhotos() {
    if (!state) return;
    if (state.images.length >= MAX_PHOTOS) {
      TTV.Components.toast('Chỉ thêm tối đa 7 ảnh.', 'info');
      return;
    }
    TTV.ui.orderMedia.pickImages(addPhotos);
  }
  function pickVideo() {
    if (!state) return;
    TTV.ui.orderMedia.pickVideo(function (file) {
      TTV.ui.orderMedia.readVideo(file).then(function (item) {
        if (!state) {
          TTV.ui.orderMedia.revoke(item.previewUrl);
          return;
        }
        clearVideo();
        state.video = item;
        paint();
      }).catch(function (err) {
        TTV.Components.toast((err && err.message) || 'Không dùng được video này.', 'danger');
      });
    });
  }
  function clearVideo() {
    if (state && state.video) TTV.ui.orderMedia.revoke(state.video.previewUrl);
    if (state) state.video = null;
  }
  function addPhotos(files) {
    if (!state || !files || !files.length) return;
    var room = MAX_PHOTOS - state.images.length;
    var picked = [];
    files.forEach(function (file) {
      if (picked.length >= room) return;
      if (!file || !/^image\//.test(file.type)) return;
      picked.push(file);
    });
    if (!picked.length) {
      TTV.Components.toast('Vui lòng chọn file ảnh.', 'info');
      return;
    }
    picked.forEach(function (file) {
      var item = {
        id: (TTV.Utils && TTV.Utils.id ? TTV.Utils.id() : Date.now().toString(16) + Math.random().toString(16).slice(2)).slice(0, 16),
        previewUrl: URL.createObjectURL(file),
        path: '',
        status: 'ok',
        file: file
      };
      state.images.push(item);
      if (TTV.ui.orderMedia && TTV.ui.orderMedia.uploadImage) {
        TTV.ui.orderMedia.uploadImage(file).then(function (saved) {
          if (saved && photoById(item.id)) item.path = saved.path;
        }).catch(function () {});
      }
    });
    paint();
  }
  function removePhoto(id) {
    if (!state) return;
    var next = [];
    state.images.forEach(function (item) {
      if (item.id === id) revokePhoto(item);
      else next.push(item);
    });
    state.images = next;
    paint();
  }
  function markPhotoError(id) {
    var item = photoById(id);
    if (!item || item.status === 'error') return;
    item.status = 'error';
    paint();
  }
  function bindPhotoLoads() {
    if (!rootEl || !state) return;
    rootEl.querySelectorAll('.order-thumb img').forEach(function (img) {
      var wrap = img.closest('[data-photo-id]');
      if (!wrap) return;
      var id = wrap.getAttribute('data-photo-id');
      var item = photoById(id);
      if (!item) return;
      if (item.loadTimer) {
        clearTimeout(item.loadTimer);
        item.loadTimer = null;
      }
      function fail() {
        if (!state || !photoById(id)) return;
        markPhotoError(id);
      }
      img.addEventListener('error', fail);
      if (img.complete) {
        if (!img.naturalWidth) fail();
        return;
      }
      item.loadTimer = setTimeout(fail, PHOTO_LOAD_MS);
      img.addEventListener('load', function () {
        if (item.loadTimer) {
          clearTimeout(item.loadTimer);
          item.loadTimer = null;
        }
      });
    });
  }

  function serviceIconHtml(sv) {
    var src = SERVICE_IMG[sv.code || sv.id];
    if (src) return '<img class="order-svc__img" src="' + esc(src) + '" alt="">';
    return '<span class="order-svc__emoji">' + esc(sv.icon || '📦') + '</span>';
  }

  function closeSheet() {
    var el = document.querySelector('.sheet-backdrop');
    if (el) el.remove();
  }

  function openServiceSheet() {
    var body = '<div class="order-svc-list">' + services.map(function (sv) {
      var id = sv.code || sv.id;
      return '<button type="button" class="order-svc-opt' + (id === state.service ? ' is-selected' : '') + '" data-pick-service="' + esc(id) + '">' +
        serviceIconHtml(sv) + '<span><strong>' + esc(sv.name) + '</strong><small>' + esc(sv.desc || '') + '</small></span></button>';
    }).join('') + '</div>';
    document.body.insertAdjacentHTML('beforeend', TTV.Components.sheet('Chọn dịch vụ', body));
  }

  function openSpeedSheet() {
    var radios = SPEEDS.map(function (s) {
      return '<button type="button" class="order-speed-opt' + (s.id === state.speed ? ' is-selected' : '') + '" data-pick-speed="' + s.id + '">' +
        '<span class="order-radio' + (s.id === state.speed ? ' is-on' : '') + '"></span>' +
        '<span><strong>' + esc(s.name) + '</strong><small>' + esc(s.desc) + '</small></span></button>';
    }).join('');
    var chips = PROVIDERS.map(function (p) {
      var locked = p.id === 'personal' && state.workers >= 2;
      return '<button type="button" class="order-prov' + (p.id === state.provider ? ' is-selected' : '') + (locked ? ' is-locked' : '') + '" data-pick-provider="' + p.id + '"' + (locked ? ' disabled' : '') + '>' + esc(p.name) + '</button>';
    }).join('');
    var extra = '<p class="order-speed-note">Bạn tự nhập số tiền muốn trả — thợ/tổ đội sẽ báo giá trong mức đó, bạn chọn thợ ưng ý nhất. Mức Gấp có giá tăng dần theo thời gian để tìm thợ nhanh hơn.</p>' +
      '<h3 class="order-h3">Loại nhà cung cấp mong muốn</h3><div class="order-prov-grid">' + chips + '</div>';
    document.body.insertAdjacentHTML('beforeend', TTV.Components.sheet('Tốc độ nhận đơn', radios + extra, {
      footer: '<button type="button" class="btn btn-primary btn-block" data-action="speed-done">Xong</button>'
    }));
  }

  function currentService() {
    return services.filter(function (s) { return (s.code || s.id) === state.service; })[0] || { name: 'Chuyển nhà', code: 'moving', icon: '🏠' };
  }

  function hasRoute() {
    return !!(state && state.pickup && state.dropoff && state.pickupLat != null && state.dropLat != null);
  }
  function offerAmount() {
    return parseInt(String(state && state.offer || ''), 10) || 0;
  }
  function currentQuote() {
    var sv = currentService();
    return TTV.pricing.quote({
      basePrice: sv.base_price,
      weight: state.weight,
      km: distanceKm(),
      pickupFloor: state.pickupFloor,
      pickupElevator: state.pickupElevator,
      needUnload: state.needUnload,
      dropFloor: state.dropFloor,
      dropElevator: state.dropElevator,
      workers: state.workers
    });
  }
  function urgentMinOffer() {
    return TTV.pricing.urgentMin(currentQuote().total);
  }
  function minOfferNow() {
    if (state && state.speed === 'urgent') return Math.max(MIN_OFFER, urgentMinOffer());
    return MIN_OFFER;
  }
  function applyUrgentFloor() {
    if (!state || state.speed !== 'urgent') return;
    var min = urgentMinOffer();
    if (offerAmount() < min) state.offer = String(min);
  }
  function canSubmit() {
    return hasRoute() && offerAmount() >= minOfferNow();
  }
  function submitButtonHtml() {
    if (!hasRoute()) {
      return '<button type="button" class="btn btn-block order-submit" disabled>Chọn điểm bốc &amp; điểm trả</button>';
    }
    if (!canSubmit()) {
      return '<button type="button" class="btn btn-block order-submit" disabled>Nhập số tiền bạn sẵn sàng trả</button>';
    }
    return '<button type="button" class="btn btn-primary btn-block order-submit" data-action="submit-order">Đặt đơn</button>';
  }
  function syncSubmit() {
    if (!rootEl) return;
    var bar = rootEl.querySelector('.order-bar');
    if (bar) bar.innerHTML = submitButtonHtml();
  }
  function distanceKm() {
    if (!TTV.map || !state || state.pickupLat == null || state.dropLat == null) return 0;
    var km = TTV.map.distanceKm(
      { lat: state.pickupLat, lng: state.pickupLng },
      { lat: state.dropLat, lng: state.dropLng }
    );
    return km == null ? 0 : km;
  }
  function kmText() {
    var km = distanceKm();
    if (!hasRoute()) return '— km';
    return km.toFixed(2).replace('.', ',') + ' km';
  }
  function urgentWarnHtml() {
    if (!state || state.speed !== 'urgent') return '';
    var min = urgentMinOffer();
    if (offerAmount() >= min) return '';
    return '<p class="order-offer__warn" data-urgent-warn>Đơn GẤP cần mức tối đa từ ' + money(min) + ' trở lên (bằng giá khởi điểm gấp)</p>';
  }
  function quoteLines() {
    if (offerAmount() < MIN_OFFER) return '';
    var q = currentQuote();
    var workerLine = q.workersFee
      ? '<li><span>Số thợ (×' + q.workers + ')</span><b>' + money(q.workersFee) + '</b></li>'
      : '';
    return '<ul class="order-quote" data-quote>' +
      '<li><span>Giá cơ bản</span><b>' + money(q.base) + '</b></li>' +
      '<li><span>Phí trọng lượng (' + esc(q.weightName) + ')</span><b>' + money(q.weight) + '</b></li>' +
      '<li><span>Phí tầng (' + esc(q.floorLabel) + ')</span><b>' + money(q.floor) + '</b></li>' +
      '<li><span>Phí khoảng cách (' + esc(q.kmLabel) + ')</span><b>' + money(q.distance) + '</b></li>' +
      workerLine +
      '</ul>';
  }
  function syncQuote() {
    if (!rootEl) return;
    var box = rootEl.querySelector('[data-quote]');
    var html = quoteLines();
    if (box && html) box.outerHTML = html;
    else if (box && !html) box.remove();
    else if (html) {
      var pay = rootEl.querySelector('.order-pay');
      if (pay) pay.insertAdjacentHTML('beforebegin', html);
    }
    syncUrgentWarn();
  }
  function syncUrgentWarn() {
    if (!rootEl) return;
    var html = urgentWarnHtml();
    var el = rootEl.querySelector('[data-urgent-warn]');
    if (el && html) { el.outerHTML = html; return; }
    if (el && !html) { el.remove(); return; }
    if (!html) return;
    var hint = rootEl.querySelector('.order-offer .order-hint');
    if (hint) hint.insertAdjacentHTML('beforebegin', html);
  }

  function markup() {
    var sv = currentService();
    var dropBlock = state.needUnload ? (
      rowIcon('floor', 'Số tầng', '', stepper('dropFloor', state.dropFloor, 0, 50)) +
      rowIcon('lift', 'Có thang máy', '<span class="order-sub">giảm 70% phí tầng</span>', toggle('dropElevator', state.dropElevator))
    ) : '';
    var offerText = state.offer ? money(state.offer) : 'Chưa nhập';
    return TTV.Components.header('Đặt đơn bốc vác', { back: true }) +
      '<main class="order-page">' +
        '<section class="order-card order-route">' +
          '<button type="button" class="order-swap" data-action="swap">' + ico('swap') + ' Hoán đổi</button>' +
          '<button type="button" class="order-stop" data-action="pick-pickup">' +
            '<span class="order-stop__ico">' + ico('pin') + '</span>' +
            '<span><strong>Điểm bốc hàng</strong><small>' + esc(state.pickup || 'Chọn điểm bốc hàng') + '</small></span></button>' +
          '<span class="order-route__line"></span>' +
          '<div class="order-stop-wrap">' +
            '<button type="button" class="order-stop" data-action="pick-dropoff">' +
              '<span class="order-stop__ico">' + ico('flag') + '</span>' +
              '<span><strong>Điểm trả hàng</strong><small>' + esc(state.dropoff || 'Chọn điểm trả hàng') + '</small></span></button>' +
            '<span class="order-km">' + esc(kmText()) + '</span>' +
          '</div>' +
          '<button type="button" class="order-add-stop" disabled>+ Thêm điểm trả (sắp có)</button>' +
        '</section>' +
        '<button type="button" class="order-card order-svc" data-action="change-service">' +
          serviceIconHtml(sv) + '<span>Dịch vụ: <b>' + esc(sv.name) + '</b></span><em>Đổi</em></button>' +
        '<h2 class="order-title">Chi tiết công việc</h2>' +
        '<section class="order-card">' +
          rowIcon('weight', 'Trọng lượng', '') +
          '<div class="order-weights">' + WEIGHTS.map(function (w) {
            return '<button type="button" class="order-chip' + (w.id === state.weight ? ' is-selected' : '') + '" data-weight="' + w.id + '">' + esc(w.name) + '</button>';
          }).join('') + '</div>' +
          '<p class="order-hint">' + esc(weightHint()) + '</p>' +
          '<p class="order-kicker">Nơi bốc hàng</p>' +
          rowIcon('floor', 'Số tầng', '', stepper('pickupFloor', state.pickupFloor, 0, 50)) +
          rowIcon('lift', 'Có thang máy', '<span class="order-sub">giảm 70% phí tầng</span>', toggle('pickupElevator', state.pickupElevator)) +
          '<p class="order-kicker">Nơi dỡ hàng</p>' +
          rowIcon('floor', 'Có cần dỡ hàng không', '<span class="order-sub">Thợ bê hàng lên đúng tầng khi giao</span>', toggle('needUnload', state.needUnload)) +
          dropBlock +
          rowIcon('people', 'Số thợ', '<span class="order-sub">' + (state.workers >= 2 ? 'Từ 2 thợ: chỉ Tổ đội/Công ty báo giá trọn gói' : 'Chọn tốc độ nhận đơn bên dưới') + '</span>', stepper('workers', state.workers, 1, 10)) +
          '<div class="order-row order-note-row">' +
            '<span class="order-row__ico">' + ico('note') + '</span>' +
            '<strong>Ghi chú cho thợ</strong>' +
            '<input class="order-note" data-note placeholder="Ví dụ: Hàng dễ vỡ…">' +
          '</div>' +
          '<div class="order-row">' +
            '<span class="order-row__ico">' + ico('clock') + '</span>' +
            '<div class="order-row__txt"><strong>Thời gian thực hiện</strong></div>' +
            '<div class="order-when">' +
              '<button type="button" class="order-when__btn is-on" data-when="now">Đặt ngay</button>' +
              '<button type="button" class="order-when__btn is-locked" disabled>Đặt lịch</button>' +
            '</div></div>' +
        '</section>' +
        '<h2 class="order-title">Tốc độ nhận đơn</h2>' +
        '<button type="button" class="order-card order-speed" data-action="open-speed">' +
          '<span>' + esc(speedLabel()) + '</span><span class="order-chevron">›</span></button>' +
        '<h2 class="order-title">Hình ảnh hàng hóa <span>(tùy chọn)</span></h2>' +
        '<section class="order-card" data-photo-card>' + photoMarkup() + '</section>' +
        '<h2 class="order-title">Video hiện trạng hàng hóa <span>(tùy chọn)</span></h2>' +
        videoMarkup() +
        '<h2 class="order-title">Số tiền bạn trả · ' + esc(SPEEDS.filter(function (s) { return s.id === state.speed; })[0].name) + '</h2>' +
        '<section class="order-card order-offer">' +
          '<div class="order-offer__top"><strong class="' + (state.offer ? '' : 'is-empty') + '">' + esc(offerText) + '</strong>' + ico('pencil') + '</div>' +
          urgentWarnHtml() +
          '<p class="order-hint">Bạn sẵn sàng trả bao nhiêu cho việc này?</p>' +
          '<label class="order-amount"><input type="text" inputmode="numeric" data-offer placeholder="Tối thiểu 10.000" value="' + esc(state.offer || '') + '"><span>đ</span></label>' +
          '<p class="order-hint">Bạn tự quyết mức giá · tối thiểu 10.000đ</p>' +
          quoteLines() +
          '<div class="order-pay">' +
            '<button type="button" class="order-pay__btn' + (state.pay === 'cash' ? ' is-selected' : '') + '" data-pay="cash">' + ico('cash') + ' Tiền mặt</button>' +
            '<button type="button" class="order-pay__btn is-locked" data-pay="wallet" disabled>' + ico('wallet') + ' Ví<small>Sắp có</small></button>' +
          '</div></section>' +
      '</main>' +
      '<div class="order-bar">' + submitButtonHtml() + '</div>';
  }

  function paint() {
    if (!rootEl) return;
    var note = state.note;
    var offer = state.offer;
    var page = rootEl.querySelector('.order-page');
    var y = page ? page.scrollTop : 0;
    rootEl.classList.remove('is-wide');
    rootEl.classList.add('is-order');
    rootEl.innerHTML = '<div class="order">' + markup() + '</div>';
    var noteEl = rootEl.querySelector('[data-note]');
    if (noteEl) noteEl.value = note;
    var offerEl = rootEl.querySelector('[data-offer]');
    if (offerEl) offerEl.value = offer;
    rootEl.querySelector('.order').addEventListener('click', onClick);
    rootEl.querySelector('.order').addEventListener('change', onChange);
    var offerInput = rootEl.querySelector('[data-offer]');
    if (offerInput) offerInput.addEventListener('input', function () {
      state.offer = offerInput.value.replace(/\D/g, '');
      var shown = rootEl.querySelector('.order-offer__top strong');
      if (shown) {
        shown.textContent = state.offer ? money(Number(state.offer)) : 'Chưa nhập';
        shown.classList.toggle('is-empty', !state.offer);
      }
      syncSubmit();
      syncQuote();
      syncUrgentWarn();
    });
    var noteInput = rootEl.querySelector('[data-note]');
    if (noteInput) noteInput.addEventListener('input', function () { state.note = noteInput.value; });
    bindPhotoLoads();
    var page2 = rootEl.querySelector('.order-page');
    if (page2) page2.scrollTop = y;
  }

  function onChange(e) {
    var tog = e.target.closest('[data-toggle]');
    if (!tog) return;
    var key = tog.getAttribute('data-toggle');
    state[key] = tog.checked;
    if (key === 'needUnload') paint();
    else { syncQuote(); syncSubmit(); }
  }

  function onClick(e) {
    var step = e.target.closest('[data-step]');
    if (step) {
      var wrap = step.closest('.order-stepper');
      var key = wrap.getAttribute('data-step-key');
      var min = +wrap.dataset.min, max = +wrap.dataset.max;
      var next = Math.max(min, Math.min(max, (Number(state[key]) || 0) + (+step.dataset.step)));
      state[key] = next;
      if (key === 'workers' && next >= 2 && state.provider === 'personal') state.provider = 'any';
      paint();
      return;
    }
    var w = e.target.closest('[data-weight]');
    if (w) { state.weight = w.getAttribute('data-weight'); paint(); return; }
    var pay = e.target.closest('[data-pay]');
    if (pay) {
      if (pay.disabled || pay.classList.contains('is-locked')) return;
      state.pay = pay.getAttribute('data-pay');
      rootEl.querySelectorAll('[data-pay]').forEach(function (el) {
        el.classList.toggle('is-selected', el.getAttribute('data-pay') === state.pay);
      });
      return;
    }
    var action = e.target.closest('[data-action]');
    if (!action) return;
    var key = action.getAttribute('data-action');
    if (key === 'swap') {
      var tmp = state.pickup; state.pickup = state.dropoff; state.dropoff = tmp;
      tmp = state.pickupLat; state.pickupLat = state.dropLat; state.dropLat = tmp;
      tmp = state.pickupLng; state.pickupLng = state.dropLng; state.dropLng = tmp;
      paint(); return;
    }
    if (key === 'pick-pickup' || key === 'pick-dropoff') {
      var mode = key === 'pick-dropoff' ? 'dropoff' : 'pickup';
      TTV.ui.placePicker.open({
        mode: mode,
        onPick: function (place) {
          if (mode === 'dropoff') {
            state.dropoff = place.addr || '';
            state.dropLat = place.lat;
            state.dropLng = place.lng;
          } else {
            state.pickup = place.addr || '';
            state.pickupLat = place.lat;
            state.pickupLng = place.lng;
          }
          paint();
        }
      });
      return;
    }
    if (key === 'change-service') { openServiceSheet(); return; }
    if (key === 'open-speed') { openSpeedSheet(); return; }
    if (key === 'submit-order') {
      if (!canSubmit()) return;
      TTV.Components.toast('Xác nhận đặt đơn sẽ mở ở bước tiếp theo.', 'info');
      return;
    }
    if (key === 'remove-photo') {
      removePhoto(action.getAttribute('data-id'));
      return;
    }
    if (key === 'add-photo') { pickPhotos(); return; }
    if (key === 'add-video') { pickVideo(); return; }
    if (key === 'play-video') {
      if (state.video && state.video.previewUrl) TTV.ui.orderMedia.preview(state.video.previewUrl);
      return;
    }
    if (key === 'remove-video') { clearVideo(); paint(); return; }
    if (key === 'speed-done') { closeSheet(); applyUrgentFloor(); paint(); }
  }

  document.addEventListener('click', function (e) {
    if (!state) return;
    var sv = e.target.closest('[data-pick-service]');
    if (sv) { state.service = sv.getAttribute('data-pick-service'); closeSheet(); paint(); return; }
    var sp = e.target.closest('[data-pick-speed]');
    if (sp) {
      state.speed = sp.getAttribute('data-pick-speed');
      document.querySelectorAll('.order-speed-opt').forEach(function (el) {
        var on = el.getAttribute('data-pick-speed') === state.speed;
        el.classList.toggle('is-selected', on);
        el.querySelector('.order-radio').classList.toggle('is-on', on);
      });
      return;
    }
    var pr = e.target.closest('[data-pick-provider]');
    if (pr && !pr.disabled) {
      state.provider = pr.getAttribute('data-pick-provider');
      document.querySelectorAll('.order-prov').forEach(function (el) {
        el.classList.toggle('is-selected', el.getAttribute('data-pick-provider') === state.provider);
      });
      return;
    }
    if (e.target.closest('[data-action="speed-done"]')) {
      closeSheet();
      applyUrgentFloor();
      paint();
    }
  });

  TTV.screens.createOrder = {
    render: function (container, ctx) {
      ctx = ctx || {};
      var query = (ctx.query) || {};
      var pasted = '';
      try { pasted = sessionStorage.getItem(TTV.screens.home && TTV.screens.home.pasteKey) || ''; } catch (_) {}
      var draft = readDraft() || {};
      rootEl = container;
      state = {
        service: query.service || draft.service || 'moving',
        pickup: draft.pickup || '',
        pickupLat: draft.pickupLat != null ? draft.pickupLat : null,
        pickupLng: draft.pickupLng != null ? draft.pickupLng : null,
        dropoff: pasted || draft.dropoff || '',
        dropLat: draft.dropLat != null ? draft.dropLat : null,
        dropLng: draft.dropLng != null ? draft.dropLng : null,
        weight: draft.weight || 'medium',
        pickupFloor: draft.pickupFloor || 0,
        pickupElevator: !!draft.pickupElevator,
        needUnload: draft.needUnload !== false,
        dropFloor: draft.dropFloor || 0,
        dropElevator: !!draft.dropElevator,
        workers: draft.workers || 1,
        note: draft.note || '',
        speed: draft.speed || 'default',
        provider: draft.provider || 'any',
        offer: draft.offer || '',
        pay: draft.pay || 'cash',
        images: [],
        video: null
      };
      Promise.all([
        TTV.api.listServices(),
        TTV.pricing && TTV.pricing.ready ? TTV.pricing.ready() : Promise.resolve()
      ]).then(function (pack) {
        services = pack[0] || [];
        paint();
      }).catch(function () {
        services = [];
        paint();
      });
    },
    destroy: function () {
      persistDraft();
      closeSheet();
      if (TTV.ui.placePicker) TTV.ui.placePicker.close();
      if (state && state.images) state.images.forEach(revokePhoto);
      clearVideo();
      if (TTV.ui.orderMedia) TTV.ui.orderMedia.destroy();
      if (rootEl) rootEl.classList.remove('is-order');
      rootEl = null;
      state = null;
    }
  };
})(window.TTV);
