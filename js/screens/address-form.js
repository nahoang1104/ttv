/* Màn Thêm địa chỉ — bám docs/reference/06-them-dia-chi-*.jpg */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var TYPES = [
    { id: 'home', name: 'Nhà', icon: 'home' },
    { id: 'office', name: 'Văn phòng', icon: 'office' },
    { id: 'warehouse', name: 'Kho', icon: 'warehouse' },
    { id: 'other', name: 'Khác', icon: 'other' }
  ];
  var state = null;
  var rootEl = null;
  var syncingToggle = false;

  function esc(v) { return TTV.Components.escape(v); }

  function typeIcon(id) {
    var map = {
      home: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.7" d="M4.8 11.2 12 5.4l7.2 5.8V19H4.8z"/><path fill="none" stroke="currentColor" stroke-width="1.7" d="M10 19v-5.2h4V19"/></svg>',
      office: '<svg viewBox="0 0 24 24"><rect x="6" y="4.5" width="12" height="15" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path stroke="currentColor" stroke-width="1.6" d="M9 8.2h2M13 8.2h2M9 11.4h2M13 11.4h2M9 14.6h2M13 14.6h2"/></svg>',
      warehouse: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.7" d="M5 9.2 12 5.8 19 9.2v9.5H5z"/><path fill="none" stroke="currentColor" stroke-width="1.7" d="M5 9.2h14M12 5.8v12.9"/></svg>',
      other: '<svg viewBox="0 0 24 24"><circle cx="7" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="17" cy="12" r="1.5" fill="currentColor"/></svg>'
    };
    return map[id] || map.other;
  }
  function typeOf(id) {
    var found = TYPES.filter(function (tp) { return tp.id === id; })[0];
    return found || TYPES[TYPES.length - 1];
  }
  TTV.Address = { types: TYPES, icon: typeIcon, of: typeOf, name: function (id) { return typeOf(id).name; } };

  function canSave() {
    if (!state) return false;
    var phone = String(state.contact_phone || '').replace(/\D/g, '');
    return !!(state.label.trim() && state.detail.trim() && state.contact_name.trim() && phone.length >= 9 && state.detail.length <= 250);
  }

  function markup() {
    var n = (state.detail || '').length;
    return TTV.Components.header(state.id ? 'Sửa địa chỉ' : 'Thêm địa chỉ', { back: true }) +
      '<main class="addr-page">' +
        '<button type="button" class="addr-map-btn" data-action="pick-map">' +
          '<span class="addr-map-btn__pin" aria-hidden="true"></span> Chọn Trên Bản Đồ</button>' +
        '<label class="addr-field">Tên gợi nhớ' +
          '<input type="text" data-field="label" maxlength="80" placeholder="VD: Nhà, Văn phòng" value="' + esc(state.label) + '">' +
        '</label>' +
        '<label class="addr-field">Địa chỉ chi tiết' +
          '<textarea data-field="detail" maxlength="250" rows="3" placeholder="VD: Số 123, Đường Lê Văn Lương, Phường Nhân Chính, Quận Thanh Xuân, Hà Nội">' + esc(state.detail) + '</textarea>' +
          '<span class="addr-count" data-count>' + n + '/250</span>' +
        '</label>' +
        '<label class="addr-field">Người liên hệ' +
          '<input type="text" data-field="contact_name" placeholder="VD: Nguyễn Văn A" value="' + esc(state.contact_name) + '">' +
        '</label>' +
        '<label class="addr-field">Số điện thoại' +
          '<input type="tel" data-field="contact_phone" inputmode="numeric" placeholder="VD: 0987 654 321" value="' + esc(state.contact_phone) + '">' +
        '</label>' +
        '<p class="addr-label">Loại địa chỉ</p>' +
        '<div class="addr-types">' + TYPES.map(function (tp) {
          return '<button type="button" class="addr-type' + (state.type === tp.id ? ' is-selected' : '') + '" data-type="' + tp.id + '">' +
            typeIcon(tp.id) + '<small>' + esc(tp.name) + '</small></button>';
        }).join('') + '</div>' +
        '<div class="addr-default">' +
          '<label class="toggle">' +
            '<span class="addr-default__txt"><strong>Mặc định điểm bốc hàng</strong>' +
              '<small>Điền sẵn vào điểm bốc khi đặt đơn</small></span>' +
            '<input type="checkbox" data-field="default_pickup"' + (state.default_for === 'pickup' ? ' checked' : '') + '>' +
            '<span class="toggle__track"></span>' +
          '</label>' +
          '<label class="toggle">' +
            '<span class="addr-default__txt"><strong>Mặc định điểm trả hàng</strong>' +
              '<small>Điền sẵn vào điểm trả khi đặt đơn</small></span>' +
            '<input type="checkbox" data-field="default_dropoff"' + (state.default_for === 'dropoff' ? ' checked' : '') + '>' +
            '<span class="toggle__track"></span>' +
          '</label>' +
        '</div>' +
      '</main>' +
      '<div class="addr-bar"><button type="button" class="btn btn-primary btn-block addr-save" data-action="save"' + (canSave() ? '' : ' disabled') + '>' +
        '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M5.2 5.2h10.2L18.8 8.6v10.2H5.2z"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="M8 5.2h8v4.6H8zM8.4 13.4h7.2v5.4H8.4z"/></svg>' +
        ' Lưu địa chỉ</button></div>';
  }

  function syncSave() {
    if (!rootEl) return;
    var btn = rootEl.querySelector('[data-action="save"]');
    var count = rootEl.querySelector('[data-count]');
    if (btn) btn.disabled = !canSave();
    if (count) count.textContent = (state.detail || '').length + '/250';
  }

  function paint() {
    if (!rootEl) return;
    rootEl.classList.remove('is-wide');
    rootEl.innerHTML = '<div class="addr">' + markup() + '</div>';
    var box = rootEl.querySelector('.addr');
    box.addEventListener('click', onClick);
    box.addEventListener('input', onInput);
    box.addEventListener('change', onChange);
  }

  function onInput(e) {
    var field = e.target.getAttribute('data-field');
    if (!field || field === 'default_pickup' || field === 'default_dropoff') return;
    var val = e.target.value;
    if (field === 'detail') val = val.slice(0, 250);
    if (field === 'contact_phone') val = val.replace(/[^\d+\s]/g, '');
    state[field] = val;
    if (field === 'detail' && e.target.value !== val) e.target.value = val;
    syncSave();
  }

  function syncToggles() {
    if (!rootEl) return;
    var pick = rootEl.querySelector('[data-field="default_pickup"]');
    var drop = rootEl.querySelector('[data-field="default_dropoff"]');
    if (pick) pick.checked = state.default_for === 'pickup';
    if (drop) drop.checked = state.default_for === 'dropoff';
  }

  function onChange(e) {
    if (syncingToggle) return;
    var field = e.target.getAttribute('data-field');
    if (field === 'default_pickup') {
      state.default_for = e.target.checked ? 'pickup' : (state.default_for === 'pickup' ? '' : state.default_for);
    } else if (field === 'default_dropoff') {
      state.default_for = e.target.checked ? 'dropoff' : (state.default_for === 'dropoff' ? '' : state.default_for);
    } else {
      return;
    }
    if (e.target.focus) {
      try { e.target.focus({ preventScroll: true }); } catch (_) {}
    }
    syncingToggle = true;
    syncToggles();
    syncingToggle = false;
  }

  function onClick(e) {
    var typeBtn = e.target.closest('[data-type]');
    if (typeBtn) {
      state.type = typeBtn.getAttribute('data-type');
      rootEl.querySelectorAll('.addr-type').forEach(function (el) {
        el.classList.toggle('is-selected', el.getAttribute('data-type') === state.type);
      });
      return;
    }
    var action = e.target.closest('[data-action]');
    if (!action) return;
    var key = action.getAttribute('data-action');
    if (key === 'pick-map') {
      TTV.ui.placePicker.open({
        title: 'Chọn địa điểm',
        mapOnly: true,
        onPick: function (place) {
          state.detail = String(place.addr || '').slice(0, 250);
          state.lat = place.lat;
          state.lng = place.lng;
          var ta = rootEl.querySelector('[data-field="detail"]');
          if (ta) ta.value = state.detail;
          syncSave();
        }
      });
      return;
    }
    if (key === 'save') {
      if (!canSave() || state.saving) return;
      state.saving = true;
      action.disabled = true;
      TTV.api.saveAddress({
        id: state.id || undefined,
        created_at: state.created_at,
        label: state.label,
        type: state.type,
        detail: state.detail,
        lat: state.lat,
        lng: state.lng,
        contact_name: state.contact_name,
        contact_phone: state.contact_phone,
        default_for: state.default_for
      }).then(function () {
        TTV.Components.toast('Đã lưu địa chỉ.', 'success');
        TTV.Router.navigate('/address');
      }).catch(function (err) {
        state.saving = false;
        syncSave();
        TTV.Components.toast((err && err.message) || 'Không lưu được địa chỉ.', 'danger');
      });
    }
  }

  function blankState() {
    return {
      id: '',
      created_at: '',
      label: '',
      detail: '',
      lat: null,
      lng: null,
      contact_name: '',
      contact_phone: '',
      type: 'home',
      default_for: '',
      saving: false
    };
  }

  function fillFromUser() {
    if (!TTV.api.getCurrentUser) return;
    TTV.api.getCurrentUser().then(function (user) {
      if (!user || !state || state.id) return;
      if (!state.contact_name && user.name) state.contact_name = user.name;
      if (!state.contact_phone && user.phone) state.contact_phone = user.phone;
      var nameEl = rootEl && rootEl.querySelector('[data-field="contact_name"]');
      var phoneEl = rootEl && rootEl.querySelector('[data-field="contact_phone"]');
      if (nameEl && !nameEl.value) nameEl.value = state.contact_name;
      if (phoneEl && !phoneEl.value) phoneEl.value = state.contact_phone;
      syncSave();
    }).catch(function () {});
  }

  TTV.screens.addressForm = {
    render: function (container, ctx) {
      rootEl = container;
      state = blankState();
      var id = ctx && ctx.params && ctx.params.id;
      if (!id) {
        paint();
        fillFromUser();
        return;
      }
      rootEl.innerHTML = TTV.Components.header('Sửa địa chỉ', { back: true }) +
        '<main class="page">' + TTV.Components.loading('Đang tải…') + '</main>';
      TTV.api.getAddress(id).then(function (row) {
        if (!row) {
          TTV.Components.toast('Không tìm thấy địa chỉ.', 'danger');
          TTV.Router.navigate('/address');
          return;
        }
        state = {
          id: row.id,
          created_at: row.created_at || '',
          label: row.label || '',
          detail: row.detail || '',
          lat: row.lat,
          lng: row.lng,
          contact_name: row.contact_name || '',
          contact_phone: row.contact_phone || '',
          type: row.type || 'home',
          default_for: row.default_for || '',
          saving: false
        };
        paint();
      }).catch(function (err) {
        TTV.Components.toast((err && err.message) || 'Không tải được địa chỉ.', 'danger');
        TTV.Router.navigate('/address');
      });
    },
    destroy: function () {
      if (TTV.ui.placePicker) TTV.ui.placePicker.close();
      rootEl = null;
      state = null;
      syncingToggle = false;
    }
  };
})(window.TTV);
