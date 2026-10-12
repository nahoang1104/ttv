/* upload.js — lưu file vào thư mục uploads đã chọn qua File System Access API. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var HANDLE_DB = 'tingtingvac_upload_handles';
  var HANDLE_STORE = 'handles';
  var ROOT_KEY = 'uploadsRoot';
  var MAX_VIDEO_SECONDS = 120;

  function openHandleDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(HANDLE_DB, 1);
      req.onupgradeneeded = function () { if (!req.result.objectStoreNames.contains(HANDLE_STORE)) req.result.createObjectStore(HANDLE_STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('Không mở được kho lưu thư mục upload.')); };
    });
  }
  function saveHandle(handle) {
    return openHandleDb().then(function (db) { return new Promise(function (resolve, reject) {
      var tx = db.transaction(HANDLE_STORE, 'readwrite'); tx.objectStore(HANDLE_STORE).put(handle, ROOT_KEY);
      tx.oncomplete = function () { db.close(); resolve(handle); }; tx.onerror = function () { db.close(); reject(tx.error); };
    }); });
  }
  function loadHandle() {
    return openHandleDb().then(function (db) { return new Promise(function (resolve, reject) {
      var req = db.transaction(HANDLE_STORE, 'readonly').objectStore(HANDLE_STORE).get(ROOT_KEY);
      req.onsuccess = function () { db.close(); resolve(req.result || null); }; req.onerror = function () { db.close(); reject(req.error); };
    }); });
  }
  function permission(handle, ask) {
    var opts = { mode: 'readwrite' };
    return handle.queryPermission(opts).then(function (state) {
      if (state === 'granted') return true;
      if (!ask) return false;
      return handle.requestPermission(opts).then(function (next) { return next === 'granted'; });
    });
  }
  function chooseDirectory() {
    if (!window.showDirectoryPicker) return Promise.reject(new Error('Trình duyệt không hỗ trợ chọn thư mục. Hãy dùng Chrome/Edge qua localhost hoặc HTTPS.'));
    return window.showDirectoryPicker({ id: 'ttv-uploads', mode: 'readwrite' }).then(function (handle) {
      return permission(handle, true).then(function (granted) {
        if (!granted) throw new Error('Chưa được cấp quyền ghi thư mục.');
        var uploadsPromise = handle.name.toLowerCase() === 'uploads'
          ? Promise.resolve(handle)
          : handle.getDirectoryHandle('uploads', { create: true });
        return uploadsPromise.then(function (uploadsDir) {
          // Lưu trực tiếp handle của thư mục uploads. Nếu người dùng chọn chính thư mục
          // uploads thì không tạo nhầm uploads/uploads.
          return saveHandle(uploadsDir).then(function () {
            return { name: handle.name, path: 'uploads/', handle: uploadsDir, uploadsHandle: uploadsDir };
          });
        });
      });
    });
  }
  function getUploadsDirectory(ask) {
    return loadHandle().then(function (handle) {
      if (!handle) {
        if (ask) return chooseDirectory().then(function (x) { return x.uploadsHandle; });
        throw new Error('Chưa chọn thư mục lưu file. Hãy gọi TTV.Upload.chooseDirectory() trước.');
      }
      return permission(handle, !!ask).then(function (granted) {
        if (!granted) throw new Error('Chưa có quyền truy cập thư mục uploads. Hãy bấm “Chọn thư mục uploads” và cấp quyền lại.');
        return handle;
      });
    });
  }
  function safeSegment(value) { return String(value || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'anonymous'; }
  function extension(file) { var n = (file.name || '').toLowerCase(); var m = n.match(/\.([a-z0-9]{1,8})$/); return m ? m[1] : ''; }
  function randomId() { return (TTV.Utils && TTV.Utils.id ? TTV.Utils.id() : (Date.now().toString(16) + Math.random().toString(16).slice(2))).replace(/[^a-z0-9]/gi, '').slice(0, 32); }
  // Không nén/chuyển đổi ảnh: lưu nguyên byte, định dạng và phần mở rộng của file gốc.
  function imageToBlob(file) {
    if (!file || !/^image\//.test(file.type)) return Promise.reject(new Error('File không phải ảnh.'));
    return Promise.resolve(file);
  }
  function validateVideo(file) {
    if (!file || !/^video\//.test(file.type)) return Promise.reject(new Error('Vui lòng chọn file video.'));
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), video = document.createElement('video'), settled = false;
      function done(err) { if (settled) return; settled = true; URL.revokeObjectURL(url); video.removeAttribute('src'); if (err) reject(err); else resolve({ valid: true, duration: video.duration, file: file }); }
      video.preload = 'metadata'; video.onloadedmetadata = function () { if (!Number.isFinite(video.duration)) return done(new Error('Không đọc được thời lượng video.')); if (video.duration > MAX_VIDEO_SECONDS + 0.05) return done(new Error('Video không được dài quá 2 phút.')); done(); };
      video.onerror = function () { done(new Error('Không đọc được video đã chọn.')); }; video.src = url;
    });
  }
  function writeFile(file, opts) {
    opts = opts || {};
    if (!file || typeof file.name !== 'string') return Promise.reject(new TypeError('File không hợp lệ.'));
    var kind = opts.kind || (/^video\//.test(file.type) ? 'order-videos' : 'order-images');
    var allowed = ['avatar', 'order-images', 'order-videos', 'vendor-docs', 'banners'];
    if (allowed.indexOf(kind) < 0) return Promise.reject(new Error('Loại file không hợp lệ.'));
    var isVideo = /^video\//.test(file.type);
    var videoDuration = null;
    var prepared = isVideo ? validateVideo(file).then(function (meta) { videoDuration = meta.duration; return file; }) : (/^image\//.test(file.type) ? imageToBlob(file) : Promise.resolve(file));
    return prepared.then(function (blob) { return getUploadsDirectory(true).then(function (uploadsDir) {
      var owner = safeSegment(opts.ownerId || 'anonymous'), folderPath = owner + '/' + kind;
      return uploadsDir.getDirectoryHandle(owner, { create: true }).then(function (ownerDir) {
        return ownerDir.getDirectoryHandle(kind, { create: true }).then(function (dir) {
          var ext = extension(file) || (isVideo ? 'mp4' : 'bin');
          var filename = randomId() + '.' + ext;
          return dir.getFileHandle(filename, { create: true }).then(function (fileHandle) {
            return fileHandle.createWritable().then(function (writable) { return writable.write(blob).then(function () { return writable.close(); }).then(function () {
              return { path: 'uploads/' + folderPath + '/' + filename, name: filename, type: file.type, size: file.size, kind: kind, duration: isVideo ? videoDuration : null };
            }); });
          });
        });
      });
    }); });
  }
  TTV.Upload = {
    chooseDirectory: chooseDirectory,
    getDirectory: function (requestPermission) { return getUploadsDirectory(requestPermission !== false); },
    hasDirectory: function () { return loadHandle().then(function (h) { return !!h; }); },
    validateVideo: validateVideo,
    upload: writeFile,
    maxVideoSeconds: MAX_VIDEO_SECONDS
  };
})(window.TTV);
