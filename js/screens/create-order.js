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

  var state = null;
  var services = [];
  var rootEl = null;

  function esc(v) { return TTV.Components.escape(v); }
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
      video: '<svg viewBox="0 0 24 24"><rect x="4" y="7" width="11" height="10" rx="2" fill="none" stroke="#3d8adf" stroke-width="1.7"/><path fill="#3d8adf" d="m16 10 4-2v8l-4-2z"/></svg>',
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

  function kmText() {
    if (!TTV.map || state.pickupLat == null || state.dropLat == null) return '— km';
    var km = TTV.map.distanceKm(
      { lat: state.pickupLat, lng: state.pickupLng },
      { lat: state.dropLat, lng: state.dropLng }
    );
    if (km == null) return '— km';
    return km.toFixed(2).replace('.', ',') + ' km';
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
          '<p class="order-kicker">NƠI BỐC HÀNG</p>' +
          rowIcon('floor', 'Số tầng', '', stepper('pickupFloor', state.pickupFloor, 0, 50)) +
          rowIcon('lift', 'Có thang máy', '<span class="order-sub">giảm 70% phí tầng</span>', toggle('pickupElevator', state.pickupElevator)) +
          '<p class="order-kicker">NƠI DỠ HÀNG</p>' +
          rowIcon('floor', 'Có cần dỡ hàng không', '<span class="order-sub">Thợ bê hàng lên đúng tầng khi giao</span>', toggle('needUnload', state.needUnload)) +
          dropBlock +
          rowIcon('people', 'Số thợ', '<span class="order-sub">Chọn tốc độ nhận đơn bên dưới</span>', stepper('workers', state.workers, 1, 10)) +
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
        '<section class="order-card">' +
          '<div class="order-media-head"><p>Thêm tối đa 7 ảnh để thợ hình dung công việc</p><span>0/7</span></div>' +
          '<div class="order-thumbs"><button type="button" class="order-add-photo" data-action="add-photo">' + ico('cam') + '<small>Thêm</small></button></div>' +
        '</section>' +
        '<h2 class="order-title">Video hiện trạng hàng hóa <span>(tùy chọn)</span></h2>' +
        '<button type="button" class="order-card order-video" data-action="add-video">' +
          '<span class="order-video__ico">' + ico('video') + '</span>' +
          '<span><strong>Quay video hiện trạng</strong><small>Tối đa 2 phút — bằng chứng bổ sung ngoài ảnh</small></span>' +
          '<span class="order-chevron">›</span></button>' +
        '<button type="button" class="order-pay-head" data-action="toggle-offer">Số tiền bạn trả · ' + esc(SPEEDS.filter(function (s) { return s.id === state.speed; })[0].name) + ' ⓘ <span class="order-chevron' + (state.offerOpen ? ' is-up' : '') + '">›</span></button>' +
        (state.offerOpen ? (
          '<section class="order-card order-offer">' +
            '<div class="order-offer__top"><strong class="' + (state.offer ? '' : 'is-empty') + '">' + esc(offerText) + '</strong>' + ico('pencil') + '</div>' +
            '<p class="order-hint">Bạn sẵn sàng trả bao nhiêu cho việc này?</p>' +
            '<label class="order-amount"><input type="text" inputmode="numeric" data-offer placeholder="Tối thiểu 10.000" value="' + esc(state.offer || '') + '"><span>đ</span></label>' +
            '<p class="order-hint">Bạn tự quyết mức giá · tối thiểu 10.000đ</p>' +
            '<div class="order-pay">' +
              '<button type="button" class="order-pay__btn' + (state.pay === 'cash' ? ' is-selected' : '') + '" data-pay="cash">' + ico('cash') + ' Tiền mặt</button>' +
              '<button type="button" class="order-pay__btn' + (state.pay === 'wallet' ? ' is-selected' : '') + '" data-pay="wallet">' + ico('wallet') + ' Ví<small>Số dư 0đ</small></button>' +
            '</div></section>'
        ) : '') +
      '</main>' +
      '<div class="order-bar"><button type="button" class="btn btn-block order-submit" disabled>Chọn điểm bốc &amp; điểm trả</button></div>';
  }

  function paint() {
    if (!rootEl) return;
    var note = state.note;
    var offer = state.offer;
    rootEl.classList.remove('is-wide');
    rootEl.innerHTML = '<div class="order">' + markup() + '</div>';
    var noteEl = rootEl.querySelector('[data-note]');
    if (noteEl) noteEl.value = note;
    var offerEl = rootEl.querySelector('[data-offer]');
    if (offerEl) offerEl.value = offer;
    rootEl.querySelector('.order').addEventListener('click', onClick);
    rootEl.querySelector('.order').addEventListener('change', onChange);
    var offerInput = rootEl.querySelector('[data-offer]');
    if (offerInput) offerInput.addEventListener('input', function () { state.offer = offerInput.value.replace(/\D/g, ''); });
    var noteInput = rootEl.querySelector('[data-note]');
    if (noteInput) noteInput.addEventListener('input', function () { state.note = noteInput.value; });
  }

  function onChange(e) {
    var tog = e.target.closest('[data-toggle]');
    if (!tog) return;
    var key = tog.getAttribute('data-toggle');
    state[key] = tog.checked;
    if (key === 'needUnload') paint();
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
    if (pay) { state.pay = pay.getAttribute('data-pay'); paint(); return; }
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
    if (key === 'toggle-offer') { state.offerOpen = !state.offerOpen; paint(); return; }
    if (key === 'add-photo' || key === 'add-video') {
      TTV.Components.toast('Tải ảnh/video sẽ làm khi nối upload.', 'info'); return;
    }
    if (key === 'speed-done') { closeSheet(); paint(); }
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
    }
  });

  TTV.screens.createOrder = {
    render: function (container, ctx) {
      ctx = ctx || {};
      var query = (ctx.query) || {};
      var pasted = '';
      try { pasted = sessionStorage.getItem(TTV.screens.home && TTV.screens.home.pasteKey) || ''; } catch (_) {}
      rootEl = container;
      state = {
        service: query.service || 'moving',
        pickup: '',
        pickupLat: null,
        pickupLng: null,
        dropoff: pasted || '',
        dropLat: null,
        dropLng: null,
        weight: 'medium',
        pickupFloor: 0,
        pickupElevator: false,
        needUnload: true,
        dropFloor: 0,
        dropElevator: false,
        workers: 1,
        note: '',
        speed: 'default',
        provider: 'any',
        offer: '',
        offerOpen: true,
        pay: 'wallet'
      };
      TTV.api.listServices().then(function (rows) {
        services = rows || [];
        paint();
      }).catch(function () {
        services = [];
        paint();
      });
    },
    destroy: function () {
      closeSheet();
      if (TTV.ui.placePicker) TTV.ui.placePicker.close();
      rootEl = null;
      state = null;
    }
  };
})(window.TTV);
