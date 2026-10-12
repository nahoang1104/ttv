/* Tính giá tham khảo: cơ bản + trọng lượng + khoảng cách. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var FALLBACK = {
    km_fee: 10000,
    floor_fee: 15000,
    elevator_discount: 0.7,
    extra_worker_fee: 107000,
    urgent_rate: 1.2,
    min_amount: 10000,
    weight_tiers: [
      { id: 'light', name: 'Nhẹ', price: 15000 },
      { id: 'medium', name: 'Vừa', price: 57000 },
      { id: 'heavy', name: 'Nặng', price: 160000 },
      { id: 'very_heavy', name: 'Rất nặng', price: 330000 }
    ]
  };
  var cfg = FALLBACK;

  function weightOf(id) {
    var list = cfg.weight_tiers || FALLBACK.weight_tiers;
    var found = null;
    list.forEach(function (w) {
      if ((w.id || w.code) === id) found = w;
    });
    return found || list[1] || FALLBACK.weight_tiers[1];
  }
  function quote(opts) {
    opts = opts || {};
    var base = Math.max(0, Math.round(Number(opts.basePrice) || 50000));
    var w = weightOf(opts.weight || 'medium');
    var km = Math.max(0, Number(opts.km) || 0);
    var kmShown = Math.round(km * 100) / 100;
    var kmFee = Math.max(0, Number(cfg.km_fee != null ? cfg.km_fee : FALLBACK.km_fee));
    var distance = Math.round(kmShown * kmFee);
    var unit = Number(cfg.floor_fee != null ? cfg.floor_fee : FALLBACK.floor_fee);
    var disc = Number(cfg.elevator_discount != null ? cfg.elevator_discount : FALLBACK.elevator_discount);
    function siteFloor(floors, elevator) {
      var n = Math.max(0, Math.round(Number(floors) || 0));
      var raw = n * unit;
      if (elevator) raw = raw * (1 - disc);
      return Math.round(raw);
    }
    var pickupFloorFee = siteFloor(opts.pickupFloor, opts.pickupElevator);
    var dropFloorFee = opts.needUnload === false ? 0 : siteFloor(opts.dropFloor, opts.dropElevator);
    var floor = pickupFloorFee + dropFloorFee;
    var floorLabel = opts.needUnload === false ? 'bốc' : 'bốc + dỡ';
    var workers = Math.max(1, Math.round(Number(opts.workers) || 1));
    var extraWorker = Number(cfg.extra_worker_fee != null ? cfg.extra_worker_fee : FALLBACK.extra_worker_fee);
    var workersFee = workers <= 1 ? 0 : (workers - 1) * extraWorker;
    var total = base + Math.round(Number(w.price) || 0) + floor + distance + workersFee;
    return {
      base: base,
      weight: Math.round(Number(w.price) || 0),
      weightName: w.name || 'Vừa',
      km: kmShown,
      kmLabel: kmShown.toFixed(2).replace('.', ',') + ' km',
      distance: distance,
      pickupFloor: pickupFloorFee,
      dropFloor: dropFloorFee,
      floor: floor,
      floorLabel: floorLabel,
      workers: workers,
      workersFee: workersFee,
      total: total
    };
  }

  TTV.pricing = {
    ready: function () {
      if (!TTV.Store || !TTV.Store.get) return Promise.resolve(cfg);
      return TTV.Store.get('pricing_config', 'default').then(function (row) {
        if (row) cfg = row;
        return cfg;
      }).catch(function () { return cfg; });
    },
    quote: quote,
    minAmount: function () { return cfg.min_amount || FALLBACK.min_amount; },
    urgentMin: function (total) {
      var rate = Number(cfg.urgent_rate != null ? cfg.urgent_rate : FALLBACK.urgent_rate);
      return Math.round(Math.max(0, Number(total) || 0) * rate);
    }
  };
})(window.TTV);
