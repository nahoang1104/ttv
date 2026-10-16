/* Sổ địa chỉ khách — #/address (task 4.2, ảnh 07 + ảnh giao diện gửi kèm). */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var rootEl = null;
  var rows = [];
  var q = '';
  var C = TTV.Components;

  function t(key, vars) { return TTV.I18n.t(key, vars); }
  function esc(v) { return C.escape(v); }

  function matches(row) {
    var needle = q.trim().toLowerCase();
    if (!needle) return true;
    var type = TTV.Address.name(row.type);
    var blob = [row.label, row.detail, row.contact_name, row.contact_phone, type].join(' ').toLowerCase();
    return blob.indexOf(needle) >= 0;
  }

  function visible() {
    return rows.filter(matches);
  }

  function cardHtml(row) {
    var tp = TTV.Address.of(row.type);
    var name = row.contact_name || '—';
    var phone = row.contact_phone || '—';
    return '<article class="ab-card">' +
      '<div class="ab-card__body">' +
        '<span class="ab-ico ab-ico--' + tp.id + '" aria-hidden="true">' + TTV.Address.icon(tp.id) + '</span>' +
        '<div class="ab-card__main">' +
          '<div class="ab-card__tags">' +
            '<span class="ab-chip ab-chip--' + tp.id + '">' + esc(tp.name) + '</span>' +
            '<strong>' + esc(row.label || tp.name) + '</strong>' +
            (row.default_for === 'pickup' ? '<span class="ab-chip ab-chip--pickup">' + esc(t('addrBook.defaultPickup')) + '</span>' : '') +
            (row.default_for === 'dropoff' ? '<span class="ab-chip ab-chip--dropoff">' + esc(t('addrBook.defaultDropoff')) + '</span>' : '') +
          '</div>' +
          '<p class="ab-card__detail">' + esc(row.detail || '') + '</p>' +
          '<p class="ab-card__meta">' +
            '<span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.1" fill="none" stroke="currentColor" stroke-width="1.7"/><path fill="none" stroke="currentColor" stroke-width="1.7" d="M5.6 19.2c.7-3.2 3.2-4.8 6.4-4.8s5.7 1.6 6.4 4.8"/></svg>' + esc(name) + '</span>' +
            '<span><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" d="M7.2 5.6h3.1l.9 2.4-1.6 1.1a11 11 0 0 0 5.3 5.3l1.1-1.6 2.4.9v3.1c0 .7-.6 1.3-1.3 1.3C9.8 17.9 6 14.1 5.9 6.9c0-.7.6-1.3 1.3-1.3z"/></svg>' + esc(phone) + '</span>' +
          '</p>' +
        '</div>' +
      '</div>' +
      '<div class="ab-card__acts">' +
        '<button type="button" class="ab-btn ab-btn--edit" data-ab-edit="' + esc(row.id) + '">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M5 16.8V19h2.2L17.6 8.6 15.4 6.4 5 16.8z"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="m13.8 5 2.2 2.2"/></svg>' +
          esc(t('addrBook.edit')) +
        '</button>' +
        '<button type="button" class="ab-btn ab-btn--del" data-ab-del="' + esc(row.id) + '">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M6.5 8h11M10 8V6.4h4V8M8.2 8l.7 11h6.2l.7-11"/></svg>' +
          esc(t('addrBook.delete')) +
        '</button>' +
      '</div>' +
    '</article>';
  }

  function listHtml() {
    if (!rows.length) return C.emptyState(t('addrBook.empty.title'), t('addrBook.empty.desc'));
    var list = visible();
    if (!list.length) return C.emptyState(t('addrBook.empty.filter'), t('addrBook.empty.desc'));
    return list.map(cardHtml).join('');
  }

  function paint() {
    if (!rootEl) return;
    rootEl.classList.remove('is-wide');
    rootEl.innerHTML =
      '<div class="ab">' +
        C.header(t('addrBook.title'), { back: true }) +
        '<main class="ab-page">' +
          '<p class="ab-lead">' + esc(t('addrBook.lead')) + '</p>' +
          C.search(t('addrBook.search'), { value: q, input: { 'data-ab-q': '' } }) +
          '<div class="ab-list">' + listHtml() + '</div>' +
        '</main>' +
        '<div class="ab-bar">' +
          C.button('+ ' + t('addrBook.add'), { variant: 'primary', block: true, action: 'ab-add' }) +
        '</div>' +
        C.bottomTab('profile') +
      '</div>';
    bind();
  }

  function bind() {
    var input = rootEl.querySelector('[data-ab-q]');
    if (input) {
      input.addEventListener('input', function () {
        q = input.value;
        var box = rootEl.querySelector('.ab-list');
        if (box) box.innerHTML = listHtml();
      });
    }
  }

  function confirmDelete(id) {
    document.body.insertAdjacentHTML('beforeend', C.modal(
      t('addrBook.delete.title'),
      '<p>' + esc(t('addrBook.delete.confirm')) + '</p>',
      {
        footer:
          '<button type="button" class="btn btn-secondary" data-modal-close>' + esc(t('common.cancel')) + '</button>' +
          '<button type="button" class="btn btn-danger" data-ab-del-ok="' + esc(id) + '">' + esc(t('addrBook.delete')) + '</button>'
      }
    ));
  }

  function onClick(e) {
    if (!rootEl) return;
    if (!rootEl.contains(e.target) && !e.target.closest('[data-ab-del-ok]')) return;
    var add = e.target.closest('[data-action="ab-add"]');
    if (add) {
      TTV.Router.navigate('/address/new');
      return;
    }
    var edit = e.target.closest('[data-ab-edit]');
    if (edit) {
      TTV.Router.navigate('/address/edit/' + edit.getAttribute('data-ab-edit'));
      return;
    }
    var del = e.target.closest('[data-ab-del]');
    if (del) {
      confirmDelete(del.getAttribute('data-ab-del'));
      return;
    }
    var ok = e.target.closest('[data-ab-del-ok]');
    if (ok) {
      var id = ok.getAttribute('data-ab-del-ok');
      var overlay = ok.closest('.modal-backdrop');
      if (overlay) overlay.remove();
      TTV.api.deleteAddress(id).then(function () {
        return TTV.api.listAddresses();
      }).then(function (list) {
        rows = list || [];
        C.toast(t('addrBook.delete.done'), 'success');
        var box = rootEl && rootEl.querySelector('.ab-list');
        if (box) box.innerHTML = listHtml();
        else paint();
      }).catch(function (err) {
        C.toast((err && err.message) || t('addrBook.err'), 'danger');
      });
    }
  }

  TTV.screens.addresses = {
    render: function (container) {
      this.destroy();
      rootEl = container;
      q = '';
      rootEl.innerHTML = C.header(t('addrBook.title'), { back: true }) +
        '<main class="page">' + C.loading(t('common.loading')) + '</main>' + C.bottomTab('profile');
      document.addEventListener('click', onClick);
      TTV.api.listAddresses().then(function (list) {
        rows = list || [];
        paint();
      }).catch(function () {
        rootEl.innerHTML = C.header(t('addrBook.title'), { back: true }) +
          '<main class="page">' + C.emptyState(t('addrBook.err'), '') + '</main>' + C.bottomTab('profile');
      });
    },
    destroy: function () {
      document.removeEventListener('click', onClick);
      var overlay = document.querySelector('.modal-backdrop');
      if (overlay) overlay.remove();
      rootEl = null;
      rows = [];
    }
  };
})(window.TTV);
