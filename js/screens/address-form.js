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

  function canSave() {
    if (!state) return false;
    var phone = String(state.contact_phone || '').replace(/\D/g, '');
    return !!(state.label.trim() && state.detail.trim() && state.contact_name.trim() && phone.length >= 9 && state.detail.length <= 250);
  }

  function markup() {
    var n = (state.detail || '').length;
    return TTV.Components.header('Thêm địa chỉ', { back: true }) +
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
            typeIcon(tp.icon) + '<small>' + esc(tp.name) + '</small></button>';
        }).join('') + '</div>' +
        '<div class="addr-default">' +
          '<div><strong>Đặt làm địa chỉ mặc định</strong>' +
            '<small>Địa chỉ mặc định sẽ được ưu tiên khi tạo đơn hàng</small></div>' +
          '<label class="toggle"><input type="checkbox" data-field="is_default"' + (state.is_default ? ' checked' : '') + '><span class="toggle__track"></span></label>' +
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
    if (!field || field === 'is_default') return;
    var val = e.target.value;
    if (field === 'detail') val = val.slice(0, 250);
    if (field === 'contact_phone') val = val.replace(/[^\d+\s]/g, '');
    state[field] = val;
    if (field === 'detail' && e.target.value !== val) e.target.value = val;
    syncSave();
  }

  function onChange(e) {
    if (e.target.getAttribute('data-field') !== 'is_default') return;
    state.is_default = e.target.checked;
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
        label: state.label,
        type: state.type,
        detail: state.detail,
        lat: state.lat,
        lng: state.lng,
        contact_name: state.contact_name,
        contact_phone: state.contact_phone,
        is_default: state.is_default
      }).then(function () {
        TTV.Components.toast('Đã lưu địa chỉ.', 'success');
        if (history.length > 1) history.back();
        else TTV.Router.navigate('/home');
      }).catch(function (err) {
        state.saving = false;
        syncSave();
        TTV.Components.toast((err && err.message) || 'Không lưu được địa chỉ.', 'danger');
      });
    }
  }

  TTV.screens.addressForm = {
    render: function (container) {
      rootEl = container;
      state = {
        label: '',
        detail: '',
        lat: null,
        lng: null,
        contact_name: '',
        contact_phone: '',
        type: 'home',
        is_default: false,
        saving: false
      };
      paint();
    },
    destroy: function () {
      if (TTV.ui.placePicker) TTV.ui.placePicker.close();
      rootEl = null;
      state = null;
    }
  };
})(window.TTV);
