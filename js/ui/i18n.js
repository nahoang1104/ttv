/* i18n.js — bản địa hóa và tiện ích dùng chung. Mặc định tiếng Việt; tiếng Anh để dành. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var dictionaries = {
    vi: {
      'common.loading': 'Đang tải…',
      'common.save': 'Lưu',
      'common.cancel': 'Hủy',
      'common.error': 'Đã xảy ra lỗi',
      'common.comingSoon': 'Sắp có',
      'home.greet.morning': 'Buổi sáng vui vẻ!',
      'home.greet.noon': 'Buổi trưa vui vẻ!',
      'home.greet.afternoon': 'Buổi chiều vui vẻ!',
      'home.greet.evening': 'Buổi tối vui vẻ!',
      'home.notifications': 'Thông báo',
      'home.pickup.label': 'Điểm bốc hàng…',
      'home.pickup.placeholder': 'Chọn điểm bốc hàng của bạn',
      'home.dropoff.label': 'Bốc vác đến?',
      'home.paste': 'Dán',
      'home.paste.denied': 'Không đọc được clipboard. Hãy dán thủ công trên form đặt đơn.',
      'home.services': 'Dịch vụ',
      'home.explore': 'Khám phá thêm',
      'home.banner.cta': 'Tham gia ngay',
      'home.banner.member': 'Ưu đãi Hội viên',
      'home.banner.memberSub': 'Tiết kiệm đến 20% mọi đơn bốc vác',
      'home.banner.promo': 'Ưu đãi khách mới',
      'home.explore.card1': 'Bốc vác công kênh chuyên nghiệp',
      'home.explore.card2': 'Khai giá hàng hóa là gì?',
      'home.explore.card3': 'Bốc xếp an toàn'
    },
    en: { 'common.loading': 'Loading…', 'common.save': 'Save', 'common.cancel': 'Cancel', 'common.error': 'An error occurred' }
  };
  var locale = 'vi';
  function t(key, params) {
    var value = (dictionaries[locale] && dictionaries[locale][key]) || (dictionaries.vi && dictionaries.vi[key]) || key;
    params = params || {};
    return String(value).replace(/\{([a-zA-Z0-9_]+)\}/g, function (all, name) { return params[name] == null ? all : String(params[name]); });
  }
  function setLocale(next) { if (!dictionaries[next]) throw new Error('Ngôn ngữ chưa được hỗ trợ: ' + next); locale = next; return locale; }
  function money(value, opts) {
    var n = Number(value); if (!Number.isFinite(n)) n = 0;
    return new Intl.NumberFormat((opts && opts.locale) || 'vi-VN', { maximumFractionDigits: 0 }).format(n) + ((opts && opts.currency) === false ? '' : ' ₫');
  }
  function date(value, opts) {
    var d = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(d.getTime())) return '';
    var options = Object.assign({ day: '2-digit', month: '2-digit', year: 'numeric' }, opts || {});
    return new Intl.DateTimeFormat((opts && opts.locale) || 'vi-VN', options).format(d);
  }
  function relativeTime(value, now) {
    var d = value instanceof Date ? value : new Date(value), ms = d.getTime();
    if (!Number.isFinite(ms)) return '';
    var delta = ms - (now == null ? Date.now() : Number(now)), abs = Math.abs(delta), unit, amount;
    if (abs < 45000) return 'vừa xong';
    if (abs < 3600000) { unit = 'minute'; amount = Math.round(delta / 60000); }
    else if (abs < 86400000) { unit = 'hour'; amount = Math.round(delta / 3600000); }
    else if (abs < 2592000000) { unit = 'day'; amount = Math.round(delta / 86400000); }
    else if (abs < 31536000000) { unit = 'month'; amount = Math.round(delta / 2592000000); }
    else { unit = 'year'; amount = Math.round(delta / 31536000000); }
    try { return new Intl.RelativeTimeFormat('vi', { numeric: 'auto' }).format(amount, unit); }
    catch (_) { return amount < 0 ? Math.abs(amount) + ' ' + ({ minute: 'phút', hour: 'giờ', day: 'ngày', month: 'tháng', year: 'năm' }[unit]) + ' trước' : amount + ' ' + unit + ' nữa'; }
  }
  function maskPhone(phone) {
    var raw = String(phone == null ? '' : phone), digits = raw.replace(/\D/g, '');
    if (digits.length < 7) return raw;
    var start = digits.length >= 10 && digits.slice(0, 2) === '84' ? 3 : 3;
    var end = 3, hidden = digits.length - start - end;
    if (hidden < 3) { start = Math.max(1, Math.floor((digits.length - 3) / 2)); hidden = digits.length - start - 3; }
    var masked = digits.slice(0, start) + '*'.repeat(Math.max(3, hidden)) + digits.slice(-end);
    if (raw.trim().charAt(0) === '+') return '+' + masked;
    return masked;
  }
  function id() {
    if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    var bytes = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes); else for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return Array.from(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  function orderCode(value) {
    var hex = String(value || '').replace(/[^0-9a-f]/gi, '').toUpperCase();
    if (hex.length < 8) hex = (hex + id().replace(/-/g, '').toUpperCase()).slice(0, 8);
    return '#' + hex.slice(0, 8);
  }
  function audit(action, details) {
    details = details || {};
    var session = null;
    try { session = JSON.parse(sessionStorage.getItem('ttv_session') || 'null'); } catch (_) {}
    var record = {
      id: id(), actor_id: details.actor_id || (session && (session.account_id || session.user_id)) || 'system',
      actor_role: details.actor_role || (session && (session.role || session.account_type)) || 'SYSTEM',
      action: String(action || 'unknown'), target_table: details.target_table || '', target_id: details.target_id == null ? '' : String(details.target_id),
      detail: details.detail == null ? '' : (typeof details.detail === 'string' ? details.detail : JSON.stringify(details.detail)),
      created_at: new Date().toISOString()
    };
    if (!TTV.Store || typeof TTV.Store.put !== 'function') return Promise.reject(new Error('Store chưa sẵn sàng để ghi audit log.'));
    return TTV.Store.put('audit_logs', record).then(function () { return record; });
  }
  TTV.I18n = { t: t, setLocale: setLocale, getLocale: function () { return locale; }, dictionaries: dictionaries };
  TTV.Utils = {
    money: money, formatMoney: money, date: date, formatDate: date, relativeTime: relativeTime,
    maskPhone: maskPhone, id: id, generateId: id, orderCode: orderCode, generateOrderCode: orderCode, audit: audit
  };
  TTV.audit = audit;
})(window.TTV);
