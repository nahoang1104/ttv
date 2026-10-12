/* Ảnh + quay video hiện trạng (getUserMedia, tối đa 2 phút). */
window.TTV = window.TTV || {};
TTV.ui = TTV.ui || {};
(function (TTV) {
  'use strict';
  var LARGE_BYTES = 40 * 1024 * 1024;
  var MAX_SEC = 120;
  var photoInput = null;
  var videoInput = null;
  var onImages = null;
  var onVideo = null;
  var rec = null;

  function ownerId() {
    var s = TTV.auth && TTV.auth.getSession && TTV.auth.getSession();
    return (s && s.account_id) || 'local-demo';
  }
  function toast(msg, kind) {
    if (TTV.Components && TTV.Components.toast) TTV.Components.toast(msg, kind || 'info');
  }
  function maxSec() {
    return (TTV.Upload && TTV.Upload.maxVideoSeconds) || MAX_SEC;
  }
  function makeInput(accept, multiple) {
    var el = document.createElement('input');
    el.type = 'file';
    el.accept = accept;
    el.multiple = !!multiple;
    el.hidden = true;
    document.body.appendChild(el);
    return el;
  }
  function dropInput(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
  function ensurePhotos() {
    if (photoInput) return photoInput;
    photoInput = makeInput('image/*', true);
    photoInput.addEventListener('change', function () {
      var files = photoInput.files ? Array.prototype.slice.call(photoInput.files) : [];
      photoInput.value = '';
      if (onImages) onImages(files);
    });
    return photoInput;
  }
  function ensureVideo() {
    if (videoInput) return videoInput;
    videoInput = makeInput('video/*', false);
    videoInput.addEventListener('change', function () {
      var file = videoInput.files && videoInput.files[0];
      videoInput.value = '';
      if (file && onVideo) onVideo(file);
    });
    return videoInput;
  }
  function formatDuration(sec) {
    var s = Math.max(0, Math.round(Number(sec) || 0));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  }
  function revoke(url) {
    if (url && String(url).indexOf('blob:') === 0) {
      try { URL.revokeObjectURL(url); } catch (_) {}
    }
  }
  function capturePoster(previewUrl) {
    return new Promise(function (resolve) {
      var video = document.createElement('video');
      var done = false;
      function finish(src) {
        if (done) return;
        done = true;
        video.removeAttribute('src');
        video.load();
        resolve(src || '');
      }
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.onloadeddata = function () {
        try {
          var w = video.videoWidth || 160;
          var h = video.videoHeight || 160;
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(video, 0, 0, w, h);
          finish(canvas.toDataURL('image/jpeg', 0.72));
        } catch (_) {
          finish('');
        }
      };
      video.onerror = function () { finish(''); };
      setTimeout(function () { finish(''); }, 4000);
      video.src = previewUrl;
    });
  }
  function uploadLater(file, kind, target) {
    if (!TTV.Upload || !TTV.Upload.upload) return;
    TTV.Upload.upload(file, { kind: kind, ownerId: ownerId() }).then(function (saved) {
      if (target) target.path = saved.path;
    }).catch(function () {});
  }
  function isVideoFile(file) {
    if (!file) return false;
    if (/^video\//.test(file.type || '')) return true;
    return /\.(webm|mp4|mov|m4v)$/i.test(file.name || '');
  }
  function durationOf(file) {
    var hinted = Number(file && file.ttvDuration);
    if (hinted > 0 && hinted <= maxSec() + 0.5) return Promise.resolve(hinted);
    if (TTV.Upload && TTV.Upload.validateVideo && /^video\//.test(file.type || '')) {
      return TTV.Upload.validateVideo(file).then(function (meta) { return meta.duration; });
    }
    return Promise.reject(new Error('Không đọc được thời lượng video.'));
  }
  function readVideo(file) {
    if (!isVideoFile(file)) {
      return Promise.reject(new Error('Vui lòng chọn file video.'));
    }
    if (file.size > LARGE_BYTES) {
      toast('Video khá nặng — vẫn dùng được, nhưng tải có thể chậm.', 'info');
    }
    return durationOf(file).then(function (duration) {
      if (duration > maxSec() + 0.05) return Promise.reject(new Error('Video không được dài quá 2 phút.'));
      var previewUrl = URL.createObjectURL(file);
      return capturePoster(previewUrl).then(function (poster) {
        var item = {
          previewUrl: previewUrl,
          poster: poster,
          path: '',
          duration: duration,
          file: file
        };
        uploadLater(file, 'order-videos', item);
        return item;
      });
    });
  }

  function mimeType() {
    var types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    if (!window.MediaRecorder) return '';
    for (var i = 0; i < types.length; i++) {
      if (MediaRecorder.isTypeSupported(types[i])) return types[i];
    }
    return '';
  }
  function stopStream(stream) {
    if (!stream) return;
    stream.getTracks().forEach(function (t) {
      try { t.stop(); } catch (_) {}
    });
  }
  function cleanupOverlay() {
    if (!rec) return;
    if (rec.tick) clearInterval(rec.tick);
    if (rec.limit) clearTimeout(rec.limit);
    stopStream(rec.stream);
    if (rec.reviewUrl) revoke(rec.reviewUrl);
    if (rec.live) {
      rec.live.srcObject = null;
      rec.live.removeAttribute('src');
      rec.live.load();
    }
    if (rec.overlay && rec.overlay.parentNode) rec.overlay.parentNode.removeChild(rec.overlay);
    rec = null;
  }
  function closeRecorder(save) {
    if (!rec) return;
    rec.intent = save ? 'save' : 'cancel';
    if (rec.recorder && rec.recorder.state === 'recording') {
      try { rec.recorder.stop(); } catch (_) { cleanupOverlay(); }
      return;
    }
    cleanupOverlay();
  }
  function elapsedSec() {
    if (!rec || !rec.startedAt) return 0;
    return (Date.now() - rec.startedAt) / 1000;
  }
  function paintTimer() {
    if (!rec || !rec.timeEl) return;
    rec.timeEl.textContent = formatDuration(elapsedSec()) + ' / ' + formatDuration(maxSec());
  }
  function finishRecording() {
    if (!rec || rec.closing) return;
    rec.closing = true;
    closeRecorder(true);
  }
  function openCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error('Trình duyệt không hỗ trợ camera.'));
    }
    var tryAudio = { audio: true, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } };
    return navigator.mediaDevices.getUserMedia(tryAudio).catch(function () {
      return navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' } } });
    });
  }
  function setMode(mode) {
    if (!rec) return;
    rec.overlay.classList.remove('is-live', 'is-recording', 'is-review');
    rec.overlay.classList.add('is-' + mode);
    if (rec.shutter) {
      rec.shutter.setAttribute('data-rec', mode === 'recording' ? 'stop' : 'start');
      rec.shutter.setAttribute('aria-label', mode === 'recording' ? 'Dừng quay' : 'Bắt đầu quay');
    }
  }
  function attachLive(stream) {
    rec.stream = stream;
    rec.live.controls = false;
    rec.live.muted = true;
    rec.live.srcObject = stream;
    rec.live.removeAttribute('src');
    rec.live.play().catch(function () {});
    setMode('live');
    if (rec.statusEl) rec.statusEl.textContent = 'Bấm nút đỏ để quay — tối đa 2 phút';
    if (rec.timeEl) rec.timeEl.textContent = '00:00 / ' + formatDuration(maxSec());
  }
  function showReview(file) {
    rec.file = file;
    rec.reviewUrl = URL.createObjectURL(file);
    rec.closing = false;
    rec.recorder = null;
    if (rec.tick) { clearInterval(rec.tick); rec.tick = null; }
    if (rec.limit) { clearTimeout(rec.limit); rec.limit = null; }
    stopStream(rec.stream);
    rec.stream = null;
    rec.live.srcObject = null;
    rec.live.muted = false;
    rec.live.controls = true;
    rec.live.src = rec.reviewUrl;
    rec.live.play().catch(function () {});
    setMode('review');
    if (rec.statusEl) rec.statusEl.textContent = 'Xem lại video';
    if (rec.timeEl) rec.timeEl.textContent = formatDuration(file.ttvDuration) + ' / ' + formatDuration(maxSec());
  }
  function retake() {
    if (!rec) return;
    if (rec.reviewUrl) revoke(rec.reviewUrl);
    rec.reviewUrl = null;
    rec.file = null;
    rec.chunks = [];
    rec.closing = false;
    rec.startedAt = 0;
    rec.live.controls = false;
    rec.live.removeAttribute('src');
    rec.live.load();
    setMode('live');
    if (rec.statusEl) rec.statusEl.textContent = 'Đang mở camera…';
    openCamera().then(function (stream) {
      if (!rec) { stopStream(stream); return; }
      attachLive(stream);
    }).catch(function () {
      toast('Không mở được camera.', 'danger');
    });
  }
  function useTake() {
    if (!rec || !rec.file) return;
    var file = rec.file;
    rec.file = null;
    cleanupOverlay();
    if (onVideo) onVideo(file);
  }
  function startRecording() {
    if (!rec || !rec.stream || rec.recorder) return;
    var type = mimeType();
    var opts = type ? { mimeType: type } : {};
    rec.chunks = [];
    rec.recorder = new MediaRecorder(rec.stream, opts);
    rec.recorder.ondataavailable = function (e) {
      if (e.data && e.data.size) rec.chunks.push(e.data);
    };
    rec.recorder.onerror = function () {
      toast('Không ghi được video.', 'danger');
      closeRecorder(false);
    };
    rec.recorder.onstop = function () {
      var intent = rec && rec.intent;
      var chunks = (rec && rec.chunks) || [];
      var typeNow = (rec && rec.recorder && rec.recorder.mimeType) || type || 'video/webm';
      var seconds = elapsedSec();
      if (!rec) return;
      if (intent !== 'save') {
        cleanupOverlay();
        return;
      }
      if (!chunks.length) {
        toast('Chưa ghi được hình. Thử lại.', 'danger');
        retake();
        return;
      }
      var mime = (typeNow.split(';')[0] || 'video/webm');
      var ext = mime.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
      var blob = new Blob(chunks, { type: mime });
      var file = new File([blob], 'hien-trang-' + Date.now() + '.' + ext, { type: mime });
      file.ttvDuration = seconds;
      showReview(file);
    };
    rec.startedAt = Date.now();
    rec.closing = false;
    rec.recorder.start(250);
    rec.tick = setInterval(paintTimer, 200);
    paintTimer();
    rec.limit = setTimeout(finishRecording, maxSec() * 1000);
    if (rec.statusEl) rec.statusEl.textContent = 'Đang quay — tối đa 2 phút';
    setMode('recording');
  }
  function overlayHost() {
    return document.getElementById('app') || document.body;
  }
  function mountOverlay() {
    closeRecorder(false);
    var overlay = document.createElement('div');
    overlay.className = 'rec-overlay';
    overlay.innerHTML =
      '<video class="rec-overlay__live" autoplay muted playsinline></video>' +
      '<button type="button" class="rec-overlay__close" data-rec="cancel" aria-label="Đóng">×</button>' +
      '<div class="rec-overlay__review">' +
        '<button type="button" class="rec-overlay__ghost" data-rec="retake">Quay lại</button>' +
        '<button type="button" class="rec-overlay__use" data-rec="use">Dùng video này</button>' +
      '</div>' +
      '<div class="rec-overlay__top"><span class="rec-overlay__dot"></span><span class="rec-overlay__time">00:00 / 02:00</span></div>' +
      '<div class="rec-overlay__bar">' +
        '<p class="rec-overlay__status">Đang mở camera…</p>' +
        '<button type="button" class="rec-overlay__stop" data-rec="start" aria-label="Bắt đầu quay"></button>' +
        '<button type="button" class="rec-overlay__file" data-rec="file">Chọn file có sẵn</button>' +
      '</div>';
    overlayHost().appendChild(overlay);
    rec = {
      overlay: overlay,
      live: overlay.querySelector('.rec-overlay__live'),
      shutter: overlay.querySelector('.rec-overlay__stop'),
      timeEl: overlay.querySelector('.rec-overlay__time'),
      statusEl: overlay.querySelector('.rec-overlay__status'),
      stream: null,
      recorder: null,
      chunks: [],
      startedAt: 0,
      tick: null,
      limit: null,
      closing: false,
      intent: 'cancel',
      file: null,
      reviewUrl: null
    };
    overlay.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-rec]');
      if (!btn) return;
      var act = btn.getAttribute('data-rec');
      if (act === 'cancel') closeRecorder(false);
      if (act === 'start') startRecording();
      if (act === 'stop') finishRecording();
      if (act === 'retake') retake();
      if (act === 'use') useTake();
      if (act === 'file') {
        closeRecorder(false);
        ensureVideo().click();
      }
    });
  }
  function recordNow() {
    if (!window.MediaRecorder) {
      toast('Trình duyệt không quay được video. Hãy chọn file.', 'info');
      ensureVideo().click();
      return;
    }
    mountOverlay();
    openCamera().then(function (stream) {
      if (!rec) {
        stopStream(stream);
        return;
      }
      attachLive(stream);
    }).catch(function () {
      closeRecorder(false);
      toast('Không mở được camera. Hãy cho phép camera hoặc chọn file.', 'danger');
      ensureVideo().click();
    });
  }

  TTV.ui.orderMedia = {
    formatDuration: formatDuration,
    revoke: revoke,
    pickImages: function (cb) {
      onImages = cb;
      ensurePhotos().click();
    },
    pickVideo: function (cb) {
      onVideo = cb;
      recordNow();
    },
    preview: function (url) {
      if (!url) return;
      closeRecorder(false);
      var overlay = document.createElement('div');
      overlay.className = 'rec-overlay is-review';
      overlay.innerHTML =
        '<video class="rec-overlay__live" controls autoplay playsinline></video>' +
        '<button type="button" class="rec-overlay__close" data-rec="cancel" aria-label="Đóng">×</button>' +
        '<div class="rec-overlay__bar"><p class="rec-overlay__status">Xem lại video</p></div>';
      overlayHost().appendChild(overlay);
      var live = overlay.querySelector('.rec-overlay__live');
      live.src = url;
      rec = { overlay: overlay, live: live, stream: null, recorder: null, tick: null, limit: null, reviewUrl: null };
      overlay.addEventListener('click', function (e) {
        if (e.target.closest('[data-rec="cancel"]')) closeRecorder(false);
      });
    },
    readVideo: readVideo,
    uploadImage: function (file) {
      if (!TTV.Upload || !TTV.Upload.upload) return Promise.resolve(null);
      return TTV.Upload.upload(file, { kind: 'order-images', ownerId: ownerId() });
    },
    ownerId: ownerId,
    destroy: function () {
      closeRecorder(false);
      dropInput(photoInput);
      dropInput(videoInput);
      photoInput = null;
      videoInput = null;
      onImages = null;
      onVideo = null;
    }
  };
})(window.TTV);
