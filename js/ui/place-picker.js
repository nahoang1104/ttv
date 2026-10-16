/* Sheet chọn điểm bốc / trả + màn bản đồ OSM. */
window.TTV = window.TTV || {};
TTV.ui = TTV.ui || {};
(function (TTV) {
  'use strict';
  var el = null;
  var opts = {};
  var chosen = { addr: '', lat: null, lng: null };
  var searchTimer = null;

  function esc(v) { return TTV.Components.escape(v); }

  function close() {
    if (searchTimer) { clearTimeout(searchTimer); searchTimer = null; }
    if (TTV.map) TTV.map.unmount();
    if (!el) return;
    el.remove();
    el = null;
    opts = {};
    chosen = { addr: '', lat: null, lng: null };
  }

  function goAdd() {
    close();
    TTV.Router.navigate('/address/new?back=1');
  }

  function titleText() {
    return opts.title || (opts.mode === 'dropoff' ? 'Chọn điểm trả hàng' : 'Chọn điểm bốc hàng');
  }

  function setChosen(place, fillQuery) {
    chosen = { addr: place.addr || '', lat: place.lat, lng: place.lng };
    var input = el && el.querySelector('[data-map-q]');
    var card = el && el.querySelector('[data-map-addr]');
    var btn = el && el.querySelector('[data-map="ok"]');
    var typing = input && document.activeElement === input;
    if (fillQuery && input && place.addr && !typing) input.value = place.addr;
    if (card) card.textContent = place.addr || 'Đang lấy địa chỉ…';
    if (btn) btn.disabled = !(place.lat != null && place.lng != null);
  }

  function hideSuggest() {
    var box = el && el.querySelector('[data-map-suggest]');
    if (box) { box.hidden = true; box.innerHTML = ''; box._rows = []; }
  }

  function showStatus(text) {
    var box = el && el.querySelector('[data-map-suggest]');
    if (!box) return;
    box.hidden = false;
    box._rows = [];
    box.innerHTML = '<p class="map-sheet__hint">' + esc(text) + '</p>';
  }

  function showSuggest(rows) {
    var box = el && el.querySelector('[data-map-suggest]');
    if (!box) return;
    if (!rows.length) {
      showStatus('Không tìm thấy địa chỉ. Thử tên đường + quận, ví dụ: Nguyễn Huệ Quận 1');
      return;
    }
    box.hidden = false;
    box._rows = rows;
    box.innerHTML = rows.map(function (row, i) {
      return '<button type="button" class="map-sheet__hit" data-suggest="' + i + '">' + esc(row.addr) + '</button>';
    }).join('');
  }

  function reverseAt(lat, lng) {
    var card = el && el.querySelector('[data-map-addr]');
    if (card) card.textContent = 'Đang lấy địa chỉ…';
    TTV.map.reverse(lat, lng).then(setChosen).catch(function () {
      setChosen({ addr: lat.toFixed(5) + ', ' + lng.toFixed(5), lat: lat, lng: lng });
    });
  }

  function openMap() {
    if (!el) return;
    el.classList.add('is-map');
    el.querySelector('.place-picker__panel').innerHTML =
      '<header class="map-sheet__head">' +
        '<h2><span class="map-sheet__pin"></span> ' + esc(titleText()) + '</h2>' +
        '<button type="button" class="place-picker__x" data-place-close aria-label="Đóng">×</button>' +
      '</header>' +
      '<div class="map-sheet__lookup">' +
        '<label class="map-sheet__search">' +
          '<span aria-hidden="true">⌕</span>' +
          '<input type="search" data-map-q placeholder="Tìm địa chỉ, tên đường, quận…" autocomplete="off">' +
        '</label>' +
        '<div class="map-sheet__suggest" data-map-suggest hidden></div>' +
      '</div>' +
      '<div class="map-sheet__map">' +
        '<div class="map-sheet__canvas" data-map-canvas></div>' +
        '<div class="map-sheet__zoom">' +
          '<button type="button" data-map="zoom-in" aria-label="Phóng to">+</button>' +
          '<button type="button" data-map="zoom-out" aria-label="Thu nhỏ">−</button>' +
        '</div>' +
        '<button type="button" class="map-sheet__me" data-map="me">' +
          '<span class="map-sheet__me-ico" aria-hidden="true"></span> Vị trí của tôi</button>' +
      '</div>' +
      '<p class="map-sheet__addr"><span class="map-sheet__pin"></span><span data-map-addr>Đang lấy địa chỉ…</span></p>' +
      '<button type="button" class="btn btn-primary btn-block map-sheet__ok" data-map="ok" disabled>✓  Xác nhận địa điểm</button>';

    var canvas = el.querySelector('[data-map-canvas]');
    var start = TTV.map.mount(canvas, {
      onMove: function (p) { reverseAt(p.lat, p.lng); }
    });
    reverseAt(start.lat, start.lng);

    var input = el.querySelector('[data-map-q]');
    input.addEventListener('input', function () {
      var q = input.value;
      if (searchTimer) clearTimeout(searchTimer);
      if (String(q).trim().length < 2) { hideSuggest(); return; }
      showStatus('Đang tìm…');
      searchTimer = setTimeout(function () {
        TTV.map.search(q).then(showSuggest).catch(function () {
          showStatus('Không tìm được địa chỉ. Kiểm tra mạng rồi thử lại.');
        });
      }, 350);
    });
  }

  function renderList(rows) {
    var box = el && el.querySelector('[data-place-list]');
    if (!box) return;
    if (!rows || !rows.length) {
      box.innerHTML =
        '<p class="place-picker__empty">Chưa có địa chỉ đã lưu</p>' +
        '<button type="button" class="place-picker__add-new" data-place="add">+ Thêm địa chỉ mới</button>';
      return;
    }
    box.innerHTML = rows.map(function (row) {
      var role = row.default_for || '';
      var tag = role === 'pickup' ? ' · Mặc định bốc' : (role === 'dropoff' ? ' · Mặc định trả' : '');
      return '<button type="button" class="place-picker__addr" data-place-id="' + esc(row.id) + '">' +
        '<strong>' + esc(row.label || 'Địa chỉ') + esc(tag) + '</strong>' +
        '<small>' + esc(row.detail || '') + '</small></button>';
    }).join('');
  }

  function confirmPlace() {
    if (!chosen.addr || chosen.lat == null) return;
    if (typeof opts.onPick === 'function') opts.onPick(chosen);
    close();
  }

  function myLocation() {
    if (!navigator.geolocation) {
      TTV.Components.toast('Trình duyệt không hỗ trợ vị trí.', 'danger');
      return;
    }
    navigator.geolocation.getCurrentPosition(function (pos) {
      var lat = pos.coords.latitude, lng = pos.coords.longitude;
      TTV.map.setView(lat, lng, 16);
      reverseAt(lat, lng);
    }, function () {
      TTV.Components.toast('Không lấy được vị trí. Hãy cho phép truy cập vị trí.', 'danger');
    }, { enableHighAccuracy: true, timeout: 8000 });
  }

  function onClick(e) {
    if (e.target === el || e.target.closest('button[data-place-close]')) { close(); return; }
    if (e.target.closest('[data-place="add"]')) { goAdd(); return; }
    if (e.target.closest('[data-place="map"]')) { openMap(); return; }
    var sug = e.target.closest('[data-suggest]');
    if (sug) {
      var rows = (el.querySelector('[data-map-suggest]') || {})._rows || [];
      var row = rows[+sug.getAttribute('data-suggest')];
      if (row) {
        hideSuggest();
        TTV.map.setView(row.lat, row.lng, 16);
        setChosen(row, true);
      }
      return;
    }
    var mapAct = e.target.closest('[data-map]');
    if (mapAct) {
      var act = mapAct.getAttribute('data-map');
      if (act === 'zoom-in') TTV.map.zoomIn();
      if (act === 'zoom-out') TTV.map.zoomOut();
      if (act === 'me') myLocation();
      if (act === 'ok') confirmPlace();
      return;
    }
    var item = e.target.closest('[data-place-id]');
    if (!item || typeof opts.onPick !== 'function') return;
    var id = item.getAttribute('data-place-id');
    TTV.api.getAddress(id).then(function (row) {
      if (!row) return;
      opts.onPick({ addr: row.detail || row.label, lat: row.lat, lng: row.lng, raw: row });
      close();
    });
  }

  TTV.ui.placePicker = {
    open: function (options) {
      close();
      opts = options || {};
      el = document.createElement('div');
      el.className = 'place-picker';
      el.innerHTML =
        '<section class="place-picker__panel" role="dialog" aria-modal="true" aria-label="' + esc(titleText()) + '">' +
          '<header class="place-picker__head">' +
            '<h2>' + esc(titleText()) + '</h2>' +
            '<button type="button" class="place-picker__x" data-place-close aria-label="Đóng">×</button>' +
          '</header>' +
          '<button type="button" class="place-picker__map" data-place="map">' +
            '<span class="place-picker__map-ico" aria-hidden="true">' +
              '<svg viewBox="0 0 48 48"><rect x="6" y="10" width="36" height="28" rx="6" fill="#e8f3ff"/><path fill="#7eb6f5" d="M10 18h10v16H10z"/><path fill="#b9dcff" d="M20 14h18v20H20z"/><path fill="#1b7be4" d="M24 16l12 3.2v16.6L24 33.2z"/><circle cx="18" cy="24" r="5.2" fill="#fff"/><path fill="#1b7be4" d="M18 16.6c-2.6 0-4.7 2-4.7 4.6 0 3.4 4.7 9.2 4.7 9.2s4.7-5.8 4.7-9.2c0-2.6-2.1-4.6-4.7-4.6zm0 6.3a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4z"/></svg>' +
            '</span>' +
            '<span class="place-picker__map-txt"><strong>Chọn trên bản đồ</strong><small>Tìm kiếm &amp; ghim vị trí chính xác</small></span>' +
            '<span class="place-picker__chevron" aria-hidden="true">›</span>' +
          '</button>' +
          '<div class="place-picker__book">' +
            '<strong>Sổ địa chỉ</strong>' +
            '<button type="button" data-place="add">+ Thêm</button>' +
          '</div>' +
          '<div class="place-picker__list" data-place-list></div>' +
        '</section>';
      document.body.appendChild(el);
      el.addEventListener('click', onClick);
      if (opts.mapOnly) { openMap(); return; }
      renderList([]);
      var load = TTV.api.listAddresses ? TTV.api.listAddresses() : Promise.resolve([]);
      load.then(renderList).catch(function () { renderList([]); });
    },
    close: close
  };
})(window.TTV);
