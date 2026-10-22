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
    var km = opts.needUnload === false ? 0 : Math.max(0, num(opts.km));
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

  // Tính giảm giá của mã (task 7.4). Chỉ áp dụng khi số thợ ≥ min_workers (mặc định 2) và số tiền ≥ min_order.
  // Giảm không làm số tiền xuống dưới mức tối thiểu (min_amount). Trả { ok, discount, final, reason }.
  function applyCoupon(amount, coupon, workers, now, service) {
    var a = Math.max(0, Math.round(num(amount)));
    var out = { ok: false, discount: 0, final: a, reason: '' };
    if (!coupon) { out.reason = 'Mã giảm giá không tồn tại.'; return out; }
    var exp = coupon.expires_at ? new Date(coupon.expires_at).getTime() : NaN;
    var t = now == null ? Date.now() : (now instanceof Date ? now.getTime() : Number(now));
    if (coupon.status === 'disabled') { out.reason = 'Mã giảm giá đã bị tắt.'; return out; }
    if (coupon.status === 'expired' || (isFinite(exp) && exp < t)) { out.reason = 'Mã giảm giá đã hết hạn.'; return out; }
    var allowed = coupon.services;
    if (Array.isArray(allowed) && allowed.length && service) {
      if (allowed.indexOf(String(service)) < 0) {
        out.reason = 'Mã không áp dụng cho dịch vụ này.';
        return out;
      }
    }
    var minW = Math.max(1, Math.round(num(coupon.min_workers, 2)));
    if (Math.max(1, Math.round(num(workers, 1))) < minW) { out.reason = 'Mã chỉ áp dụng cho đơn từ ' + minW + ' thợ trở lên.'; return out; }
    var minOrder = Math.max(0, Math.round(num(coupon.min_order)));
    if (a < minOrder) { out.reason = 'Đơn tối thiểu ' + new Intl.NumberFormat('vi-VN').format(minOrder) + 'đ để dùng mã này.'; return out; }
    var value = Math.max(0, num(coupon.discount_value));
    var d = coupon.discount_type === 'fixed' ? value : Math.floor(a * value / 100);
    var cap = Math.max(0, Math.round(num(coupon.max_discount)));
    if (cap > 0) d = Math.min(d, cap);
    var floorAmount = Math.max(0, Math.round(num(cfg && cfg.min_amount)));
    d = Math.max(0, Math.min(Math.round(d), a - Math.min(a, floorAmount)));
    out.ok = true; out.discount = d; out.final = a - d;
    return out;
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
    applyCoupon: applyCoupon,
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
