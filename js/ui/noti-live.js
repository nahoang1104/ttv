/* Bus live: ping ngay + BroadcastChannel (tab khác) + poll 4s khi tab hiện (8s, chỉ thông báo, khi tab bị ẩn; nhịp đếm chạy trong Web Worker
   để trình duyệt không bóp timer của tab nền). Tab nền: chuông + thông báo hệ thống (Notification API) + số chưa đọc trên tiêu đề tab.
   Thông báo: poll CHỈ hỏi "có gì mới không" (đọc mốc nhỏ noti_marks); mốc đổi mới tải danh sách. Xem refresh() bên dưới. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var CHANNEL = 'ttv_live';
  var POLL_MS = 4000;
  var bc = null;
  var timer = null;
  var worker = null;
  var tickN = 0;
  var groups = {};
  var uid = 0;

  function openBc() {
    if (bc || typeof BroadcastChannel === 'undefined') return;
    try {
      bc = new BroadcastChannel(CHANNEL);
      bc.onmessage = function (ev) {
        if (ev && ev.data && ev.data.type === 'ping') fire(ev.data.topic || '*');
      };
    } catch (_) { bc = null; }
  }
  function hasSubs() {
    return Object.keys(groups).some(function (k) { return groups[k].length; });
  }
  function bustHotTables(topic) {
    if (!TTV.Store || typeof TTV.Store.invalidate !== 'function') return;
    if (topic === 'orders' || topic === '*') TTV.Store.invalidate(['orders', 'quotes', 'order_media']);
    if (topic === 'noti' || topic === '*') TTV.Store.invalidate(['notifications', 'noti_marks']);
  }
  function fire(topic, fromPoll, only) {
    // Ping (hành động của chính mình) xóa cache để đọc mới ngay. Poll KHÔNG xóa cache: thông báo mới được phát hiện qua mốc noti_marks.
    if (!fromPoll) bustHotTables(topic);
    var seen = {};
    function run(t) {
      (groups[t] || []).forEach(function (w) {
        if (seen[w.id]) return;
        seen[w.id] = true;
        try { w.cb(!!fromPoll); } catch (_) {}
      });
    }
    if (topic === '*') Object.keys(groups).forEach(run);
    else { run(topic); if (!only) run('*'); }
  }
  // Mỗi nhịp: tab đang hiện → làm mới mọi thứ (4s); tab bị ẩn → chỉ hỏi thông báo, 8s một lần (đơn/báo giá tự làm mới khi quay lại tab).
  function onTick() {
    tickN += 1;
    if (!document.hidden) { fire('*', true); return; }
    if (tickN % 2) return;
    fire('noti', true, true);
  }
  function startTimer() {
    if ((timer || worker) || !hasSubs()) return;
    // Timer trong Web Worker không bị Chrome/Edge giãn nhịp (tới 1 phút/lần) khi tab nền như timer của trang.
    try {
      var url = URL.createObjectURL(new Blob(['setInterval(function(){postMessage(0)},' + POLL_MS + ')'], { type: 'text/javascript' }));
      worker = new Worker(url);
      worker.onmessage = onTick;
      worker.onerror = function () {
        if (worker) { try { worker.terminate(); } catch (_) {} worker = null; }
        if (!timer && hasSubs()) timer = setInterval(onTick, POLL_MS);
      };
      setTimeout(function () { URL.revokeObjectURL(url); }, 0);
    } catch (_) {
      worker = null;
      timer = setInterval(onTick, POLL_MS);
    }
  }
  function stopTimerIfEmpty() {
    if (hasSubs()) return;
    if (worker) { try { worker.terminate(); } catch (_) {} worker = null; }
    if (timer) { clearInterval(timer); timer = null; }
  }

  TTV.Live = {
    ping: function (topic) {
      topic = topic || '*';
      fire(topic);
      if (bc) {
        try { bc.postMessage({ type: 'ping', topic: topic, at: Date.now() }); } catch (_) {}
      }
    },
    watch: function (topic, cb, opts) {
      if (typeof cb !== 'function') return function () {};
      openBc();
      topic = topic || '*';
      var w = { id: ++uid, cb: cb };
      if (!groups[topic]) groups[topic] = [];
      groups[topic].push(w);
      startTimer();
      if (!opts || opts.immediate !== false) {
        try { cb(); } catch (_) {}
      }
      return function stop() {
        groups[topic] = (groups[topic] || []).filter(function (x) { return x.id !== w.id; });
        stopTimerIfEmpty();
      };
    }
  };
  document.addEventListener('visibilitychange', function () {
    paintTitle(lastUnread < 0 ? 0 : lastUnread);
    if (!document.hidden) fire('*');
  });

  var lastKey = '';
  var lastUnread = -1;
  var lastSig = '';
  var lastStamp = null;       // mốc hộp thư lần tải đầy đủ gần nhất
  var lastFullAt = 0;         // giờ tải đầy đủ gần nhất
  var SAFETY_MS = 60000;      // dù mốc không đổi, vẫn tải đầy đủ mỗi 60 giây phòng ghi mốc hỏng
  var lastUnreadIds = {};
  var cached = [];
  var fetched = false;
  var heldRead = {};
  var holdUntil = 0;
  var badgeCbs = [];
  var listCbs = [];
  var busy = false;
  var queued = false;
  var stopNoti = null;
  var audio = null;
  var soundReady = false;
  var soundEnabled = true;

  /* ----- Tab nền: số chưa đọc trên tiêu đề + thông báo hệ thống ----- */
  function paintTitle(unread) {
    var base = String(document.title || '').replace(/^\(\d+\) /, '');
    document.title = document.hidden && unread > 0 ? '(' + unread + ') ' + base : base;
  }
  function canSystemNotify() {
    return typeof Notification !== 'undefined' && Notification.permission === 'granted';
  }
  function openNotiTarget(row) {
    try { window.focus(); } catch (_) {}
    var href = TTV.api && TTV.api.notificationHref ? TTV.api.notificationHref(row) : '';
    if (href && TTV.Router && TTV.Router.navigate) TTV.Router.navigate(href);
  }
  function systemNotify(rows) {
    if (!canSystemNotify() || !document.hidden || !rows.length) return;
    var shown = rows.length > 3 ? [{ id: 'many', title: 'Bạn có ' + rows.length + ' thông báo mới', body: '', _many: true }] : rows;
    shown.forEach(function (r) {
      try {
        var n = new Notification(r.title || 'TingTingVac', { body: r.body || '', tag: 'ttv-' + r.id });
        n.onclick = function () { n.close(); if (r._many) { try { window.focus(); } catch (_) {} } else openNotiTarget(r); };
      } catch (_) {}
    });
  }
  // Xin quyền thông báo hệ thống đúng 1 lần, ở thao tác chạm đầu tiên sau khi đăng nhập (trình duyệt yêu cầu có thao tác người dùng).
  function maybeAskPermission() {
    try {
      if (typeof Notification === 'undefined' || Notification.permission !== 'default' || !sessionKey()) return;
      if (localStorage.getItem('ttv_noti_perm_asked')) return;
      localStorage.setItem('ttv_noti_perm_asked', '1');
      Notification.requestPermission();
    } catch (_) {}
  }
  document.addEventListener('pointerdown', maybeAskPermission, true);

  function ensureNotiWatch() {
    if (!stopNoti && sessionKey()) stopNoti = TTV.Live.watch('noti', refresh, { immediate: false });
  }
  function unlockSound() {
    if (soundReady) return;
    soundReady = true;
    if (!audio) {
      audio = new Audio('uploads/seed/noti.wav?v=2');
      audio.preload = 'auto';
      audio.volume = 0;
    }
    var p = audio.play();
    if (p && p.then) p.then(function () {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0.55;
    }).catch(function () { audio.volume = 0.55; });
    ensureNotiWatch();
    loadSoundPref();
  }
  function loadSoundPref() {
    if (!TTV.api || typeof TTV.api.getNotificationSettings !== 'function') return;
    TTV.api.getNotificationSettings().then(function (st) {
      soundEnabled = !st || st.sound_vibrate !== false;
    }).catch(function () {});
  }
  function playNotiSound() {
    if (!soundEnabled || !soundReady || !audio) return;
    try {
      audio.currentTime = 0;
      var p = audio.play();
      if (p && p.catch) p.catch(function () {});
    } catch (_) {}
  }
  document.addEventListener('pointerdown', unlockSound, true);
  document.addEventListener('keydown', unlockSound, true);

  function sessionKey() {
    try {
      var s = JSON.parse(sessionStorage.getItem('ttv_session') || 'null');
      return s && s.account_id ? String(s.account_type || '') + ':' + s.account_id : '';
    } catch (_) { return ''; }
  }
  function listSig(rows) {
    return (rows || []).map(function (r) {
      return r.id + ':' + (r.is_read ? '1' : '0') + ':' + String(r.created_at || '');
    }).join('|');
  }
  // Hỏi "có gì mới không": đọc mốc nhỏ của riêng mình. full=true khi cần tải danh sách.
  function checkStamp() {
    var stale = function () { return Date.now() - lastFullAt >= SAFETY_MS; };
    if (!TTV.api || typeof TTV.api.getNotiStamp !== 'function') return Promise.resolve({ full: true, stamp: null });
    return TTV.api.getNotiStamp().then(function (stamp) {
      return { full: stamp !== lastStamp || stale(), stamp: stamp };
    }).catch(function () { return { full: stale(), stamp: lastStamp }; });
  }
  function refresh(fromPoll) {
    if (!sessionKey()) return Promise.resolve();
    if (!badgeCbs.length && !listCbs.length && !soundReady) return Promise.resolve();
    if (busy) { queued = true; return Promise.resolve(); }
    if (!TTV.api || typeof TTV.api.listMyNotifications !== 'function') return Promise.resolve();
    busy = true;
    var ping = !fromPoll;
    return checkStamp().then(function (c) {
      // Ping / lần đầu / đổi tài khoản: luôn tải đầy đủ. Poll: chỉ tải khi mốc đổi.
      if (ping || !fetched || sessionKey() !== lastKey) c.full = true;
      if (!c.full) return null;
      return TTV.api.listMyNotifications(ping ? { force: true } : undefined).then(function (rows) {
        lastStamp = c.stamp; lastFullAt = Date.now();
        return rows || [];
      });
    }).then(function (rows) {
      busy = false;
      if (rows) apply(rows);
      if (queued) { queued = false; return refresh(fromPoll); }
    }).catch(function () {
      busy = false;
      if (queued) { queued = false; return refresh(fromPoll); }
    });
  }
  function apply(rows) {
    var key = sessionKey();
    if (Date.now() < holdUntil) {
      rows.forEach(function (r) { if (heldRead[r.id]) r.is_read = true; });
    } else heldRead = {};
    var unread = 0;
    var unreadIds = {};
    rows.forEach(function (r) {
      if (!r.is_read) { unread += 1; unreadIds[r.id] = true; }
    });
    if (unread === 0) { holdUntil = 0; heldRead = {}; }
    var sig = listSig(rows);
    var arrivedRows = fetched && key === lastKey ? rows.filter(function (r) { return r && unreadIds[r.id] && !lastUnreadIds[r.id]; }) : [];
    var arrived = arrivedRows.length > 0;
    var changed = !fetched || key !== lastKey || unread !== lastUnread || sig !== lastSig;
    lastKey = key;
    lastUnread = unread;
    lastSig = sig;
    lastUnreadIds = unreadIds;
    if (arrived) {
      playNotiSound();
      systemNotify(arrivedRows);
      arrivedRows.forEach(function (r) {
        if (!TTV.Components || !TTV.Components.toast) return;
        if (r.event === 'quote.accepted') TTV.Components.toast(r.title || 'Khách đã chọn bạn', 'success');
        else if (r.event === 'quote.rejected') TTV.Components.toast(r.title || 'Đơn đã được ghép với thợ khác', 'info');
        else if (r.event === 'order.new') TTV.Components.toast(r.title || 'Có đơn mới', 'info');
      });
    }
    cached = rows;
    fetched = true;
    paintTitle(unread);
    if (changed) {
      badgeCbs.slice().forEach(function (cb) { try { cb(unread); } catch (_) {} });
      listCbs.slice().forEach(function (cb) { try { cb(rows); } catch (_) {} });
    }
  }
  function addWatch(list, cb, kind) {
    if (typeof cb !== 'function') return function () {};
    list.push(cb);
    if (!stopNoti) stopNoti = TTV.Live.watch('noti', refresh, { immediate: true });
    if (fetched) {
      try {
        if (kind === 'badge') cb(lastUnread);
        else cb(cached.slice());
      } catch (_) {}
    }
    return function stop() {
      var i = list.indexOf(cb);
      if (i >= 0) list.splice(i, 1);
      if (!badgeCbs.length && !listCbs.length && stopNoti && !soundReady) {
        stopNoti();
        stopNoti = null;
      }
    };
  }
  function publishLocal() {
    var unread = 0;
    var unreadIds = {};
    cached.forEach(function (r) {
      if (!r.is_read) { unread += 1; unreadIds[r.id] = true; }
    });
    lastUnread = unread;
    lastUnreadIds = unreadIds;
    lastSig = listSig(cached);
    badgeCbs.slice().forEach(function (cb) { try { cb(unread); } catch (_) {} });
    listCbs.slice().forEach(function (cb) { try { cb(cached.slice()); } catch (_) {} });
  }

  TTV.NotiLive = {
    unread: function () { return lastUnread < 0 ? 0 : lastUnread; },
    setSoundEnabled: function (on) { soundEnabled = on !== false; },
    markReadLocal: function (id) {
      id = String(id || '');
      if (!id) return;
      heldRead[id] = true;
      holdUntil = Date.now() + 10000;
      cached.forEach(function (r) { if (String(r.id) === id) r.is_read = true; });
      publishLocal();
    },
    markAllReadLocal: function () {
      holdUntil = Date.now() + 10000;
      cached.forEach(function (r) {
        r.is_read = true;
        heldRead[r.id] = true;
      });
      publishLocal();
    },
    watchBadge: function (cb) { return addWatch(badgeCbs, cb, 'badge'); },
    watchList: function (cb) { return addWatch(listCbs, cb, 'list'); }
  };
})(window.TTV);
