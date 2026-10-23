/* Bus live: ping ngay + BroadcastChannel (tab khác) + poll 4s khi tab hiện (8s, chỉ thông báo, khi tab bị ẩn; nhịp đếm chạy trong Web Worker
   để trình duyệt không bóp timer của tab nền). Tab nền: chuông + thông báo hệ thống (Notification API) + số chưa đọc trên tiêu đề tab.
   Thông báo: poll CHỈ hỏi "có gì mới không" (đọc mốc nhỏ noti_marks); mốc đổi mới tải danh sách. Xem refresh() bên dưới. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var CHANNEL = 'ttv_live';
  var POLL_MS = 4000;
  var POLL_MAX_MS = 32000;
  var bc = null;
  var timer = null;
  var worker = null;
  var tickN = 0;
  var groups = {};
  var uid = 0;
  var pollDelay = POLL_MS;
  var nextTickAt = 0;
  var isNotiLeader = true;
  var leaderTried = false;

  function openBc() {
    if (bc || typeof BroadcastChannel === 'undefined') return;
    try {
      bc = new BroadcastChannel(CHANNEL);
      bc.onmessage = function (ev) {
        var data = ev && ev.data;
        if (!data) return;
        if (data.type === 'ping') fire(data.topic || '*');
        else if (data.type === 'noti-sync') applyRemote(data);
        else if (data.type === 'noti-ask' && isNotiLeader && fetched) broadcastNoti();
      };
    } catch (_) { bc = null; }
  }
  function hasSubs() {
    return Object.keys(groups).some(function (k) { return groups[k].length; });
  }
  function fire(topic, fromPoll, only) {
    // Không invalidate bảng nặng lúc ping: ghi đã xóa cache bảng vừa ghi; poll/tab khác đọc mốc (noti_marks / orders_stamp / coupons_stamp) rồi delta.
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
  function livePath() {
    return String(location.hash || '').replace(/^#/, '').split('?')[0];
  }
  // Đang chờ báo giá: hỏi mốc đơn mỗi 4s. Còn lại 8s. Promo 8s (ping vẫn tức thì).
  function ordersEvery() {
    return /^\/orders\/[^/]+\/quotes\/?$/.test(livePath()) ? 1 : 2;
  }
  // Tab hiện: chuông 4s (chỉ mốc noti_marks). Đơn/báo giá 8s — bảng orders/quotes nặng hơn nhiều.
  // Tab ẩn: chỉ chuông, 8s; đơn tự làm mới khi quay lại tab.
  function onTick() {
    if (Date.now() < nextTickAt) return;
    tickN += 1;
    if (document.hidden) {
      if (isNotiLeader && tickN % 2 === 0) fire('noti', true, true);
      return;
    }
    if (isNotiLeader) fire('noti', true, true);
    if (groups.promo && groups.promo.length && tickN % 2 === 0) fire('promo', true, true);
    if (groups.orders && groups.orders.length && tickN % ordersEvery() === 0) fire('orders', true, true);
  }
  function scheduleTick() {
    if (timer) { clearTimeout(timer); timer = null; }
    timer = setTimeout(function () {
      timer = null;
      onTick();
      if (hasSubs()) scheduleTick();
    }, pollDelay);
  }
  function startTimer() {
    if ((timer || worker) || !hasSubs()) return;
    try {
      var url = URL.createObjectURL(new Blob(['function loop(){postMessage(0);setTimeout(loop,' + POLL_MS + ')}loop()'], { type: 'text/javascript' }));
      worker = new Worker(url);
      worker.onmessage = onTick;
      worker.onerror = function () {
        if (worker) { try { worker.terminate(); } catch (_) {} worker = null; }
        if (hasSubs()) scheduleTick();
      };
      setTimeout(function () { URL.revokeObjectURL(url); }, 0);
    } catch (_) {
      worker = null;
      scheduleTick();
    }
  }
  function stopTimerIfEmpty() {
    if (hasSubs()) return;
    if (worker) { try { worker.terminate(); } catch (_) {} worker = null; }
    if (timer) { clearTimeout(timer); timer = null; }
  }
  function claimNotiLeader() {
    if (leaderTried) return;
    leaderTried = true;
    if (typeof navigator === 'undefined' || !navigator.locks || typeof navigator.locks.request !== 'function') {
      isNotiLeader = true;
      return;
    }
    isNotiLeader = false;
    navigator.locks.request('ttv-noti-leader', function () {
      isNotiLeader = true;
      return new Promise(function () {});
    }).catch(function () { isNotiLeader = true; });
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
      claimNotiLeader();
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
    if (!document.hidden) {
      nextTickAt = 0;
      pollDelay = POLL_MS;
      fire('*');
    }
  });

  var lastKey = '';
  var lastUnread = -1;
  var lastSig = '';
  var lastStamp = null;
  var lastDel = 0;
  var lastFullAt = 0;
  var nextSafetyAt = 0;
  var lastUnreadIds = {};
  var cached = [];
  var fetched = false;
  var CACHE_KEY = 'ttv_noti_cache';
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
  function isMineRow(r) {
    if (!r) return false;
    var k = sessionKey();
    if (!k) return false;
    var type = r.recipient_type || 'customer';
    return k === type + ':' + String(r.recipient_id || '');
  }
  function listSig(rows) {
    return (rows || []).map(function (r) {
      return r.id + ':' + (r.is_read ? '1' : '0') + ':' + String(r.created_at || '');
    }).join('|');
  }
  function inboxStale() {
    if (!fetched || lastFullAt <= 0) return false;
    if (!nextSafetyAt) nextSafetyAt = lastFullAt + 15 * 60 * 1000 + Math.floor(Math.random() * 15 * 60 * 1000);
    return Date.now() >= nextSafetyAt;
  }
  function parseStamp(raw) {
    if (!raw || typeof raw === 'string') return { t: String(raw || ''), del: 0 };
    return { t: String(raw.t || ''), del: Number(raw.del) || 0 };
  }
  function checkStamp() {
    if (!TTV.api || typeof TTV.api.getNotiStamp !== 'function') return Promise.resolve({ load: true, needFull: true, stamp: '', del: 0 });
    return TTV.api.getNotiStamp().then(function (raw) {
      var rec = parseStamp(raw);
      var delChanged = rec.del !== lastDel;
      return { load: rec.t !== lastStamp || delChanged || inboxStale(), needFull: delChanged, stamp: rec.t, del: rec.del };
    }).catch(function () {
      return { load: false, needFull: false, stamp: lastStamp, del: lastDel };
    });
  }
  function refresh(fromPoll) {
    if (!sessionKey()) return Promise.resolve();
    if (!badgeCbs.length && !listCbs.length && !soundReady) return Promise.resolve();
    if (fromPoll && !isNotiLeader) return Promise.resolve();
    if (busy) { queued = true; return Promise.resolve(); }
    if (!TTV.api || typeof TTV.api.listMyNotifications !== 'function') return Promise.resolve();
    busy = true;
    var switched = sessionKey() !== lastKey;
    return checkStamp().then(function (c) {
      if (!(!fetched || switched || c.load)) return null;
      var doFull = !fetched || inboxStale() || switched || c.needFull;
      return TTV.api.listMyNotifications({ full: doFull }).then(function (rows) {
        lastStamp = c.stamp;
        lastDel = c.del;
        lastFullAt = Date.now();
        if (doFull) nextSafetyAt = Date.now() + 15 * 60 * 1000 + Math.floor(Math.random() * 15 * 60 * 1000);
        return rows || [];
      });
    }).then(function (rows) {
      busy = false;
      pollDelay = POLL_MS;
      if (rows) apply(rows);
      if (queued) { queued = false; return refresh(fromPoll); }
    }).catch(function () {
      busy = false;
      pollDelay = Math.min(Math.max(pollDelay, POLL_MS) * 2, POLL_MAX_MS);
      nextTickAt = Date.now() + pollDelay;
      if (queued) { queued = false; return refresh(fromPoll); }
    });
  }
  function broadcastNoti() {
    if (!bc || !isNotiLeader) return;
    try {
      bc.postMessage({ type: 'noti-sync', key: sessionKey(), stamp: lastStamp, del: lastDel, rows: cached });
    } catch (_) {}
  }
  function applyRemote(data) {
    if (!data || data.key !== sessionKey() || !Array.isArray(data.rows)) return;
    lastStamp = data.stamp;
    lastDel = Number(data.del) || 0;
    apply(data.rows, true);
  }
  function persistCache() {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        key: lastKey,
        stamp: lastStamp,
        del: lastDel,
        rows: (cached || []).slice(0, 100).map(function (r) {
          var o = Object.assign({}, r);
          delete o._local;
          return o;
        })
      }));
    } catch (_) {}
  }
  function hydrateCache() {
    try {
      var o = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (!o || o.key !== sessionKey() || !Array.isArray(o.rows)) return;
      cached = o.rows.filter(isMineRow);
      fetched = true;
      lastKey = o.key;
      lastStamp = o.stamp || '';
      lastDel = Number(o.del) || 0;
      lastSig = listSig(cached);
      lastUnread = 0;
      lastUnreadIds = {};
      cached.forEach(function (r) {
        if (r && !r.is_read) { lastUnread += 1; lastUnreadIds[r.id] = true; }
      });
    } catch (_) {}
  }
  hydrateCache();
  setTimeout(function () { ensureNotiWatch(); }, 0);
  function apply(rows, fromBc) {
    var key = sessionKey();
    var map = {};
    (rows || []).concat(cached || []).forEach(function (r) {
      if (!r || !r.id) return;
      var id = String(r.id);
      if (!map[id] || String(r.created_at || '') >= String(map[id].created_at || '')) map[id] = r;
    });
    rows = Object.keys(map).map(function (id) { return map[id]; }).filter(isMineRow).sort(function (a, b) {
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });
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
    if (arrived && !fromBc) {
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
    persistCache();
    paintTitle(unread);
    if (changed) {
      badgeCbs.slice().forEach(function (cb) { try { cb(unread); } catch (_) {} });
      listCbs.slice().forEach(function (cb) { try { cb(rows); } catch (_) {} });
    }
    if (isNotiLeader && !fromBc) broadcastNoti();
  }
  function addWatch(list, cb, kind) {
    if (typeof cb !== 'function') return function () {};
    list.push(cb);
    if (!stopNoti) {
      claimNotiLeader();
      if (bc) { try { bc.postMessage({ type: 'noti-ask' }); } catch (_) {} }
      stopNoti = TTV.Live.watch('noti', refresh, { immediate: true });
    }
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
    watchList: function (cb) { return addWatch(listCbs, cb, 'list'); },
    prepend: function (row) {
      if (!row || !row.id || !isMineRow(row)) return;
      ensureNotiWatch();
      var copy = Object.assign({}, row, { _local: true });
      cached = [copy].concat((cached || []).filter(function (r) { return String(r.id) !== String(copy.id); }));
      fetched = true;
      lastKey = sessionKey();
      publishLocal();
      persistCache();
      if (copy.event === 'wallet.refund' && TTV.Components && TTV.Components.toast) {
        TTV.Components.toast(copy.body || copy.title || 'Đã hoàn tiền vào ví', 'success');
      }
    },
    canPrune: function () { return isNotiLeader; }
  };
})(window.TTV);
