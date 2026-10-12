/* Bản đồ (Esri tiles) + Photon geocode. Sau này có thể thay bằng VietMap mà UI không đổi. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var DEFAULT = { lat: 10.8231, lng: 106.6297, zoom: 14 };
  var map = null;
  var marker = null;
  var onMove = null;

  function distanceKm(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return null;
    var R = 6371, toRad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toRad, dLng = (b.lng - a.lng) * toRad;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }

  function photonAddr(props) {
    if (!props) return '';
    var parts = [props.name, props.housenumber, props.street, props.district, props.city, props.state]
      .filter(function (p, i, arr) { return p && arr.indexOf(p) === i; });
    return parts.join(', ');
  }

  function photon(path, params) {
    var q = new URLSearchParams(params);
    return fetch('https://photon.komoot.io/' + path + '?' + q.toString()).then(function (res) {
      if (!res.ok) throw new Error('Không gọi được dịch vụ địa chỉ.');
      return res.json();
    });
  }

  function featuresToPlaces(data) {
    return ((data && data.features) || []).map(function (f) {
      var c = f.geometry && f.geometry.coordinates;
      return { addr: photonAddr(f.properties), lat: c ? c[1] : null, lng: c ? c[0] : null, raw: f };
    }).filter(function (p) { return p.lat != null && p.addr; });
  }

  function pinIcon() {
    return window.L.divIcon({
      className: 'map-pin',
      html: '<span class="map-pin__dot"></span>',
      iconSize: [36, 44],
      iconAnchor: [18, 42]
    });
  }

  function placeMarker(lat, lng) {
    if (!map) return;
    var latlng = [lat, lng];
    if (marker) marker.setLatLng(latlng);
    else marker = window.L.marker(latlng, { icon: pinIcon(), draggable: true }).addTo(map);
    marker.off('dragend');
    marker.on('dragend', function () {
      var p = marker.getLatLng();
      if (onMove) onMove({ lat: p.lat, lng: p.lng, source: 'drag' });
    });
  }

  TTV.map = {
    defaultCenter: DEFAULT,
    distanceKm: distanceKm,
    search: function (q) {
      q = String(q || '').trim();
      if (q.length < 2) return Promise.resolve([]);
      function openMeteo() {
        var url = 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(q) +
          '&count=6&language=vi&countryCode=VN';
        return fetch(url).then(function (res) {
          if (!res.ok) return [];
          return res.json();
        }).then(function (data) {
          return ((data && data.results) || []).map(function (row) {
            var addr = [row.name, row.admin2, row.admin1].filter(function (p, i, arr) {
              return p && arr.indexOf(p) === i;
            }).join(', ');
            return { addr: addr, lat: row.latitude, lng: row.longitude, raw: row };
          }).filter(function (p) { return p.lat != null && p.addr; });
        }).catch(function () { return []; });
      }
      return photon('api', { q: q, limit: 8, lat: DEFAULT.lat, lon: DEFAULT.lng }).then(featuresToPlaces)
        .then(function (rows) {
          if (rows.length) return rows;
          return photon('api', { q: q + ', Viet Nam', limit: 8 }).then(featuresToPlaces);
        })
        .then(function (rows) {
          if (rows.length) return rows;
          return openMeteo();
        });
    },
    reverse: function (lat, lng) {
      return photon('reverse', { lon: lng, lat: lat }).then(function (data) {
        var row = featuresToPlaces(data)[0];
        if (row) return { addr: row.addr, lat: lat, lng: lng, raw: row.raw };
        return { addr: lat.toFixed(5) + ', ' + lng.toFixed(5), lat: lat, lng: lng };
      });
    },
    mount: function (node, options) {
      options = options || {};
      if (!window.L) return Promise.reject(new Error('Chưa nạp Leaflet.'));
      TTV.map.unmount();
      onMove = options.onMove || null;
      var lat = options.lat != null ? options.lat : DEFAULT.lat;
      var lng = options.lng != null ? options.lng : DEFAULT.lng;
      map = window.L.map(node, { zoomControl: false, attributionControl: true }).setView([lat, lng], options.zoom || DEFAULT.zoom);
      window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri'
      }).addTo(map);
      placeMarker(lat, lng);
      map.on('click', function (e) {
        placeMarker(e.latlng.lat, e.latlng.lng);
        if (onMove) onMove({ lat: e.latlng.lat, lng: e.latlng.lng, source: 'click' });
      });
      setTimeout(function () { if (map) map.invalidateSize(); }, 180);
      return { lat: lat, lng: lng };
    },
    setView: function (lat, lng, zoom) {
      if (!map) return;
      map.setView([lat, lng], zoom || map.getZoom());
      placeMarker(lat, lng);
    },
    zoomIn: function () { if (map) map.zoomIn(); },
    zoomOut: function () { if (map) map.zoomOut(); },
    unmount: function () {
      onMove = null;
      marker = null;
      if (map) { map.remove(); map = null; }
    }
  };
})(window.TTV);
