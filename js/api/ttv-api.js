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
      return store().list('services');
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
    }
  };
})(window.TTV);
