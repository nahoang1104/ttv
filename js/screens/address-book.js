/* Sổ địa chỉ — #/address (task 4.2). Bám docs/reference/07-so-dia-chi-*.jpg */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var rootEl = null;
  var box = null;
  var rows = [];
  var q = '';
  var status = 'loading'; // loading | ready | error
  var token = 0;

  function esc(v) { return TTV.Components.escape(v); }
  function t(key, vars) { return TTV.I18n.t(key, vars); }

  // Bỏ dấu để tìm "van phong" ra "Văn phòng".
  function fold(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function typeName(id) { return t('address.type.' + (id || 'other')); }
  function typeIcon(id) {
    var f = TTV.screens.addressForm;
    return f && f.typeIcon ? f.typeIcon(id) : '';
  }

  function visible() {
    var needle = fold(q).trim();
    if (!needle) return rows;
    return rows.filter(function (r) {
      return [r.label, r.detail, r.contact_name, r.contact_phone, typeName(r.type)].some(function (v) {
        return fold(v).indexOf(needle) >= 0;
      });
    });
  }

  function cardHtml(r) {
    var personIco = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><circle cx="12" cy="8.2" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="M5.6 19.2c.7-3.2 3.2-4.8 6.4-4.8s5.7 1.6 6.4 4.8"/></svg>';
    var phoneIco = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M6.6 4.5h3l1.4 4-2 1.3a10.5 10.5 0 0 0 5.2 5.2l1.3-2 4 1.4v3a1.8 1.8 0 0 1-1.9 1.8C11.4 19 5 12.6 4.8 6.4a1.8 1.8 0 0 1 1.8-1.9z"/></svg>';
    var editIco = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.9" d="M4.5 19.5l1-4L16.2 4.8a1.8 1.8 0 0 1 2.5 0l.5.5a1.8 1.8 0 0 1 0 2.5L8.5 18.5z"/></svg>';
    var delIco = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.9" d="M5 7h14M9.5 7V4.8h5V7M7 7l.8 12h8.4L17 7M10 10.5v5.5M14 10.5v5.5"/></svg>';
    var who = '';
    if (r.contact_name) who += '<span>' + personIco + esc(r.contact_name) + '</span>';
    if (r.contact_phone) who += '<span>' + phoneIco + esc(r.contact_phone) + '</span>';
    return '<article class="ab-card" data-id="' + esc(r.id) + '">' +
      '<div class="ab-card__top">' +
        '<span class="ab-card__ico">' + typeIcon(r.type) + '</span>' +
        '<div class="ab-card__body">' +
          '<div class="ab-card__title">' +
            '<span class="ab-tag">' + esc(typeName(r.type)) + '</span>' +
            '<strong>' + esc(r.label) + '</strong>' +
            (r.is_default ? '<span class="ab-default">' + esc(t('address.default')) + '</span>' : '') +
          '</div>' +
          '<p class="ab-card__addr">' + esc(r.detail) + '</p>' +
          (who ? '<div class="ab-card__who">' + who + '</div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="ab-card__acts">' +
        '<button type="button" class="ab-act ab-act--edit" data-ab="edit" data-id="' + esc(r.id) + '">' + editIco + ' ' + esc(t('address.edit')) + '</button>' +
        '<button type="button" class="ab-act ab-act--del" data-ab="delete" data-id="' + esc(r.id) + '">' + delIco + ' ' + esc(t('address.delete')) + '</button>' +
      '</div>' +
    '</article>';
  }

  function pinIcon() {
    return '<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M12 21s6.5-5.6 6.5-11A6.5 6.5 0 0 0 5.5 10C5.5 15.4 12 21 12 21z"/><circle cx="12" cy="10" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  }

  function emptyHtml(title, desc) {
    return '<section class="ab-empty"><div class="ab-empty__icon">' + pinIcon() + '</div><h3>' + esc(title) + '</h3><p>' + esc(desc) + '</p></section>';
  }

  function listHtml() {
    if (status === 'loading') return TTV.Components.loading(t('common.loading'));
    if (status === 'error') {
      return emptyHtml(t('common.error'), t('address.loadError')) +
        '<button type="button" class="btn btn-secondary ab-retry" data-ab="retry">' + esc(t('address.retry')) + '</button>';
    }
    if (!rows.length) return emptyHtml(t('address.empty.title'), t('address.empty.desc'));
    var list = visible();
    if (!list.length) return emptyHtml(t('address.noMatch.title'), t('address.noMatch.desc'));
    return list.map(cardHtml).join('');
  }

  function paintList() {
    var el = box && box.querySelector('[data-ab-list]');
    if (el) el.innerHTML = listHtml();
  }

  function paint() {
    if (!rootEl) return;
    rootEl.classList.remove('is-wide');
    rootEl.innerHTML = '<div class="ab">' +
      TTV.Components.header(t('address.title'), { back: true }) +
      '<main class="ab-page">' +
        '<p class="ab-desc">' + esc(t('address.desc')) + '</p>' +
        '<label class="ab-search"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="11" cy="11" r="6.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M16 16l4 4"/></svg>' +
          '<input type="search" data-ab-q placeholder="' + esc(t('address.search')) + '" autocomplete="off" value="' + esc(q) + '"></label>' +
        '<div data-ab-list>' + listHtml() + '</div>' +
      '</main>' +
      '<div class="addr-bar"><button type="button" class="btn btn-primary btn-block addr-save" data-route="/address/new">+ ' + esc(t('address.add')) + '</button></div>' +
    '</div>';
    box = rootEl.querySelector('.ab');
    box.addEventListener('click', onClick);
    box.addEventListener('input', onInput);
  }

  function load() {
    var my = ++token;
    status = 'loading';
    paintList();
    (TTV.api.listAddresses ? TTV.api.listAddresses() : Promise.resolve([])).then(function (list) {
      if (my !== token || !rootEl) return;
      rows = list || [];
      status = 'ready';
      paintList();
    }).catch(function () {
      if (my !== token || !rootEl) return;
      status = 'error';
      paintList();
    });
  }

  function onInput(e) {
    if (!e.target.hasAttribute('data-ab-q')) return;
    q = e.target.value;
    paintList();
  }

  function findRow(id) {
    for (var i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i];
    return null;
  }

  function confirmDelete(row) {
    var C = TTV.Components;
    var footer = '<button type="button" class="btn btn-secondary" data-ab-modal="cancel">' + esc(t('common.cancel')) + '</button>' +
      '<button type="button" class="btn btn-primary ab-del-ok" data-ab-modal="ok">' + esc(t('address.delete')) + '</button>';
    document.body.insertAdjacentHTML('beforeend',
      C.modal(t('address.delete.title'), '<p class="ab-del-msg">' + esc(t('address.delete.body', { label: row.label })) + '</p>', { footer: footer }));
    var modals = document.querySelectorAll('.modal-backdrop');
    var modal = modals[modals.length - 1];
    modal.classList.add('ab-modal');
    modal.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-ab-modal]');
      if (!btn) return;
      var which = btn.getAttribute('data-ab-modal');
      if (which === 'cancel') { modal.remove(); return; }
      btn.disabled = true;
      TTV.api.deleteAddress(row.id).then(function () {
        modal.remove();
        C.toast(t('address.deleted'), 'success');
        load();
      }).catch(function (err) {
        btn.disabled = false;
        C.toast((err && err.message) || t('common.error'), 'danger');
      });
    });
  }

  function onClick(e) {
    var btn = e.target.closest('[data-ab]');
    if (!btn) return;
    var act = btn.getAttribute('data-ab');
    if (act === 'retry') { load(); return; }
    var row = findRow(btn.getAttribute('data-id'));
    if (!row) return;
    if (act === 'edit') TTV.Router.navigate('/address/edit/' + encodeURIComponent(row.id));
    if (act === 'delete') confirmDelete(row);
  }

  TTV.screens.addressBook = {
    render: function (container) {
      rootEl = container;
      q = '';
      rows = [];
      paint();
      load();
    },
    destroy: function () {
      token++;
      var m = document.querySelector('.ab-modal');
      if (m) m.remove();
      rootEl = null;
      box = null;
    }
  };
})(window.TTV);
