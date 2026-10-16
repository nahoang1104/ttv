/* Ô đáy chi tiết đơn khi thợ đã được chọn: Bắt đầu đến → Đã đến, bắt đầu bốc → Hoàn thành (+ minh chứng). */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components;
  var MAX_PHOTOS = 7;
  var busy = false;
  var proof = null;

  function t(key, params) { return TTV.I18n.t(key, params); }
  function esc(v) { return C.escape(v); }
  function isActiveJob(v) {
    return v && v.is_mine && (v.status === 'matched' || v.status === 'arriving' || v.status === 'working' || v.status === 'completed');
  }
  function telOf(v) {
    var phone = v && v.customer && v.customer.phone;
    var tel = String(phone || '').replace(/[^\d+]/g, '');
    return tel ? { phone: phone, href: 'tel:' + tel } : null;
  }
  function ico(name) {
    var map = {
      cam: '<svg viewBox="0 0 24 24"><path fill="none" stroke="#8b96a8" stroke-width="1.7" d="M4.5 8.2h3l1.4-2.2h6.2L16.5 8.2h3v10.2h-15z"/><circle cx="12" cy="13.2" r="3.1" fill="none" stroke="#8b96a8" stroke-width="1.7"/></svg>',
      trash: '<svg viewBox="0 0 24 24"><path fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" d="M8 8h8M10 8V6.8h4V8M9.2 8l.6 10h4.4l.6-10"/></svg>',
      play: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M9 6.8v10.4L19 12z"/></svg>',
      playOk: '<svg viewBox="0 0 24 24"><path fill="#16a34a" d="M9 6.8v10.4L19 12z"/></svg>',
      redo: '<svg viewBox="0 0 24 24"><path fill="none" stroke="#2563eb" stroke-width="1.8" stroke-linecap="round" d="M7.2 8.2A6.2 6.2 0 1 1 6 12"/><path fill="#2563eb" d="M7.2 4.8v4.2h4.2"/></svg>',
      trashRed: '<svg viewBox="0 0 24 24"><path fill="none" stroke="#e11d48" stroke-width="1.8" stroke-linecap="round" d="M8 8h8M10 8V6.8h4V8M9.2 8l.6 10h4.4l.6-10"/></svg>'
    };
    return map[name] || '';
  }
  function run(btn, fn, okKey, reload) {
    if (!btn || busy) return;
    busy = true;
    btn.disabled = true;
    fn().then(function (row) {
      busy = false;
      C.toast(t(okKey), 'success');
      if (typeof reload === 'function') reload(row);
    }).catch(function (err) {
      busy = false;
      btn.disabled = false;
      C.toast((err && err.message) || t('common.error'), 'danger');
      if (err && (err.code === 'CONFLICT' || err.code === 'FORBIDDEN') && typeof reload === 'function') reload();
    });
  }

  function isImageFile(file) {
    if (!file) return false;
    if (/^image\//.test(file.type || '')) return true;
    return /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(file.name || '');
  }
  function canSubmit() {
    return !!(proof && proof.images.length && proof.video);
  }
  function clearProofBlobs() {
    if (!proof) return;
    (proof.images || []).forEach(function (item) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    if (proof.video && TTV.ui.orderMedia) TTV.ui.orderMedia.revoke(proof.video.previewUrl);
  }
  function closeProof() {
    clearProofBlobs();
    proof = null;
    document.querySelectorAll('[data-vj-proof]').forEach(function (el) { el.remove(); });
  }
  function photoMarkup() {
    var list = proof.images;
    var thumbs = list.map(function (item) {
      return '<div class="order-thumb">' +
        '<img src="' + esc(item.previewUrl) + '" alt="">' +
        '<button type="button" class="order-thumb__del" data-vj-proof-act="remove-photo" data-id="' + esc(item.id) + '" aria-label="' + esc(t('vendorJob.proof.removePhoto')) + '">' + ico('trash') + '</button></div>';
    }).join('');
    if (list.length < MAX_PHOTOS) {
      thumbs += '<button type="button" class="order-add-photo" data-vj-proof-act="add-photo">' + ico('cam') + '<small>' + esc(t('vendorJob.proof.add')) + '</small></button>';
    }
    return '<div class="vj-proof-card">' +
      '<div class="vj-proof-card__head"><b>' + esc(t('vendorJob.proof.photos')) + '</b><span>' + list.length + '/' + MAX_PHOTOS + '</span></div>' +
      '<div class="order-thumbs vj-proof-thumbs">' + thumbs + '</div></div>';
  }
  function videoMarkup() {
    var v = proof.video;
    if (!v) {
      return '<button type="button" class="vj-proof-card vj-proof-video" data-vj-proof-act="add-video">' +
        '<span class="order-video__thumb" aria-hidden="true"><span class="order-video__play">' + ico('play') + '</span></span>' +
        '<span class="order-video__txt"><strong>' + esc(t('vendorJob.proof.video')) + '</strong><small>' + esc(t('vendorJob.proof.videoHint')) + '</small></span></button>';
    }
    var mmss = TTV.ui.orderMedia.formatDuration(v.duration);
    var thumbInner = v.poster
      ? '<img class="order-video__poster" src="' + esc(v.poster) + '" alt="">'
      : '<span class="order-video__play">' + ico('play') + '</span>';
    return '<section class="vj-proof-card vj-proof-video is-ready">' +
      '<button type="button" class="order-video__thumb" data-vj-proof-act="play-video" aria-label="' + esc(t('vendorJob.proof.play')) + '">' + thumbInner + '</button>' +
      '<div class="order-video__txt">' +
        '<button type="button" class="order-video__ok" data-vj-proof-act="play-video">' + ico('playOk') + ' ' + esc(t('vendorJob.proof.recorded', { time: mmss })) + '</button>' +
        '<div class="order-video__acts">' +
          '<button type="button" data-vj-proof-act="add-video">' + ico('redo') + ' ' + esc(t('vendorJob.proof.retake')) + '</button>' +
          '<button type="button" data-vj-proof-act="remove-video">' + ico('trashRed') + ' ' + esc(t('vendorJob.proof.removeVideo')) + '</button>' +
        '</div></div></section>';
  }
  function paintProof() {
    var sheet = document.querySelector('[data-vj-proof]');
    if (!sheet || !proof) return;
    var box = sheet.querySelector('[data-vj-proof-body]');
    if (box) {
      box.innerHTML = '<p class="vj-proof-hint">' + esc(t('vendorJob.proof.hint')) + '</p>' +
        photoMarkup() + videoMarkup() +
        (canSubmit() ? '' : '<p class="vj-proof-need">' + esc(t('vendorJob.proof.need')) + '</p>');
    }
    var btn = sheet.querySelector('[data-vj-proof-go]');
    if (btn && !busy) {
      btn.disabled = !canSubmit();
      btn.textContent = t('vendorJob.complete');
    }
  }
  function addPhotos(files) {
    if (!proof || !files || !files.length) return;
    var room = MAX_PHOTOS - proof.images.length;
    var n = 0;
    files.forEach(function (file) {
      if (n >= room || !isImageFile(file)) return;
      n += 1;
      proof.images.push({
        id: TTV.Utils.id(),
        previewUrl: URL.createObjectURL(file),
        file: file
      });
    });
    if (!n) C.toast(t('vendorJob.proof.needImageFile'), 'info');
    paintProof();
  }
  function photoInput() {
    var sheet = document.querySelector('[data-vj-proof]');
    return sheet ? sheet.querySelector('[data-vj-files="photo"]') : null;
  }
  function setVideo(file) {
    if (!proof || !file || !TTV.ui.orderMedia) return;
    TTV.ui.orderMedia.readVideo(file).then(function (item) {
      if (!proof) {
        TTV.ui.orderMedia.revoke(item.previewUrl);
        return;
      }
      if (proof.video) TTV.ui.orderMedia.revoke(proof.video.previewUrl);
      proof.video = item;
      paintProof();
    }).catch(function (err) {
      C.toast((err && err.message) || t('common.error'), 'danger');
    });
  }
  function pickPhotos() {
    if (!proof) return;
    if (proof.images.length >= MAX_PHOTOS) {
      C.toast(t('vendorJob.proof.maxPhotos'), 'info');
      return;
    }
    var el = photoInput();
    if (el) el.click();
  }
  function pickVideo() {
    if (!proof || !TTV.ui.orderMedia) return;
    TTV.ui.orderMedia.pickVideo(setVideo);
  }
  function submitProof(v, reload, btn) {
    if (!canSubmit() || busy) return;
    busy = true;
    btn.disabled = true;
    btn.textContent = t('vendorJob.complete.sending');
    var media = proof.images.map(function (img) {
      return { kind: 'image', file: img.file, role: 'proof' };
    });
    media.push({ kind: 'video', file: proof.video.file, duration: proof.video.duration, role: 'proof' });
    TTV.api.completeVendorJob(v.id, { media: media }).then(function (row) {
      busy = false;
      closeProof();
      C.toast(t('vendorJob.complete.done'), 'success');
      if (typeof reload === 'function') reload(row);
    }).catch(function (err) {
      busy = false;
      btn.textContent = t('vendorJob.complete');
      btn.disabled = !canSubmit();
      C.toast((err && err.message) || t('common.error'), 'danger');
      if (err && (err.code === 'CONFLICT' || err.code === 'FORBIDDEN') && typeof reload === 'function') {
        closeProof();
        reload();
      }
    });
  }
  function openProof(v, reload) {
    if (!TTV.ui.orderMedia) {
      C.toast(t('common.error'), 'danger');
      return;
    }
    closeProof();
    proof = { images: [], video: null };
    var footer = '<div class="vj-proof-footer">' +
      '<button type="button" class="btn btn-secondary" data-sheet-close>' + esc(t('common.cancel')) + '</button>' +
      '<button type="button" class="btn btn-primary" data-vj-proof-go disabled>' + esc(t('vendorJob.complete')) + '</button></div>';
    var host = document.getElementById('app') || document.body;
    host.insertAdjacentHTML('beforeend', C.sheet(t('vendorJob.proof.title'), '<div data-vj-proof-body></div>', { footer: footer }));
    var sheet = host.lastElementChild;
    sheet.setAttribute('data-vj-proof', '');
    sheet.removeAttribute('data-sheet-close');
    sheet.insertAdjacentHTML('beforeend',
      '<input type="file" accept="image/*" multiple data-vj-files="photo" tabindex="-1" aria-hidden="true">');
    var photoEl = sheet.querySelector('[data-vj-files="photo"]');
    if (photoEl) {
      photoEl.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;';
      photoEl.addEventListener('change', function () {
        var files = photoEl.files ? Array.prototype.slice.call(photoEl.files) : [];
        photoEl.value = '';
        addPhotos(files);
      });
    }
    paintProof();
    sheet.addEventListener('click', function (e) {
      e.stopPropagation();
      // Chỉ đóng khi bấm nền hoặc nút × / Hủy — không đóng khi bấm Thêm ảnh/video (backdrop từng có data-sheet-close).
      if (e.target === sheet || e.target.closest('button[data-sheet-close]')) {
        e.preventDefault();
        closeProof();
        return;
      }
      var actBtn = e.target.closest('[data-vj-proof-act]');
      if (actBtn) {
        var act = actBtn.getAttribute('data-vj-proof-act');
        if (act === 'add-photo') pickPhotos();
        else if (act === 'remove-photo') {
          var id = actBtn.getAttribute('data-id');
          proof.images = proof.images.filter(function (img) {
            if (img.id !== id) return true;
            URL.revokeObjectURL(img.previewUrl);
            return false;
          });
          paintProof();
        } else if (act === 'add-video') pickVideo();
        else if (act === 'remove-video') {
          if (proof.video) TTV.ui.orderMedia.revoke(proof.video.previewUrl);
          proof.video = null;
          paintProof();
        } else if (act === 'play-video' && proof.video) {
          TTV.ui.orderMedia.preview(proof.video.previewUrl);
        }
        return;
      }
      var go = e.target.closest('[data-vj-proof-go]');
      if (go) submitProof(v, reload, go);
    });
  }

  function mount(slot, v, reload) {
    if (!isActiveJob(v)) return false;
    var call = telOf(v);
    var primary = '';
    if (v.status === 'matched') {
      primary = '<button type="button" class="btn btn-primary btn-block" data-vj="start">' + esc(t('vendorJob.start')) + '</button>';
    } else if (v.status === 'arriving') {
      primary = '<button type="button" class="btn btn-primary btn-block" data-vj="arrive">' + esc(t('vendorJob.arrive')) + '</button>';
    } else if (v.status === 'working') {
      primary = '<button type="button" class="btn btn-primary btn-block" data-vj="done">' + esc(t('vendorJob.complete')) + '</button>';
    }
    slot.innerHTML =
      '<div class="vj-bar">' +
        primary +
        (call && v.status !== 'completed' ? '<a class="btn btn-secondary btn-block" href="' + esc(call.href) + '">' + esc(t('vendorOrder.customer.call')) + '</a>' : '') +
        (v.status === 'completed' ? '<button type="button" class="btn btn-secondary btn-block" data-route="/vendor/jobs">' + esc(t('vendorJob.viewJobs')) + '</button>' : '') +
      '</div>';
    slot.onclick = function (e) {
      var b = e.target.closest('[data-vj]');
      if (!b) return;
      var act = b.getAttribute('data-vj');
      if (act === 'start') run(b, function () { return TTV.api.startVendorTrip(v.id); }, 'vendorJob.start.done', reload);
      else if (act === 'arrive') run(b, function () { return TTV.api.markVendorWorking(v.id); }, 'vendorJob.arrive.done', reload);
      else if (act === 'done') openProof(v, reload);
    };
    return true;
  }

  window.addEventListener('hashchange', closeProof);

  if (TTV.screens.vendorOrder && TTV.screens.vendorOrder.registerActions) {
    TTV.screens.vendorOrder.registerActions(mount);
  }
})(window.TTV);
