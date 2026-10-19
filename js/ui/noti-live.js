/* Bus live: ping ngay + BroadcastChannel (tab khác) + poll 4s khi tab hiện. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var CHANNEL = 'ttv_live';
  var POLL_MS = 4000;
  var bc = null;
  var timer = null;
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
    if (topic === 'noti' || topic === '*') TTV.Store.invalidate(['notifications']);
  }
  function fire(topic, fromPoll) {
    // Ping xóa cache đơn. Poll vẫn xóa cache thông báo để thợ/khách nghe chuông khi có noti mới.
    if (!fromPoll) bustHotTables(topic);
    else if (TTV.Store && typeof TTV.Store.invalidate === 'function') TTV.Store.invalidate(['notifications']);
    var seen = {};
    function run(t) {
      (groups[t] || []).forEach(function (w) {
        if (seen[w.id]) return;
        seen[w.id] = true;
        try { w.cb(!!fromPoll); } catch (_) {}
      });
    }
    if (topic === '*') Object.keys(groups).forEach(run);
    else { run(topic); run('*'); }
  }
  function startTimer() {
    if (timer || !hasSubs()) return;
    timer = setInterval(function () {
      if (document.hidden) return;
      fire('*', true);
    }, POLL_MS);
  }
  function stopTimerIfEmpty() {
    if (hasSubs() || !timer) return;
    clearInterval(timer);
    timer = null;
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
    if (!document.hidden) fire('*');
  });

  var lastKey = '';
  var lastUnread = -1;
  var lastSig = '';
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
  function refresh(fromPoll, retriesLeft) {
    if (!sessionKey()) return Promise.resolve();
    if (!badgeCbs.length && !listCbs.length && !soundReady) return Promise.resolve();
    if (busy) { queued = true; return Promise.resolve(); }
    if (!TTV.api || typeof TTV.api.listMyNotifications !== 'function') return Promise.resolve();
    busy = true;
    var ping = !fromPoll;
    return TTV.api.listMyNotifications(ping ? { force: true } : undefined).then(function (rows) {
      busy = false;
      rows = rows || [];
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
      var wasFetched = fetched;
      var changed = !fetched || key !== lastKey || unread !== lastUnread || sig !== lastSig;
      lastKey = key;
      lastUnread = unread;
      lastSig = sig;
      lastUnreadIds = unreadIds;
      if (arrived) {
        playNotiSound();
        arrivedRows.forEach(function (r) {
          if (!TTV.Components || !TTV.Components.toast) return;
          if (r.event === 'quote.accepted') TTV.Components.toast(r.title || 'Khách đã chọn bạn', 'success');
          else if (r.event === 'quote.rejected') TTV.Components.toast(r.title || 'Đơn đã được ghép với thợ khác', 'info');
          else if (r.event === 'order.new') TTV.Components.toast(r.title || 'Có đơn mới', 'info');
        });
      }
      cached = rows;
      fetched = true;
      if (changed) {
        badgeCbs.slice().forEach(function (cb) { try { cb(unread); } catch (_) {} });
        listCbs.slice().forEach(function (cb) { try { cb(rows); } catch (_) {} });
      }
      if (queued) { queued = false; return refresh(fromPoll); }
      var left = retriesLeft == null ? 3 : retriesLeft;
      if (ping && wasFetched && !arrived && left > 0) {
        setTimeout(function () { refresh(false, left - 1); }, 400);
      }
    }).catch(function () {
      busy = false;
      if (queued) { queued = false; return refresh(fromPoll); }
    });
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
