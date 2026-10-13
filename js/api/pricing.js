/* Tính giá tham khảo từ bảng pricing_config + giá cơ bản dịch vụ (IndexedDB). Không hard-code đơn giá. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var cfg = null;

  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : (fallback || 0);
  }
  function weightOf(id) {
    var list = (cfg && cfg.weight_tiers) || [];
    var found = null;
    list.forEach(function (w) {
      if ((w.id || w.code) === id) found = w;
    });
    return found || list[0] || { id: id, name: '', price: 0 };
  }
  function quote(opts) {
    opts = opts || {};
    var c = cfg || {};
    var base = Math.max(0, Math.round(num(opts.basePrice)));
    var w = weightOf(opts.weight || 'medium');
    var km = Math.max(0, num(opts.km));
    var kmShown = Math.round(km * 100) / 100;
    var kmFee = Math.max(0, num(c.km_fee));
    var distance = Math.round(kmShown * kmFee);
    var unit = num(c.floor_fee);
    var disc = num(c.elevator_discount);
    function siteFloor(floors, elevator) {
      var n = Math.max(0, Math.round(num(floors)));
      var raw = n * unit;
      if (elevator) raw = raw * (1 - disc);
      return Math.round(raw);
    }
    var pickupFloorFee = siteFloor(opts.pickupFloor, opts.pickupElevator);
    var dropFloorFee = opts.needUnload === false ? 0 : siteFloor(opts.dropFloor, opts.dropElevator);
    var floor = pickupFloorFee + dropFloorFee;
    var workers = Math.max(1, Math.round(num(opts.workers, 1)));
    var extraWorker = num(c.extra_worker_fee);
    var workersFee = workers <= 1 ? 0 : (workers - 1) * extraWorker;
    var weightFee = Math.round(num(w.price));
    var total = base + weightFee + floor + distance + workersFee;
    return {
      base: base,
      weight: weightFee,
      weightName: w.name || '',
      km: kmShown,
      kmLabel: kmShown.toFixed(2).replace('.', ',') + ' km',
      distance: distance,
      pickupFloor: pickupFloorFee,
      dropFloor: dropFloorFee,
      floor: floor,
      floorLabel: opts.needUnload === false ? 'bốc' : 'bốc + dỡ',
      workers: workers,
      workersFee: workersFee,
      total: total
    };
  }

  TTV.pricing = {
    ready: function () {
      if (!TTV.Store || !TTV.Store.get) return Promise.resolve(cfg || {});
      return TTV.Store.get('pricing_config', 'default').then(function (row) {
        cfg = row || {};
        return cfg;
      }).catch(function () {
        cfg = cfg || {};
        return cfg;
      });
    },
    invalidate: function () { cfg = null; },
    quote: quote,
    weightTiers: function () {
      return ((cfg && cfg.weight_tiers) || []).map(function (w) {
        return { id: w.id || w.code, name: w.name || '', hint: w.description || '', price: w.price };
      });
    },
    minAmount: function () { return Math.max(0, Math.round(num(cfg && cfg.min_amount))); },
    quoteWindowMin: function () { return Math.max(0, Math.round(num(cfg && cfg.quote_window_min))); },
    quoteWindowMs: function () { return this.quoteWindowMin() * 60000; },
    urgentMin: function (total) {
      var sm = (cfg && cfg.speed_multipliers) || {};
      var rate = sm.urgent != null ? num(sm.urgent, 1) : num(cfg && cfg.urgent_rate, 1);
      return Math.round(Math.max(0, num(total)) * rate);
    }
  };
})(window.TTV);
