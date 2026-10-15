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
  function fire(topic) {
    var seen = {};
    function run(t) {
      (groups[t] || []).forEach(function (w) {
        if (seen[w.id]) return;
        seen[w.id] = true;
        try { w.cb(); } catch (_) {}
      });
    }
    if (topic === '*') Object.keys(groups).forEach(run);
    else { run(topic); run('*'); }
  }
  function startTimer() {
    if (timer || !hasSubs()) return;
    timer = setInterval(function () {
      if (document.hidden) return;
      fire('*');
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
  var cached = [];
  var fetched = false;
  var badgeCbs = [];
  var listCbs = [];
  var busy = false;
  var queued = false;
  var stopNoti = null;

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
  function refresh() {
    if (!badgeCbs.length && !listCbs.length) return Promise.resolve();
    if (busy) { queued = true; return Promise.resolve(); }
    if (!TTV.api || typeof TTV.api.listMyNotifications !== 'function') return Promise.resolve();
    busy = true;
    return TTV.api.listMyNotifications().then(function (rows) {
      busy = false;
      rows = rows || [];
      var key = sessionKey();
      var unread = 0;
      rows.forEach(function (r) { if (!r.is_read) unread += 1; });
      var sig = listSig(rows);
      var changed = !fetched || key !== lastKey || unread !== lastUnread || sig !== lastSig;
      lastKey = key;
      lastUnread = unread;
      lastSig = sig;
      cached = rows;
      fetched = true;
      if (changed) {
        badgeCbs.slice().forEach(function (cb) { try { cb(unread); } catch (_) {} });
        listCbs.slice().forEach(function (cb) { try { cb(rows); } catch (_) {} });
      }
      if (queued) { queued = false; return refresh(); }
    }).catch(function () {
      busy = false;
      if (queued) { queued = false; return refresh(); }
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
      if (!badgeCbs.length && !listCbs.length && stopNoti) {
        stopNoti();
        stopNoti = null;
      }
    };
  }

  TTV.NotiLive = {
    unread: function () { return lastUnread < 0 ? 0 : lastUnread; },
    watchBadge: function (cb) { return addWatch(badgeCbs, cb, 'badge'); },
    watchList: function (cb) { return addWatch(listCbs, cb, 'list'); }
  };
})(window.TTV);
