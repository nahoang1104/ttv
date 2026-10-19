/* Đánh giá của khách — #/reviews (danh sách) + #/orders/:id/review (chấm sao). */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components;
  var listEl = null, formEl = null, token = 0, tab = 'pending';
  var LABELS = ['', 'Tệ', 'Không hài lòng', 'Bình thường', 'Hài lòng', 'Tuyệt vời'];

  function t(key, p) { return TTV.I18n.t(key, p); }
  function esc(v) { return C.escape(v); }

  function starSvg(on) {
    var fill = on ? '#F5B400' : 'none';
    var stroke = on ? '#F5B400' : '#D8DEE8';
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.4" stroke-linejoin="round" d="m12 3.4 2.6 5.4 6 .8-4.4 4.2 1.1 5.9L12 16.8 6.7 19.7 7.8 13.8 3.4 9.6l6-.8z"/></svg>';
  }
  function starsHtml(n, interactive) {
    var out = '';
    for (var i = 1; i <= 5; i++) {
      if (interactive) {
        out += '<button type="button" class="rv-star' + (i <= n ? ' is-on' : '') + '" data-rv-star="' + i + '" aria-label="' + i + ' sao">' + starSvg(i <= n) + '</button>';
      } else {
        out += '<span class="rv-star' + (i <= n ? ' is-on' : '') + '">' + starSvg(i <= n) + '</span>';
      }
    }
    return '<div class="rv-stars" role="' + (interactive ? 'radiogroup' : 'img') + '">' + out + '</div>';
  }
  function avatarHtml(v, cls) {
    v = v || {};
    return '<div class="' + (cls || 'rv-avatar') + '">' + C.avatar(v.name || '?', v.avatar_path, { size: 'lg' }) + '</div>';
  }
  function emptyHtml(title, desc) {
    return '<section class="rv-empty">' +
      '<div class="rv-empty__art" aria-hidden="true">' +
        '<svg viewBox="0 0 96 96" width="92" height="92">' +
          '<rect x="22" y="42" width="52" height="36" rx="8" fill="#E8F3FF"/>' +
          '<path d="M22 50 V42 l26-16 26 16 v8" fill="#D4E9FF"/>' +
          '<path d="M22 50h52" stroke="#B7D6F8" stroke-width="2"/>' +
          '<circle cx="48" cy="30" r="14" fill="#3D9CF0"/>' +
          '<path fill="#fff" d="m48 22.5 2.1 4.3 4.7.7-3.4 3.3.8 4.7L48 33.3l-4.2 2.2.8-4.7-3.4-3.3 4.7-.7z"/>' +
        '</svg></div>' +
      '<h3>' + esc(title) + '</h3>' +
      '<p>' + esc(desc) + '</p></section>';
  }

  /* ----- Form chấm sao ----- */
  function formMarkup(order, rating, comment, saved) {
    var v = (order && order.vendor) || {};
    var n = Number(rating) || 0;
    var label = n ? LABELS[n] : t('rv.pick');
    return '<div class="rv-form">' +
      C.header(t('rv.form.title')) +
      '<main class="rv-form__main">' +
        avatarHtml(v) +
        '<h2 class="rv-name">' + esc(v.name || t('rv.noVendor')) + '</h2>' +
        starsHtml(n, !saved) +
        '<p class="rv-label">' + esc(label) + '</p>' +
        (saved
          ? (comment ? '<p class="rv-comment-read">“' + esc(comment) + '”</p>' : '')
          : '<label class="field rv-note"><span class="field__label">' + esc(t('rv.comment')) + '</span>' +
            '<textarea id="rv-comment" maxlength="500" rows="3" placeholder="' + esc(t('rv.comment.ph')) + '">' + esc(comment || '') + '</textarea></label>') +
      '</main>' +
      (saved
        ? '<div class="rv-bar"><button type="button" class="btn btn-primary btn-block" data-rv-back>' + esc(t('rv.done.cta')) + '</button></div>'
        : '<div class="rv-bar"><button type="button" class="btn btn-primary btn-block" data-rv-send' + (n ? '' : ' disabled') + '>' + esc(t('rv.send')) + '</button></div>') +
    '</div>';
  }
  function renderForm(container, ctx) {
    destroyForm();
    formEl = container;
    var oid = ctx && ctx.params && ctx.params.id;
    var my = ++token;
    formEl.innerHTML = C.loading(t('common.loading'));
    TTV.api.getOrder(oid).then(function (order) {
      if (my !== token || !formEl) return;
      if (order.status !== 'completed') {
        TTV.Components.toast(t('rv.onlyCompleted'), 'info');
        TTV.Router.navigate('/orders/' + order.id, { replace: true });
        return;
      }
      var saved = order.my_review;
      var rating = saved ? saved.rating : 0;
      var comment = saved ? saved.comment : '';
      formEl.innerHTML = formMarkup(order, rating, comment, !!saved);
      formEl.onclick = function (e) {
        var star = e.target.closest('[data-rv-star]');
        if (star && !saved) {
          rating = Number(star.getAttribute('data-rv-star')) || 0;
          var ta = formEl.querySelector('#rv-comment');
          comment = ta ? ta.value : comment;
          formEl.innerHTML = formMarkup(order, rating, comment, false);
          return;
        }
        if (e.target.closest('[data-rv-back]')) {
          TTV.Router.navigate('/reviews');
          return;
        }
        var send = e.target.closest('[data-rv-send]');
        if (!send || send.disabled) return;
        var ta = formEl.querySelector('#rv-comment');
        send.disabled = true;
        TTV.api.submitReview({ order_id: order.id, rating: rating, comment: ta ? ta.value : '' }).then(function () {
          TTV.Components.toast(t('rv.sent'), 'success');
          TTV.Router.navigate('/reviews');
        }).catch(function (err) {
          send.disabled = false;
          TTV.Components.toast((err && err.message) || t('common.error'), 'danger');
        });
      };
    }).catch(function (err) {
      if (my !== token || !formEl) return;
      formEl.innerHTML = C.header(t('rv.form.title')) + '<main class="page">' + C.emptyState(t('rv.err'), (err && err.message) || '', { icon: '!' }) + '</main>';
    });
  }
  function destroyForm() {
    token++;
    if (formEl) formEl.onclick = null;
    formEl = null;
  }

  /* ----- Danh sách 2 tab ----- */
  function cardPending(it) {
    var v = it.vendor || {};
    return '<a class="rv-card" href="#/orders/' + esc(it.order_id) + '/review">' +
      avatarHtml(v, 'rv-card__av') +
      '<div class="rv-card__text"><strong>' + esc(v.name || t('rv.noVendor')) + '</strong>' +
        '<span>' + esc(it.service_name) + ' · ' + esc(it.code) + '</span></div>' +
      '<span class="rv-card__cta">' + esc(t('rv.cta')) + '</span></a>';
  }
  function cardDone(it) {
    var v = it.vendor || {}, r = it.review || {};
    return '<a class="rv-card" href="#/orders/' + esc(it.order_id) + '">' +
      avatarHtml(v, 'rv-card__av') +
      '<div class="rv-card__text"><strong>' + esc(v.name || t('rv.noVendor')) + '</strong>' +
        '<span>' + esc(it.service_name) + ' · ' + esc(it.code) + '</span>' +
        starsHtml(r.rating, false) +
        (r.comment ? '<p>“' + esc(r.comment) + '”</p>' : '') +
        (r.vendor_reply ? '<p class="rv-reply">' + esc(t('rv.reply', { text: r.vendor_reply })) + '</p>' : '') +
      '</div></a>';
  }
  function paintList(data) {
    if (!listEl) return;
    var pending = data.pending || [], done = data.done || [];
    var list = tab === 'done' ? done : pending;
    var empty = tab === 'done'
      ? emptyHtml(t('rv.empty.done.title'), t('rv.empty.done.desc'))
      : emptyHtml(t('rv.empty.pending.title'), t('rv.empty.pending.desc'));
    listEl.innerHTML =
      C.header(t('rv.list.title')) +
      '<div class="rv">' +
        '<div class="rv-tabs" role="tablist">' +
          '<button type="button" role="tab" class="rv-tab' + (tab === 'pending' ? ' is-on' : '') + '" data-rv-tab="pending" aria-selected="' + (tab === 'pending') + '">' +
            esc(t('rv.tab.pending', { n: pending.length })) + '</button>' +
          '<button type="button" role="tab" class="rv-tab' + (tab === 'done' ? ' is-on' : '') + '" data-rv-tab="done" aria-selected="' + (tab === 'done') + '">' +
            esc(t('rv.tab.done', { n: done.length })) + '</button>' +
        '</div>' +
        '<main class="rv-body' + (list.length ? '' : ' is-empty') + '">' +
          (list.length ? '<div class="rv-cards">' + list.map(tab === 'done' ? cardDone : cardPending).join('') + '</div>' : empty) +
        '</main>' +
      '</div>' +
      C.bottomTab('profile');
  }
  function renderList(container) {
    destroyList();
    listEl = container;
    var my = ++token;
    listEl.innerHTML = C.loading(t('common.loading'));
    TTV.api.listMyReviews().then(function (data) {
      if (my !== token || !listEl) return;
      paintList(data);
      listEl.onclick = function (e) {
        var b = e.target.closest('[data-rv-tab]');
        if (!b) return;
        tab = b.getAttribute('data-rv-tab') === 'done' ? 'done' : 'pending';
        paintList(data);
      };
    }).catch(function (err) {
      if (my !== token || !listEl) return;
      listEl.innerHTML = C.header(t('rv.list.title')) + '<main class="page">' +
        C.emptyState(t('rv.err'), (err && err.message) || '', { icon: '!' }) + '</main>' + C.bottomTab('profile');
    });
  }
  function destroyList() {
    token++;
    if (listEl) listEl.onclick = null;
    listEl = null;
  }

  TTV.screens.reviews = { render: renderList, destroy: destroyList };
  TTV.screens.reviewForm = { render: renderForm, destroy: destroyForm };
})(window.TTV);
