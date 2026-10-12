/* ttv-api.js — nghiệp vụ. Màn hình chỉ gọi qua TTV.api, không gọi store trực tiếp. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  function store() {
    if (!TTV.Store) return Promise.reject(new Error('Store chưa sẵn sàng.'));
    return TTV.Store;
  }
  TTV.api = {
    listServices: function () {
      var order = ['moving', 'warehouse', 'furniture', 'office', 'construction', 'hourly', 'goods'];
      return store().list('services').then(function (rows) {
        return (rows || []).slice().sort(function (a, b) {
          var ia = order.indexOf(a.code || a.id), ib = order.indexOf(b.code || b.id);
          return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
        });
      });
    },
    listBanners: function () {
      return store().list('banners').then(function (rows) {
        return (rows || []).filter(function (row) { return row.active !== false; })
          .sort(function (a, b) { return (Number(a.sort) || 0) - (Number(b.sort) || 0); });
      });
    },
    getSetting: function (key) {
      return store().get('app_settings', key).then(function (row) {
        return row ? row.value : null;
      });
    },
    unreadNotificationCount: function () {
      return store().query('notifications', { is_read: false }).then(function (rows) {
        return (rows || []).length;
      });
    },
    listAddresses: function () {
      return store().list('addresses');
    },
    getAddress: function (id) {
      return store().get('addresses', id);
    },
    saveAddress: function (payload) {
      payload = payload || {};
      var row = {
        id: payload.id || TTV.Utils.id(),
        user_id: payload.user_id || 'local-demo',
        label: String(payload.label || '').trim().slice(0, 80),
        type: payload.type || 'home',
        detail: String(payload.detail || '').trim().slice(0, 250),
        lat: payload.lat == null ? null : Number(payload.lat),
        lng: payload.lng == null ? null : Number(payload.lng),
        contact_name: String(payload.contact_name || '').trim(),
        contact_phone: String(payload.contact_phone || '').trim(),
        is_default: !!payload.is_default
      };
      if (!row.label || !row.detail) return Promise.reject(new Error('Nhập tên gợi nhớ và địa chỉ chi tiết.'));
      return store().list('addresses').then(function (rows) {
        var ops = [];
        if (row.is_default) {
          (rows || []).forEach(function (item) {
            if (item.id !== row.id && item.is_default) {
              item.is_default = false;
              ops.push(store().put('addresses', item));
            }
          });
        }
        ops.push(store().put('addresses', row));
        return Promise.all(ops).then(function () { return row; });
      });
    }
  };
})(window.TTV);
