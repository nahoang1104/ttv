/* screens/admin/promotions.js — Khuyến mãi #/admin/promotions (task 8.5).
   Chỉ SUPER_ADMIN. Tab Mã giảm giá / Banner. Tạo, sửa, tắt, xóa mã; cấp mã cho khách; CRUD banner (ảnh + đích).
   Ghi qua TTV.api (kiểm quyền, đọc lại trước khi ghi, audit_logs nhóm promo). */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components, esc = C.escape;
  TTV.screens = TTV.screens || {};
  function t(key, params) { return TTV.I18n.t(key, params); }

  var LIST = '/admin/promotions', PAGE_SIZE = 8, MAX_IMG = 10 * 1024 * 1024;
  var token = 0, host = null, hub = null, modalBusy = false;
  var form = null, detail = null, bannerForm = null, bannerDetail = null, grantPick = null;

  function msg(e) { return (e && e.message) || t('adminPromo.err.generic'); }
  function money(n) { return TTV.Utils.money(n || 0); }
  function when(iso) { return TTV.Utils.date(iso) || '—'; }
  function fold(v) { return String(v == null ? '' : v).toLocaleLowerCase('vi'); }
  function goTo(path) { TTV.Router.navigate(path); }
  function chip(attr, value, label, on) {
    return '<button type="button" class="chip' + (on ? ' is-selected' : '') + '" ' + attr + '="' + esc(value) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(label) + '</button>';
  }
  function emptyBlock(icon, title, desc) {
    return '<section class="admin-empty"><span>' + icon + '</span><strong>' + esc(title) + '</strong><p>' + esc(desc) + '</p></section>';
  }
  function lifeBadge(life) {
    var map = { active: 'success', disabled: 'neutral', expired: 'warning' };
    return C.badge(t('adminPromo.life.' + life), map[life] || 'neutral');
  }
  function fmtInputMoney(n) { return n ? Number(n).toLocaleString('vi-VN') : ''; }
  function dateInput(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (!Number.isFinite(d.getTime())) {
      var s = String(iso);
      return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
    }
    var m = String(d.getMonth() + 1), day = String(d.getDate());
    if (m.length < 2) m = '0' + m;
    if (day.length < 2) day = '0' + day;
    return d.getFullYear() + '-' + m + '-' + day;
  }
  function timeInput(iso) {
    if (!iso) return '23:59';
    var d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '23:59';
    var h = String(d.getHours()), m = String(d.getMinutes());
    if (h.length < 2) h = '0' + h;
    if (m.length < 2) m = '0' + m;
    return h + ':' + m;
  }
  function whenFull(iso) {
    return TTV.Utils.date(iso, { hour: '2-digit', minute: '2-digit', hour12: false }) || '—';
  }
  function fieldWrap(key, label, inner, hint) {
    return '<div class="field" data-field="' + key + '"><span class="field__label">' + esc(label) + '</span>' + inner +
      (hint ? '<p class="field-hint">' + esc(hint) + '</p>' : '') +
      '<p class="field-error" data-error hidden></p></div>';
  }
  function setError(root, key, text) {
    var f = root && root.querySelector('[data-field="' + key + '"]'); if (!f) return;
    var p = f.querySelector('[data-error]'); if (p) { p.textContent = text || ''; p.hidden = !text; }
    f.classList.toggle('is-invalid', !!text);
  }
  function showErrors(root, errors) {
    root.querySelectorAll('[data-field]').forEach(function (f) { setError(root, f.getAttribute('data-field'), (errors || {})[f.getAttribute('data-field')] || ''); });
  }
  function closeModals() {
    document.querySelectorAll('[data-ap-backdrop]').forEach(function (el) { el.remove(); });
    modalBusy = false;
  }
  function openModal(title, body, footer) {
    closeModals();
    document.body.insertAdjacentHTML('beforeend', '<div class="modal-backdrop" data-ap-backdrop><section class="modal" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
      '<header class="modal__header"><h2>' + esc(title) + '</h2><button type="button" class="icon-btn" data-ap="close" aria-label="' + esc(t('adminPromo.btn.close')) + '">×</button></header>' +
      '<div class="modal__body">' + body + '</div><footer class="modal__footer"><div class="admin-modal-actions">' + footer + '</div></footer></section></div>');
  }
  function btn(cls, action, label) { return '<button type="button" class="btn ' + cls + '" data-ap="' + action + '">' + esc(label) + '</button>'; }
  function setBusy(on) {
    modalBusy = on;
    document.querySelectorAll('[data-ap-backdrop] [data-ap^="confirm"]').forEach(function (b) {
      b.disabled = on;
      if (on) { b.setAttribute('data-label', b.textContent); b.textContent = t('adminPromo.btn.working'); }
      else if (b.getAttribute('data-label')) b.textContent = b.getAttribute('data-label');
    });
  }

  /* ===================== Hub (danh sách) ===================== */
  function matchesCoupon(c) {
    if (hub.filter !== 'all' && c.life !== hub.filter) return false;
    var q = fold(hub.q).trim();
    return !q || fold([c.code, c.title, c.condition].join(' ')).indexOf(q) >= 0;
  }
  function couponCard(c) {
    var off = c.discount_type === 'fixed' ? money(c.discount_value) : (String(c.discount_value).replace('.', ',') + '%');
    var thumb = c.image_path
      ? '<img src="' + esc(c.image_path) + '" alt="" loading="lazy">'
      : '％';
    return '<article class="admin-record admin-record--link ap-coupon-card" role="link" tabindex="0" data-ap-open-c="' + esc(c.code) + '">' +
      '<span class="admin-record__avatar ap-thumb">' + thumb + '</span><div class="admin-record__main"><strong>' + esc(c.code) + '</strong>' +
      '<p>' + esc(c.title) + '</p><div class="admin-record__badges">' + lifeBadge(c.life) +
      C.badge(off, 'info') + C.badge(t('adminPromo.grants', { n: c.grants }), 'neutral') + '</div></div>' +
      '<span class="admin-record__chev" aria-hidden="true">›</span></article>';
  }
  function catalogFrom(svcs) {
    return (svcs || []).map(function (s) {
      return { code: String(s.code || s.id || ''), name: String(s.name || s.code || '') };
    }).filter(function (s) { return s.code; });
  }
  function couponAllOn() {
    var cat = (form && form.catalog) || [];
    return cat.length > 0 && (form.data.services || []).length === cat.length;
  }
  function couponServicesLabel(c, catalog) {
    catalog = catalog || (detail && detail.catalog) || (form && form.catalog) || [];
    var list = Array.isArray(c.services) ? c.services.map(String) : [];
    if (!list.length) return t('adminPromo.services.all');
    var names = catalog.filter(function (s) { return list.indexOf(s.code) >= 0; }).map(function (s) { return s.name; });
    return names.length ? names.join(', ') : list.join(', ');
  }
  function couponPreview() {
    var src = form && (form.preview || (form.data && form.data.image_path));
    var ico = '<span class="ap-drop__ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26"><rect x="3.5" y="6" width="17" height="13" rx="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="9" cy="11.2" r="1.5" fill="currentColor"/><path d="M7.5 17.2l3.4-3.6 2.3 2.4 3.1-3.5 3.2 4.7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg></span>';
    if (src) {
      return '<div class="ap-drop is-filled"><img class="ap-preview ap-preview--coupon" src="' + esc(src) + '" alt="">' +
        '<div class="ap-drop__bar"><label class="btn btn-secondary">' + esc(t('adminPromo.image.change')) +
        '<input type="file" id="ap-cimg" accept="image/*" hidden></label>' +
        '<button type="button" class="btn btn-ghost" data-ap="clear-cimg">' + esc(t('adminPromo.image.remove')) + '</button></div></div>';
    }
    return '<label class="ap-drop">' + ico + '<strong>' + esc(t('adminPromo.image.drop')) + '</strong>' +
      '<span>' + esc(t('adminPromo.hint.image')) + '</span>' +
      '<input type="file" id="ap-cimg" accept="image/*" hidden></label>';
  }
  function couponSvcCount() {
    return t('adminPromo.services.picked', { n: ((form && form.data && form.data.services) || []).length, m: ((form && form.catalog) || []).length });
  }
  function selectedFromCoupon(c, catalog) {
    var list = Array.isArray(c && c.services) ? c.services.map(String) : [];
    var codes = catalog.map(function (s) { return s.code; });
    if (!list.length) return codes.slice();
    return codes.filter(function (k) { return list.indexOf(k) >= 0; });
  }
  function bannerCard(b) {
    var img = b.image_path ? '<img src="' + esc(b.image_path) + '" alt="" loading="lazy">' : '▣';
    return '<article class="admin-record admin-record--link ap-banner-card" role="link" tabindex="0" data-ap-open-b="' + esc(b.id) + '">' +
      '<span class="admin-record__avatar ap-thumb">' + img + '</span><div class="admin-record__main"><strong>' + esc(b.title) + '</strong>' +
      '<p>' + esc(b.subtitle || t('adminPromo.banner.noSub')) + '</p><div class="admin-record__badges">' +
      C.badge(t('adminPromo.banner.type.' + b.type), 'info') +
      C.badge(t('adminPromo.banner.target.' + b.target), 'neutral') +
      C.badge(b.active ? t('adminPromo.banner.on') : t('adminPromo.banner.off'), b.active ? 'success' : 'neutral') +
      '</div></div><span class="admin-record__chev" aria-hidden="true">›</span></article>';
  }
  function hubShell() {
    var tabs = '<div class="admin-chip-row" role="tablist">' +
      chip('data-ap-tab', 'coupons', t('adminPromo.tab.coupons'), hub.tab === 'coupons') +
      chip('data-ap-tab', 'banners', t('adminPromo.tab.banners'), hub.tab === 'banners') + '</div>';
    var create = hub.tab === 'coupons'
      ? '<button type="button" class="btn btn-primary btn-block admin-create-btn" data-ap-go="coupons/new">' + esc(t('adminPromo.btn.newCoupon')) + '</button>'
      : '<button type="button" class="btn btn-primary btn-block admin-create-btn" data-ap-go="banners/new">' + esc(t('adminPromo.btn.newBanner')) + '</button>';
    var filter = hub.tab === 'coupons' ? '<div class="admin-chip-row" id="ap-filter">' +
      ['all', 'active', 'disabled', 'expired'].map(function (k) {
        var n = k === 'all' ? hub.coupons.length : hub.coupons.filter(function (c) { return c.life === k; }).length;
        return chip('data-ap-filter', k, t('adminPromo.filter.' + k) + ' (' + n + ')', hub.filter === k);
      }).join('') + '</div>' : '';
    var search = hub.tab === 'coupons'
      ? '<div class="admin-list-toolbar"><label class="admin-search"><span>⌕</span><input id="ap-search" type="search" placeholder="' + esc(t('adminPromo.search')) + '" value="' + esc(hub.q) + '" autocomplete="off"></label></div>'
      : '';
    return create + tabs + search + filter + '<div class="admin-list-meta"><span id="ap-count"></span></div><div id="ap-results" class="admin-record-list"></div>' +
      '<div class="admin-pagination" id="ap-pager"><button type="button" data-ap-page="-1" id="ap-prev">' + esc(t('adminPromo.prev')) + '</button><span id="ap-page-label"></span><button type="button" data-ap-page="1" id="ap-next">' + esc(t('adminPromo.next')) + '</button></div>';
  }
  function paintHub() {
    if (!hub || !host) return;
    var rows, emptyTitle, emptyDesc;
    if (hub.tab === 'coupons') {
      rows = hub.coupons.filter(matchesCoupon);
      emptyTitle = hub.coupons.length ? t('adminPromo.noResult.title') : t('adminPromo.empty.coupon');
      emptyDesc = hub.coupons.length ? t('adminPromo.noResult.desc') : t('adminPromo.empty.couponDesc');
    } else {
      rows = hub.banners;
      emptyTitle = t('adminPromo.empty.banner');
      emptyDesc = t('adminPromo.empty.bannerDesc');
    }
    var pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    hub.page = Math.max(0, Math.min(hub.page, pages - 1));
    var slice = rows.slice(hub.page * PAGE_SIZE, (hub.page + 1) * PAGE_SIZE);
    host.querySelector('#ap-results').innerHTML = rows.length
      ? slice.map(hub.tab === 'coupons' ? couponCard : bannerCard).join('')
      : emptyBlock(hub.tab === 'coupons' ? '％' : '▣', emptyTitle, emptyDesc);
    host.querySelector('#ap-count').textContent = t('adminPromo.count', { n: rows.length });
    host.querySelector('#ap-page-label').textContent = t('adminPromo.page', { p: hub.page + 1, n: pages });
    host.querySelector('#ap-prev').disabled = hub.page <= 0;
    host.querySelector('#ap-next').disabled = hub.page >= pages - 1;
    host.querySelector('#ap-pager').style.display = rows.length <= PAGE_SIZE ? 'none' : '';
  }
  function loadHub(my) {
    host.innerHTML = C.loading();
    Promise.all([TTV.api.listAdminCoupons(), TTV.api.listAdminBanners()]).then(function (r) {
      if (my !== token) return;
      var keepTab = hub && hub.tab, keepFilter = hub && hub.filter, keepQ = hub && hub.q;
      hub = { coupons: r[0], banners: r[1], tab: keepTab || 'coupons', filter: keepFilter || 'all', q: keepQ || '', page: 0 };
      host.innerHTML = hubShell(); paintHub();
    }).catch(function (e) {
      if (my !== token) return;
      host.innerHTML = C.emptyState(t('common.error'), msg(e), { icon: '!', label: t('adminPromo.retry'), action: 'ap-retry' });
    });
  }
  function renderHub(ctx) {
    var s = TTV.auth.getSession(), my = ++token;
    form = detail = bannerForm = bannerDetail = null; closeModals();
    TTV.screens.admin.shell(ctx.path, t('adminPromo.title'), '', s && s.role);
    host = document.querySelector('.admin-content');
    loadHub(my);
  }

  /* ===================== Chi tiết mã ===================== */
  function couponKv(c) {
    var off = c.discount_type === 'fixed' ? money(c.discount_value) : (String(c.discount_value).replace('.', ',') + '%');
    return '<dl class="admin-kv">' +
      '<div class="admin-kv__row"><dt>' + esc(t('adminPromo.f.code')) + '</dt><dd>' + esc(c.code) + '</dd></div>' +
      '<div class="admin-kv__row"><dt>' + esc(t('adminPromo.f.title')) + '</dt><dd>' + esc(c.title) + '</dd></div>' +
      '<div class="admin-kv__row"><dt>' + esc(t('adminPromo.f.condition')) + '</dt><dd>' + esc(c.condition || '—') + '</dd></div>' +
      '<div class="admin-kv__row"><dt>' + esc(t('adminPromo.f.discount')) + '</dt><dd>' + esc(off) + (c.max_discount ? ' · ' + esc(t('adminPromo.f.cap', { n: money(c.max_discount) })) : '') + '</dd></div>' +
      '<div class="admin-kv__row"><dt>' + esc(t('adminPromo.f.minOrder')) + '</dt><dd>' + esc(c.min_order ? money(c.min_order) : t('adminPromo.f.noMin')) + '</dd></div>' +
      '<div class="admin-kv__row"><dt>' + esc(t('adminPromo.f.minWorkers')) + '</dt><dd>' + esc(t('adminPromo.workers', { n: c.min_workers })) + '</dd></div>' +
      '<div class="admin-kv__row"><dt>' + esc(t('adminPromo.f.services')) + '</dt><dd>' + esc(couponServicesLabel(c)) + '</dd></div>' +
      '<div class="admin-kv__row"><dt>' + esc(t('adminPromo.f.expires')) + '</dt><dd>' + esc(whenFull(c.expires_at)) + '</dd></div></dl>';
  }
  function paintCouponDetail() {
    var d = detail.data, c = d.coupon;
    var grants = d.grants.length ? '<div class="admin-record-list">' + d.grants.map(function (g) {
      var sub = [g.customer_phone, when(g.created_at)].filter(Boolean).join(' · ');
      return '<article class="admin-record"><div class="admin-record__main"><strong>' + esc(g.customer_name || t('adminPromo.noName')) + '</strong>' +
        '<p class="admin-muted">' + esc(sub) + '</p></div>' +
        C.badge(t('adminPromo.grant.' + (g.status === 'used' ? 'used' : 'held')), g.status === 'used' ? 'neutral' : 'success') + '</article>';
    }).join('') + '</div>' : emptyBlock('♙', t('adminPromo.grantsEmpty'), t('adminPromo.grantsEmptyDesc'));
    var actions = '<div class="admin-actions">' +
      '<button type="button" class="btn btn-primary btn-block" data-ap-go="coupons/' + encodeURIComponent(c.code) + '/edit">' + esc(t('adminPromo.btn.edit')) + '</button>' +
      (c.life === 'active' ? '<button type="button" class="btn btn-secondary btn-block" data-ap="grant">' + esc(t('adminPromo.btn.grant')) + '</button>' : '') +
      (c.life !== 'expired' ? '<button type="button" class="btn btn-secondary btn-block" data-ap="' + (c.life === 'disabled' ? 'enable' : 'disable') + '">' + esc(t(c.life === 'disabled' ? 'adminPromo.btn.enable' : 'adminPromo.btn.disable')) + '</button>' : '') +
      '<button type="button" class="btn btn-danger btn-block" data-ap="delete-c"' + (c.used ? ' disabled' : '') + '>' + esc(t('adminPromo.btn.delete')) + '</button>' +
      (c.used ? '<p class="admin-muted">' + esc(t('adminPromo.deleteBlocked')) + '</p>' : '') +
      '</div>';
    host.innerHTML = '<div class="admin-detail"><section class="admin-detail-head">' +
      (c.image_path ? '<img class="ap-hero" src="' + esc(c.image_path) + '" alt="">' : '<span class="admin-detail-avatar">％</span>') +
      '<h2>' + esc(c.code) + '</h2>' +
      '<span class="admin-muted">' + esc(c.title) + '</span><div class="admin-detail-badges">' + lifeBadge(c.life) + '</div></section>' +
      C.card(couponKv(c), { title: t('adminPromo.section.info') }) +
      C.card(grants, { title: t('adminPromo.section.grants') }) + C.card(actions) + '</div>';
  }
  function loadCouponDetail(my, code) {
    host.innerHTML = C.loading();
    Promise.all([TTV.api.getAdminCoupon(code), TTV.api.listServices()]).then(function (r) {
      if (my !== token) return;
      var d = r[0];
      if (!d) { host.innerHTML = C.emptyState(t('adminPromo.notFound'), t('adminPromo.notFoundDesc'), { icon: '?', label: t('adminPromo.back'), action: 'ap-back' }); return; }
      detail = { data: d, catalog: catalogFrom(r[1]) }; paintCouponDetail();
    }).catch(function (e) {
      if (my !== token) return;
      host.innerHTML = C.emptyState(t('common.error'), msg(e), { icon: '!', label: t('adminPromo.retry'), action: 'ap-retry-c' });
    });
  }
  function renderCouponDetail(ctx) {
    var s = TTV.auth.getSession(), my = ++token;
    form = hub = bannerForm = bannerDetail = null; closeModals();
    TTV.screens.admin.shell(ctx.path, t('adminPromo.detail.title'), '', s && s.role, { back: LIST, hideNav: true });
    host = document.querySelector('.admin-content');
    loadCouponDetail(my, ctx.params.code);
  }

  /* ===================== Form mã ===================== */
  function couponFormHtml() {
    var d = form.data, edit = form.editing;
    var dtype = d.discount_type === 'fixed' ? 'fixed' : 'percent';
    var selected = d.services || [];
    var svcChips = (form.catalog || []).map(function (s) {
      return chip('data-ap-svc', s.code, s.name, selected.indexOf(s.code) >= 0);
    }).join('');
    var info = fieldWrap('code', t('adminPromo.f.code'),
        '<div class="ap-code-row"><input id="ap-code" type="text" maxlength="20" autocomplete="off" ' + (edit ? 'disabled' : '') + ' value="' + esc(d.code) + '">' +
        (edit ? '' : '<button type="button" class="btn btn-secondary" data-ap="rand">' + esc(t('adminPromo.btn.rand')) + '</button>') + '</div>',
        edit ? t('adminPromo.hint.codeLocked') : t('adminPromo.hint.code')) +
      fieldWrap('title', t('adminPromo.f.title'), '<input id="ap-title" type="text" maxlength="80" value="' + esc(d.title) + '">') +
      fieldWrap('condition', t('adminPromo.f.condition'), '<input id="ap-condition" type="text" maxlength="200" placeholder="' + esc(t('adminPromo.ph.condition')) + '" value="' + esc(d.condition) + '">', t('adminPromo.hint.condition'));
    var media = '<div class="field" data-field="image_path"><span class="field__label">' + esc(t('adminPromo.f.image')) + '</span>' +
      '<div data-ap-cpreview>' + couponPreview() + '</div><p class="field-error" data-error hidden></p></div>' +
      '<div class="field" data-field="services"><span class="field__label">' + esc(t('adminPromo.f.services')) +
      '<span class="ap-svc-meta"><span data-ap-svc-count>' + esc(couponSvcCount()) + '</span>' +
      '<button type="button" class="link-btn" data-ap="svc-all">' + esc(t(couponAllOn() ? 'adminPromo.btn.clearAll' : 'adminPromo.btn.selectAll')) + '</button></span></span>' +
      '<div class="admin-chip-row ap-svc-chips" data-ap-svc-row>' + svcChips + '</div>' +
      '<p class="field-hint">' + esc(t('adminPromo.hint.services')) + '</p><p class="field-error" data-error hidden></p></div>';
    var deal = '<div class="field" data-field="discount_type"><span class="field__label">' + esc(t('adminPromo.f.type')) + '</span>' +
        '<div class="admin-chip-row">' + chip('data-ap-dtype', 'percent', t('adminPromo.type.percent'), dtype === 'percent') + chip('data-ap-dtype', 'fixed', t('adminPromo.type.fixed'), dtype === 'fixed') + '</div></div>' +
      fieldWrap('discount_value', dtype === 'percent' ? t('adminPromo.f.percent') : t('adminPromo.f.amount'),
        '<input id="ap-value" type="text" inputmode="decimal" value="' + esc(dtype === 'percent' ? String(d.discount_value || '') : fmtInputMoney(d.discount_value)) + '">') +
      (dtype === 'percent' ? fieldWrap('max_discount', t('adminPromo.f.maxDiscount'), '<input id="ap-cap" type="text" inputmode="numeric" value="' + esc(fmtInputMoney(d.max_discount)) + '">', t('adminPromo.hint.cap')) : '') +
      fieldWrap('min_order', t('adminPromo.f.minOrder'), '<input id="ap-min" type="text" inputmode="numeric" value="' + esc(fmtInputMoney(d.min_order)) + '">') +
      fieldWrap('min_workers', t('adminPromo.f.minWorkers'), '<input id="ap-workers" type="number" min="1" max="10" value="' + esc(String(d.min_workers || 2)) + '">', t('adminPromo.hint.workers')) +
      fieldWrap('expires_at', t('adminPromo.f.expires'),
        '<div class="ap-exp-row"><input id="ap-exp" type="date" value="' + esc(dateInput(d.expires_at)) + '" aria-label="' + esc(t('adminPromo.f.expiresDate')) + '">' +
        '<input id="ap-exp-time" type="time" value="' + esc(timeInput(d.expires_at)) + '" aria-label="' + esc(t('adminPromo.f.expiresTime')) + '"></div>',
        t('adminPromo.hint.expires'));
    return '<form class="admin-form ap-form" id="ap-c-form" novalidate>' +
      C.card(info, { title: t('adminPromo.section.info') }) +
      C.card(media, { title: t('adminPromo.section.media') }) +
      C.card(deal, { title: t('adminPromo.section.deal') }) +
      '<div class="admin-form-actions"><button type="submit" class="btn btn-primary btn-block" id="ap-c-save">' + esc(t(edit ? 'adminPromo.btn.save' : 'adminPromo.btn.create')) + '</button></div></form>';
  }
  function readCouponForm() {
    return {
      editing: form.editing, id: form.editing ? form.data.code : '',
      code: (document.getElementById('ap-code') || {}).value,
      title: (document.getElementById('ap-title') || {}).value,
      condition: (document.getElementById('ap-condition') || {}).value,
      discount_type: form.data.discount_type,
      discount_value: (document.getElementById('ap-value') || {}).value,
      max_discount: (document.getElementById('ap-cap') || {}).value,
      min_order: (document.getElementById('ap-min') || {}).value,
      min_workers: (document.getElementById('ap-workers') || {}).value,
      expires_at: (document.getElementById('ap-exp') || {}).value,
      expires_time: (document.getElementById('ap-exp-time') || {}).value,
      image_path: form.data.image_path || '',
      services: (form.data.services || []).slice()
    };
  }
  function paintCouponServiceChips() {
    if (!form || !host) return;
    var selected = form.data.services || [];
    host.querySelectorAll('[data-ap-svc]').forEach(function (b) {
      var on = selected.indexOf(b.getAttribute('data-ap-svc')) >= 0;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var btn = host.querySelector('[data-ap="svc-all"]');
    if (btn) btn.textContent = t(couponAllOn() ? 'adminPromo.btn.clearAll' : 'adminPromo.btn.selectAll');
    var count = host.querySelector('[data-ap-svc-count]');
    if (count) count.textContent = couponSvcCount();
  }
  function paintCouponForm() { host.innerHTML = couponFormHtml(); }
  function renderCouponForm(ctx) {
    var s = TTV.auth.getSession(), my = ++token, code = ctx.params && ctx.params.code;
    hub = detail = bannerForm = bannerDetail = null; closeModals();
    TTV.screens.admin.shell(ctx.path, t(code ? 'adminPromo.edit.title' : 'adminPromo.new.title'), '', s && s.role, { back: code ? LIST + '/coupons/' + encodeURIComponent(code) : LIST, hideNav: true });
    host = document.querySelector('.admin-content');
    host.innerHTML = C.loading();
    var jobs = [TTV.api.listServices()];
    if (code) jobs.push(TTV.api.getAdminCoupon(code));
    Promise.all(jobs).then(function (r) {
      if (my !== token) return;
      var catalog = catalogFrom(r[0]);
      if (!code) {
        form = {
          editing: false, file: null, preview: '', catalog: catalog,
          data: {
            code: TTV.api.generateCouponCode(), title: '', condition: '', discount_type: 'percent',
            discount_value: 10, max_discount: 0, min_order: 100000, min_workers: 2, expires_at: '',
            image_path: '', services: catalog.map(function (s) { return s.code; })
          }
        };
        paintCouponForm(); return;
      }
      var d = r[1];
      if (!d) { host.innerHTML = C.emptyState(t('adminPromo.notFound'), t('adminPromo.notFoundDesc'), { icon: '?', label: t('adminPromo.back'), action: 'ap-back' }); return; }
      form = {
        editing: true, file: null, preview: '', catalog: catalog,
        data: Object.assign({}, d.coupon, { services: selectedFromCoupon(d.coupon, catalog) })
      };
      paintCouponForm();
    }).catch(function (e) {
      if (my !== token) return;
      host.innerHTML = C.emptyState(t('common.error'), msg(e), { icon: '!', label: t('adminPromo.retry'), action: 'ap-back' });
    });
  }
  function submitCoupon(e) {
    if (e) e.preventDefault();
    if (!form || form.busy) return;
    var payload = readCouponForm();
    showErrors(host, {});
    var serviceCodes = (form.catalog || []).map(function (s) { return s.code; });
    var parsed = TTV.api.validateCouponInput(payload, { editing: form.editing, serviceCodes: serviceCodes });
    var errors = Object.assign({}, parsed.errors);
    if (form.file) delete errors.image_path;
    if (Object.keys(errors).length) { showErrors(host, errors); return; }
    form.busy = true;
    var saveBtn = document.getElementById('ap-c-save'); if (saveBtn) saveBtn.disabled = true;
    var session = TTV.auth.getSession();
    var up = form.file
      ? TTV.Upload.upload(form.file, { ownerId: (session && session.account_id) || 'admin', kind: 'coupon-images' }).then(function (r) { return r.path; })
      : Promise.resolve(payload.image_path);
    up.then(function (path) {
      payload.image_path = path || '';
      return TTV.api.saveAdminCoupon(payload);
    }).then(function (c) {
      C.toast(t(form.editing ? 'adminPromo.toast.saved' : 'adminPromo.toast.created'), 'success');
      goTo(LIST + '/coupons/' + encodeURIComponent(c.code));
    }).catch(function (err) {
      form.busy = false; if (saveBtn) saveBtn.disabled = false;
      if (err && err.code === 'NO_CHANGE') { C.toast(t('adminPromo.toast.noChange'), 'info'); return; }
      if (err && err.errors) showErrors(host, err.errors); else C.toast(msg(err), 'error');
    });
  }

  /* ===================== Cấp mã ===================== */
  function grantFreeCount() {
    return (grantPick.customers || []).filter(function (c) {
      return c.status !== 'locked' && !c.coupon_status;
    }).length;
  }
  function grantSelectedIds() {
    return Object.keys((grantPick && grantPick.ids) || {});
  }
  // SĐT VN: bỏ dấu cách/chấm, coi 0… và +84/84… là một số (so phần quốc gia).
  function phoneTail(v) {
    var d = String(v == null ? '' : v).replace(/\D/g, '');
    if (d.indexOf('84') === 0 && d.length >= 4) d = d.slice(2);
    if (d.charAt(0) === '0') d = d.slice(1);
    return d;
  }
  function grantMatches(c) {
    var q = fold((grantPick && grantPick.q) || '').trim();
    if (!q) return true;
    if (fold([c.name, c.phone, c.email].join(' ')).indexOf(q) >= 0) return true;
    var needle = phoneTail(q);
    return needle.length >= 2 && phoneTail(c.phone).indexOf(needle) >= 0;
  }
  function grantInitial(name) {
    var s = String(name || '').trim();
    return s ? s.charAt(0).toUpperCase() : '?';
  }
  function grantListHtml() {
    var rows = (grantPick.customers || []).filter(grantMatches);
    var extra = '';
    if (rows.length > 40) {
      extra = '<p class="admin-muted">' + esc(t('adminPromo.grant.more', { n: rows.length - 40 })) + '</p>';
      rows = rows.slice(0, 40);
    }
    if (!rows.length) {
      return '<div class="ap-grant-empty">' + esc(t((grantPick.customers || []).length ? 'adminPromo.grant.none' : 'adminPromo.grant.empty')) + '</div>';
    }
    return '<div class="ap-pick">' + rows.map(function (c) {
      var busy = c.status === 'locked' || !!c.coupon_status;
      var on = !busy && grantPick.ids[c.id];
      var tag = c.status === 'locked' ? t('adminPromo.grant.locked')
        : c.coupon_status === 'used' ? t('adminPromo.grant.used')
          : c.coupon_status === 'available' ? t('adminPromo.grant.held') : '';
      return '<button type="button" class="ap-grant-row' + (on ? ' is-selected' : '') + (busy ? ' is-disabled' : '') + '" data-ap-pick="' + esc(c.id) + '"' + (busy ? ' disabled' : '') + '>' +
        '<span class="ap-grant-ava">' + esc(grantInitial(c.name || c.phone)) + '</span>' +
        '<span class="ap-grant-meta"><strong>' + esc(c.name || t('adminPromo.noName')) + '</strong><p>' + esc(c.phone || '') + '</p></span>' +
        (tag ? C.badge(tag, c.coupon_status === 'used' ? 'neutral' : 'info') : '<span class="ap-grant-tick" aria-hidden="true"></span>') +
        '</button>';
    }).join('') + '</div>' + extra;
  }
  function paintGrantChrome() {
    if (!grantPick) return;
    var box = document.querySelector('[data-ap-backdrop] [data-ap-grant-list]');
    if (box) box.innerHTML = grantListHtml();
    var n = grantSelectedIds().length;
    var go = document.querySelector('[data-ap="confirm-grant"]');
    if (go) {
      go.textContent = t('adminPromo.grant.confirmN', { n: n });
      go.classList.toggle('is-off', !n);
    }
    var all = document.querySelector('[data-ap="confirm-grant-all"]');
    if (all) all.textContent = t(grantPick.readyAll ? 'adminPromo.grant.confirmAllNow' : 'adminPromo.grant.all', { n: grantFreeCount() });
    var warn = document.querySelector('[data-ap-grant-warn]');
    if (warn) warn.hidden = !grantPick.readyAll;
  }
  function fillGrant(rows) {
    if (!grantPick) return;
    grantPick.customers = rows || [];
    paintGrantChrome();
  }
  function loadGrantTargets() {
    var box = document.querySelector('[data-ap-backdrop] [data-ap-grant-list]');
    if (box) box.innerHTML = C.loading();
    var fn = TTV.api.listCouponGrantTargets;
    if (typeof fn !== 'function') { fillGrant((detail && detail.data && detail.data.targets) || []); return; }
    fn(detail.data.coupon.code).then(fillGrant).catch(function (e) {
      if (!grantPick) return;
      if (box) {
        box.innerHTML = '<div class="ap-grant-empty">' + esc(msg(e)) + '</div>' +
          '<button type="button" class="btn btn-secondary btn-block" data-ap="grant-retry">' + esc(t('adminPromo.retry')) + '</button>';
      }
      C.toast(msg(e), 'error');
    });
  }
  function askGrant() {
    if (!detail || !detail.data || detail.data.coupon.life !== 'active') {
      C.toast(t('adminPromo.grant.blocked'), 'error'); return;
    }
    closeModals();
    grantPick = { q: '', ids: {}, customers: [], readyAll: false };
    var code = detail.data.coupon.code;
    var cached = Array.isArray(detail.data.targets) ? detail.data.targets : null;
    document.body.insertAdjacentHTML('beforeend',
      '<div class="sheet-backdrop ap-grant" data-ap-backdrop><section class="bottom-sheet" role="dialog" aria-modal="true" aria-label="' + esc(t('adminPromo.grant.title')) + '">' +
      '<header class="bottom-sheet__header"><h2>' + esc(t('adminPromo.grant.title')) + '</h2>' +
      '<button type="button" class="icon-btn" data-ap="close" aria-label="' + esc(t('adminPromo.btn.close')) + '">×</button></header>' +
      '<div class="bottom-sheet__body">' +
      '<p class="ap-grant__lead">' + esc(t('adminPromo.grant.body', { code: code })) + '</p>' +
      '<label class="ap-grant__search"><span aria-hidden="true">⌕</span>' +
      '<input id="ap-grant-q" type="search" inputmode="tel" placeholder="' + esc(t('adminPromo.grant.search')) + '" autocomplete="off"></label>' +
      '<p class="field-error" data-ap-err="user_id" hidden></p>' +
      '<div data-ap-grant-list>' + (cached && cached.length ? '' : C.loading()) + '</div>' +
      '<p class="ap-grant-warn" data-ap-grant-warn hidden>' + esc(t('adminPromo.grant.allWarn')) + '</p>' +
      '</div><footer class="bottom-sheet__footer">' +
      '<button type="button" class="ap-grant-all" data-ap="confirm-grant-all">' + esc(t('adminPromo.grant.all', { n: cached ? grantFreeCount() : '…' })) + '</button>' +
      '<div class="admin-modal-actions">' +
      btn('btn-secondary', 'close', t('adminPromo.btn.cancel')) +
      btn('btn-primary', 'confirm-grant', t('adminPromo.grant.confirmN', { n: 0 })) +
      '</div></footer></section></div>');
    if (cached && cached.length) fillGrant(cached);
    else loadGrantTargets();
  }
  function doGrant(all) {
    if (modalBusy || !detail || !grantPick) return;
    var errEl = document.querySelector('[data-ap-err="user_id"]');
    var ids = grantSelectedIds();
    if (!all && !ids.length) { if (errEl) { errEl.textContent = t('adminPromo.grant.need'); errEl.hidden = false; } return; }
    if (all && !grantFreeCount()) { C.toast(t('adminPromo.toast.grantedNone'), 'info'); return; }
    setBusy(true);
    var my = token, code = detail.data.coupon.code;
    var req = all
      ? TTV.api.grantCouponToCustomers(code, { all: true })
      : TTV.api.grantCouponToCustomers(code, { user_ids: ids });
    req.then(function (r) {
      if (my !== token) return;
      grantPick = null;
      closeModals();
      C.toast(t(r.granted ? 'adminPromo.toast.grantedN' : 'adminPromo.toast.grantedNone', { n: r.granted }), r.granted ? 'success' : 'info');
      loadCouponDetail(my, code);
    }).catch(function (e) {
      if (my !== token) return;
      setBusy(false); C.toast(msg(e), 'error');
    });
  }

  /* ===================== Banner ===================== */
  function paintBannerDetail() {
    var b = bannerDetail;
    host.innerHTML = '<div class="admin-detail"><section class="admin-detail-head">' +
      (b.image_path ? '<img class="ap-hero" src="' + esc(b.image_path) + '" alt="">' : '') +
      '<h2>' + esc(b.title) + '</h2><span class="admin-muted">' + esc(b.subtitle || '') + '</span>' +
      '<div class="admin-detail-badges">' + C.badge(t('adminPromo.banner.type.' + b.type), 'info') +
      C.badge(b.active ? t('adminPromo.banner.on') : t('adminPromo.banner.off'), b.active ? 'success' : 'neutral') + '</div></section>' +
      '<dl class="admin-kv">' +
      '<div class="admin-kv__row"><dt>' + esc(t('adminPromo.banner.targetLabel')) + '</dt><dd>' + esc(t('adminPromo.banner.target.' + b.target)) + '</dd></div>' +
      '<div class="admin-kv__row"><dt>' + esc(t('adminPromo.f.sort')) + '</dt><dd>' + esc(String(b.sort)) + '</dd></div></dl>' +
      '<div class="admin-actions"><button type="button" class="btn btn-primary btn-block" data-ap-go="banners/' + encodeURIComponent(b.id) + '/edit">' + esc(t('adminPromo.btn.edit')) + '</button>' +
      '<button type="button" class="btn btn-secondary btn-block" data-ap="' + (b.active ? 'hide-b' : 'show-b') + '">' + esc(t(b.active ? 'adminPromo.btn.hide' : 'adminPromo.btn.show')) + '</button>' +
      '<button type="button" class="btn btn-danger btn-block" data-ap="delete-b">' + esc(t('adminPromo.btn.delete')) + '</button></div></div>';
  }
  function loadBannerDetail(my, id) {
    host.innerHTML = C.loading();
    TTV.api.getAdminBanner(id).then(function (b) {
      if (my !== token) return;
      if (!b) { host.innerHTML = C.emptyState(t('adminPromo.banner.notFound'), t('adminPromo.notFoundDesc'), { icon: '?', label: t('adminPromo.back'), action: 'ap-back' }); return; }
      bannerDetail = b; paintBannerDetail();
    }).catch(function (e) {
      if (my !== token) return;
      host.innerHTML = C.emptyState(t('common.error'), msg(e), { icon: '!', label: t('adminPromo.retry'), action: 'ap-back' });
    });
  }
  function renderBannerDetail(ctx) {
    var s = TTV.auth.getSession(), my = ++token;
    hub = form = detail = bannerForm = null; closeModals();
    TTV.screens.admin.shell(ctx.path, t('adminPromo.banner.detail'), '', s && s.role, { back: LIST, hideNav: true });
    host = document.querySelector('.admin-content');
    loadBannerDetail(my, ctx.params.id);
  }
  function bannerPreview() {
    var src = bannerForm.preview || bannerForm.data.image_path;
    return src ? '<img class="ap-preview" src="' + esc(src) + '" alt="">' : '<div class="ap-preview ap-preview--empty">' + esc(t('adminPromo.banner.noImg')) + '</div>';
  }
  function bannerFormHtml() {
    var d = bannerForm.data;
    return '<form class="admin-form ap-form" id="ap-b-form" novalidate>' +
      '<div class="field" data-field="image_path"><span class="field__label">' + esc(t('adminPromo.banner.image')) + '</span>' +
      '<div data-ap-preview>' + bannerPreview() + '</div>' +
      '<label class="btn btn-secondary btn-block ap-file-btn">' + esc(t('adminPromo.banner.pick')) + '<input type="file" id="ap-img" accept="image/*" hidden></label>' +
      '<p class="field-hint">' + esc(t('adminPromo.banner.imgHint')) + '</p><p class="field-error" data-error hidden></p></div>' +
      fieldWrap('title', t('adminPromo.f.title'), '<input id="ap-btitle" type="text" maxlength="80" value="' + esc(d.title) + '">') +
      fieldWrap('subtitle', t('adminPromo.banner.subtitle'), '<input id="ap-bsub" type="text" maxlength="120" value="' + esc(d.subtitle) + '">') +
      '<div class="field" data-field="type"><span class="field__label">' + esc(t('adminPromo.banner.typeLabel')) + '</span><div class="admin-chip-row">' +
      ['promo', 'member', 'explore'].map(function (k) { return chip('data-ap-btype', k, t('adminPromo.banner.type.' + k), d.type === k); }).join('') + '</div></div>' +
      '<div class="field" data-field="target"><span class="field__label">' + esc(t('adminPromo.banner.targetLabel')) + '</span><div class="admin-chip-row">' +
      ['coupon', 'none'].map(function (k) { return chip('data-ap-btarget', k, t('adminPromo.banner.target.' + k), d.target === k); }).join('') + '</div></div>' +
      fieldWrap('sort', t('adminPromo.f.sort'), '<input id="ap-bsort" type="number" min="1" max="99" value="' + esc(String(d.sort || 1)) + '">') +
      '<div class="field"><span class="field__label">' + esc(t('adminPromo.banner.active')) + '</span>' +
      '<button type="button" class="chip' + (d.active ? ' is-selected' : '') + '" data-ap="toggle-active" aria-pressed="' + (d.active ? 'true' : 'false') + '">' + esc(d.active ? t('adminPromo.banner.on') : t('adminPromo.banner.off')) + '</button></div>' +
      '<div class="admin-actions"><button type="submit" class="btn btn-primary btn-block" id="ap-b-save">' + esc(t(bannerForm.editing ? 'adminPromo.btn.save' : 'adminPromo.btn.create')) + '</button></div></form>';
  }
  function paintBannerForm() { host.innerHTML = bannerFormHtml(); }
  function renderBannerForm(ctx) {
    var s = TTV.auth.getSession(), my = ++token, id = ctx.params && ctx.params.id;
    hub = form = detail = bannerDetail = null; closeModals();
    TTV.screens.admin.shell(ctx.path, t(id ? 'adminPromo.banner.edit' : 'adminPromo.banner.new'), '', s && s.role, { back: id ? LIST + '/banners/' + encodeURIComponent(id) : LIST, hideNav: true });
    host = document.querySelector('.admin-content');
    if (!id) {
      bannerForm = { editing: false, file: null, preview: '', data: { title: '', subtitle: '', image_path: '', type: 'promo', target: 'coupon', sort: 1, active: true } };
      paintBannerForm(); return;
    }
    host.innerHTML = C.loading();
    TTV.api.getAdminBanner(id).then(function (b) {
      if (my !== token) return;
      if (!b) { host.innerHTML = C.emptyState(t('adminPromo.banner.notFound'), t('adminPromo.notFoundDesc'), { icon: '?', label: t('adminPromo.back'), action: 'ap-back' }); return; }
      bannerForm = { editing: true, file: null, preview: '', data: b }; paintBannerForm();
    }).catch(function (e) {
      if (my !== token) return;
      host.innerHTML = C.emptyState(t('common.error'), msg(e), { icon: '!', label: t('adminPromo.retry'), action: 'ap-back' });
    });
  }
  function submitBanner(e) {
    if (e) e.preventDefault();
    if (!bannerForm || bannerForm.busy) return;
    bannerForm.data.title = (document.getElementById('ap-btitle') || {}).value;
    bannerForm.data.subtitle = (document.getElementById('ap-bsub') || {}).value;
    bannerForm.data.sort = (document.getElementById('ap-bsort') || {}).value;
    showErrors(host, {});
    var session = TTV.auth.getSession();
    bannerForm.busy = true;
    var saveBtn = document.getElementById('ap-b-save'); if (saveBtn) saveBtn.disabled = true;
    var up = bannerForm.file
      ? TTV.Upload.upload(bannerForm.file, { ownerId: (session && session.account_id) || 'admin', kind: 'banners' }).then(function (r) { return r.path; })
      : Promise.resolve(bannerForm.data.image_path);
    up.then(function (path) {
      return TTV.api.saveAdminBanner({
        id: bannerForm.editing ? bannerForm.data.id : '',
        title: bannerForm.data.title, subtitle: bannerForm.data.subtitle, image_path: path,
        type: bannerForm.data.type, target: bannerForm.data.target, sort: bannerForm.data.sort, active: bannerForm.data.active
      });
    }).then(function (b) {
      C.toast(t(bannerForm.editing ? 'adminPromo.toast.saved' : 'adminPromo.toast.bannerCreated'), 'success');
      goTo(LIST + '/banners/' + encodeURIComponent(b.id));
    }).catch(function (err) {
      bannerForm.busy = false; if (saveBtn) saveBtn.disabled = false;
      if (err && err.code === 'NO_CHANGE') { C.toast(t('adminPromo.toast.noChange'), 'info'); return; }
      if (err && err.errors) showErrors(host, err.errors); else C.toast(msg(err), 'error');
    });
  }

  function askDelete(kind) {
    openModal(t('adminPromo.delete.title'), '<p class="admin-modal-text">' + esc(t(kind === 'c' ? 'adminPromo.delete.coupon' : 'adminPromo.delete.banner')) + '</p>',
      btn('btn-secondary', 'close', t('adminPromo.btn.cancel')) + btn('btn-danger', kind === 'c' ? 'confirm-del-c' : 'confirm-del-b', t('adminPromo.btn.delete')));
  }
  function askToggle(kind) {
    var key = kind === 'disable' ? 'adminPromo.disable.body' : kind === 'enable' ? 'adminPromo.enable.body' : (kind === 'hide' ? 'adminPromo.hide.body' : 'adminPromo.show.body');
    var act = kind === 'disable' ? 'confirm-disable' : kind === 'enable' ? 'confirm-enable' : kind === 'hide' ? 'confirm-hide' : 'confirm-show';
    openModal(t('adminPromo.confirm.title'), '<p class="admin-modal-text">' + esc(t(key)) + '</p>',
      btn('btn-secondary', 'close', t('adminPromo.btn.cancel')) + btn('btn-primary', act, t('adminPromo.btn.ok')));
  }

  /* ===================== Sự kiện ===================== */
  function onClick(e) {
    var el, target = e.target;
    if (!target || !target.closest) return;
    if (target.hasAttribute('data-ap-backdrop')) {
      if (!modalBusy) { grantPick = null; closeModals(); }
      return;
    }
    if ((el = target.closest('[data-ap]'))) {
      var a = el.getAttribute('data-ap');
      if (a === 'close') { if (!modalBusy) { grantPick = null; closeModals(); } return; }
      if (a === 'rand' && form) { document.getElementById('ap-code').value = TTV.api.generateCouponCode(); return; }
      if (a === 'svc-all' && form) {
        form.data.services = couponAllOn() ? [] : (form.catalog || []).map(function (s) { return s.code; });
        paintCouponServiceChips(); setError(host, 'services', ''); return;
      }
      if (a === 'clear-cimg' && form) {
        if (form.preview) { try { URL.revokeObjectURL(form.preview); } catch (_) {} }
        form.file = null; form.preview = ''; form.data.image_path = '';
        var box = host && host.querySelector('[data-ap-cpreview]'); if (box) box.innerHTML = couponPreview();
        setError(host, 'image_path', ''); return;
      }
      if (a === 'grant') { askGrant(); return; }
      if (a === 'grant-retry') { loadGrantTargets(); return; }
      if (a === 'disable' || a === 'enable' || a === 'hide-b' || a === 'show-b') {
        askToggle(a === 'hide-b' ? 'hide' : a === 'show-b' ? 'show' : a); return;
      }
      if (a === 'delete-c') { askDelete('c'); return; }
      if (a === 'delete-b') { askDelete('b'); return; }
      if (a === 'toggle-active' && bannerForm) {
        bannerForm.data.active = !bannerForm.data.active; paintBannerForm(); return;
      }
      if (a === 'confirm-grant') { doGrant(false); return; }
      if (a === 'confirm-grant-all') {
        if (!grantPick) return;
        if (!grantPick.readyAll) { grantPick.readyAll = true; paintGrantChrome(); return; }
        doGrant(true); return;
      }
      if (a === 'confirm-del-c' && detail) {
        setBusy(true); var my = token;
        TTV.api.deleteAdminCoupon(detail.data.coupon.code).then(function () {
          if (my !== token) return; closeModals(); C.toast(t('adminPromo.toast.deleted'), 'success'); goTo(LIST);
        }).catch(function (err) { if (my !== token) return; setBusy(false); C.toast(msg(err), 'error'); });
        return;
      }
      if (a === 'confirm-del-b' && bannerDetail) {
        setBusy(true); var myb = token;
        TTV.api.deleteAdminBanner(bannerDetail.id).then(function () {
          if (myb !== token) return; closeModals(); C.toast(t('adminPromo.toast.deleted'), 'success'); goTo(LIST);
        }).catch(function (err) { if (myb !== token) return; setBusy(false); C.toast(msg(err), 'error'); });
        return;
      }
      if (a === 'confirm-disable' || a === 'confirm-enable') {
        setBusy(true); var myc = token, st = a === 'confirm-disable' ? 'disabled' : 'active';
        TTV.api.setCouponStatus(detail.data.coupon.code, st).then(function () {
          if (myc !== token) return; closeModals(); C.toast(t(st === 'disabled' ? 'adminPromo.toast.disabled' : 'adminPromo.toast.enabled'), 'success');
          loadCouponDetail(myc, detail.data.coupon.code);
        }).catch(function (err) { if (myc !== token) return; setBusy(false); C.toast(msg(err), 'error'); });
        return;
      }
      if (a === 'confirm-hide' || a === 'confirm-show') {
        setBusy(true); var myh = token, on = a === 'confirm-show';
        TTV.api.setBannerActive(bannerDetail.id, on).then(function () {
          if (myh !== token) return; closeModals(); C.toast(t(on ? 'adminPromo.toast.shown' : 'adminPromo.toast.hidden'), 'success');
          loadBannerDetail(myh, bannerDetail.id);
        }).catch(function (err) { if (myh !== token) return; setBusy(false); C.toast(msg(err), 'error'); });
        return;
      }
      return;
    }
    if ((el = target.closest('[data-ap-pick]')) && grantPick) {
      if (el.disabled) return;
      var pickId = el.getAttribute('data-ap-pick');
      if (grantPick.ids[pickId]) delete grantPick.ids[pickId]; else grantPick.ids[pickId] = true;
      grantPick.readyAll = false;
      paintGrantChrome();
      var errEl = document.querySelector('[data-ap-err="user_id"]'); if (errEl) errEl.hidden = true;
      return;
    }
    if ((el = target.closest('[data-ap-go]'))) { goTo(LIST + '/' + el.getAttribute('data-ap-go')); return; }
    if ((el = target.closest('[data-ap-svc]')) && form) {
      var code = el.getAttribute('data-ap-svc'), list = (form.data.services || []).slice(), i = list.indexOf(code);
      if (i >= 0) list.splice(i, 1); else list.push(code);
      form.data.services = list; paintCouponServiceChips(); setError(host, 'services', ''); return;
    }
    if ((el = target.closest('[data-ap-dtype]')) && form) {
      var keepFile = form.file, keepPreview = form.preview, keepCat = form.catalog;
      form.data = readCouponForm(); form.data.discount_type = el.getAttribute('data-ap-dtype');
      form.file = keepFile; form.preview = keepPreview; form.catalog = keepCat;
      paintCouponForm(); return;
    }
    if ((el = target.closest('[data-ap-btype]')) && bannerForm) { bannerForm.data.type = el.getAttribute('data-ap-btype'); paintBannerForm(); return; }
    if ((el = target.closest('[data-ap-btarget]')) && bannerForm) { bannerForm.data.target = el.getAttribute('data-ap-btarget'); paintBannerForm(); return; }
    if (hub && host && host.contains(target)) {
      if ((el = target.closest('[data-ap-tab]'))) {
        hub.tab = el.getAttribute('data-ap-tab'); hub.page = 0; host.innerHTML = hubShell(); paintHub(); return;
      }
      if ((el = target.closest('[data-ap-filter]'))) {
        hub.filter = el.getAttribute('data-ap-filter'); hub.page = 0;
        host.querySelectorAll('[data-ap-filter]').forEach(function (b) { var on = b.getAttribute('data-ap-filter') === hub.filter; b.classList.toggle('is-selected', on); });
        paintHub(); return;
      }
      if ((el = target.closest('[data-ap-open-c]'))) { goTo(LIST + '/coupons/' + encodeURIComponent(el.getAttribute('data-ap-open-c'))); return; }
      if ((el = target.closest('[data-ap-open-b]'))) { goTo(LIST + '/banners/' + encodeURIComponent(el.getAttribute('data-ap-open-b'))); return; }
      if ((el = target.closest('[data-ap-page]'))) { hub.page += Number(el.getAttribute('data-ap-page')); paintHub(); window.scrollTo(0, 0); return; }
    }
    if (host && (el = target.closest('[data-action]'))) {
      var act = el.getAttribute('data-action');
      if (act === 'ap-retry') loadHub(token);
      else if (act === 'ap-retry-c' && detail) loadCouponDetail(token, detail.data.coupon.code);
      else if (act === 'ap-back') goTo(LIST);
    }
  }
  function onInput(e) {
    var el = e.target;
    if (hub && el && el.id === 'ap-search') { hub.q = el.value; hub.page = 0; paintHub(); return; }
    if (el && el.id === 'ap-grant-q' && grantPick) { grantPick.q = el.value; paintGrantChrome(); return; }
    if (el && (el.id === 'ap-min' || el.id === 'ap-cap' || (el.id === 'ap-value' && form && form.data.discount_type === 'fixed'))) {
      var digits = el.value.replace(/\D/g, '').slice(0, 9);
      el.value = digits ? Number(digits).toLocaleString('vi-VN') : '';
    }
  }
  function onChange(e) {
    var el = e.target;
    if (el && el.id === 'ap-cimg' && form) {
      var cfile = el.files && el.files[0];
      if (!cfile) return;
      if (!/^image\//.test(cfile.type || '')) { C.toast(t('adminPromo.banner.notImage'), 'error'); el.value = ''; return; }
      if (cfile.size > MAX_IMG) { C.toast(t('adminPromo.banner.tooBig'), 'error'); el.value = ''; return; }
      if (form.preview) { try { URL.revokeObjectURL(form.preview); } catch (_) {} }
      form.file = cfile; form.preview = URL.createObjectURL(cfile);
      var cbox = host && host.querySelector('[data-ap-cpreview]'); if (cbox) cbox.innerHTML = couponPreview();
      setError(host, 'image_path', ''); return;
    }
    if (!el || el.id !== 'ap-img' || !bannerForm) return;
    var file = el.files && el.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type || '')) { C.toast(t('adminPromo.banner.notImage'), 'error'); el.value = ''; return; }
    if (file.size > MAX_IMG) { C.toast(t('adminPromo.banner.tooBig'), 'error'); el.value = ''; return; }
    if (bannerForm.preview) { try { URL.revokeObjectURL(bannerForm.preview); } catch (_) {} }
    bannerForm.file = file; bannerForm.preview = URL.createObjectURL(file);
    var box = host && host.querySelector('[data-ap-preview]'); if (box) box.innerHTML = bannerPreview();
    setError(host, 'image_path', '');
  }
  function onSubmit(e) {
    if (e.target && e.target.id === 'ap-c-form') submitCoupon(e);
    if (e.target && e.target.id === 'ap-b-form') submitBanner(e);
  }
  function onKey(e) {
    if (e.key === 'Escape' && !modalBusy && document.querySelector('[data-ap-backdrop]')) { grantPick = null; closeModals(); }
  }

  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  document.addEventListener('submit', onSubmit);
  document.addEventListener('keydown', onKey);

  function destroy() {
    token++;
    if (form && form.preview) { try { URL.revokeObjectURL(form.preview); } catch (_) {} }
    if (bannerForm && bannerForm.preview) { try { URL.revokeObjectURL(bannerForm.preview); } catch (_) {} }
    hub = form = detail = bannerForm = bannerDetail = host = grantPick = null; closeModals();
  }

  TTV.screens.adminPromotions = { renderHub: renderHub, destroy: destroy };
  var opts = { roles: ['SUPER_ADMIN'], loginRoute: '/staff-login', deniedRoute: '/admin', destroy: destroy };
  TTV.Router.add('/admin/promotions', renderHub, opts);
  TTV.Router.add('/admin/promotions/coupons/new', renderCouponForm, opts);
  TTV.Router.add('/admin/promotions/banners/new', renderBannerForm, opts);
  TTV.Router.add('/admin/promotions/coupons/:code/edit', renderCouponForm, opts);
  TTV.Router.add('/admin/promotions/banners/:id/edit', renderBannerForm, opts);
  TTV.Router.add('/admin/promotions/coupons/:code', renderCouponDetail, opts);
  TTV.Router.add('/admin/promotions/banners/:id', renderBannerDetail, opts);
})(window.TTV);
