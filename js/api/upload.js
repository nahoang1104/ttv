/* Gửi file lên upload.php → uploads/{ownerId}/{kind}/{tên-ngẫu-nhiên}.{ext} */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var MAX_VIDEO_SECONDS = 120;
  var KINDS = ['avatar', 'order-images', 'order-videos', 'banners', 'coupon-images'];

  function looksLikeVideo(file) {
    if (!file) return false;
    if (/^video\//i.test(file.type || '')) return true;
    return /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(file.name || '');
  }
  function extension(file) {
    var n = (file.name || '').toLowerCase();
    var m = n.match(/\.([a-z0-9]{1,8})$/);
    return m ? m[1] : '';
  }
  function readDuration(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var video = document.createElement('video');
      var settled = false;
      var timer = setTimeout(function () { done(new Error('Không đọc được thời lượng video.')); }, 8000);
      function done(err, duration) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { URL.revokeObjectURL(url); } catch (_) {}
        video.removeAttribute('src');
        video.load();
        if (err) reject(err);
        else resolve(duration);
      }
      function check() {
        var d = video.duration;
        if (d === Infinity) {
          try { video.currentTime = 1e10; } catch (_) {}
          return;
        }
        if (Number.isFinite(d) && d > 0) done(null, d);
      }
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.onloadedmetadata = check;
      video.ondurationchange = check;
      video.onseeked = check;
      video.onerror = function () { done(new Error('Không đọc được video đã chọn.')); };
      video.src = url;
    });
  }
  function validateVideo(file) {
    if (!looksLikeVideo(file)) return Promise.reject(new Error('Vui lòng chọn file video.'));
    var hinted = Number(file && file.ttvDuration);
    return readDuration(file).catch(function (err) {
      if (hinted > 0 && hinted <= MAX_VIDEO_SECONDS + 0.5) return hinted;
      throw err;
    }).then(function (duration) {
      if (duration > MAX_VIDEO_SECONDS + 0.05) return Promise.reject(new Error('Video không được dài quá 2 phút.'));
      return { valid: true, duration: duration, file: file };
    });
  }
  function writeFile(file, opts) {
    opts = opts || {};
    if (!file || typeof file.name !== 'string') return Promise.reject(new TypeError('File không hợp lệ.'));
    var isVideo = looksLikeVideo(file) && !/^image\//.test(file.type || '');
    var kind = opts.kind || (isVideo ? 'order-videos' : 'order-images');
    if (KINDS.indexOf(kind) < 0) return Promise.reject(new Error('Loại file không hợp lệ.'));
    var videoDuration = null;
    var prepared = isVideo
      ? validateVideo(file).then(function (meta) { videoDuration = meta.duration; return file; })
      : Promise.resolve(file);
    return prepared.then(function (blob) {
      var fd = new FormData();
      fd.append('file', blob, file.name || ('file.' + (extension(file) || 'bin')));
      fd.append('ownerId', opts.ownerId || 'anonymous');
      fd.append('kind', kind);
      return fetch('upload.php', { method: 'POST', body: fd }).then(function (res) {
        return res.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (_) {}
          if (!res.ok || !data || !data.path) {
            throw new Error((data && data.error) || 'Không lưu được file lên máy chủ.');
          }
          return {
            path: data.path,
            name: data.name,
            type: data.type || file.type,
            size: Number(data.size) || file.size,
            kind: kind,
            duration: isVideo ? videoDuration : null
          };
        });
      });
    });
  }
  TTV.Upload = {
    validateVideo: validateVideo,
    upload: writeFile,
    maxVideoSeconds: MAX_VIDEO_SECONDS
  };
})(window.TTV);
