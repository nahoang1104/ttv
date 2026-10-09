/* store.js — CRUD IndexedDB cho driver local. Không dùng localStorage để lưu dữ liệu nghiệp vụ. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var DB_NAME = 'tingtingvac_db';
  var DB_VERSION = 1;
  var TABLES = [
    'users','addresses','services','pricing_config','orders','order_media','quotes',
    'wallet_transactions','payment_methods','coupons','user_coupons','notification_settings',
    'reviews','faqs','policies','banners','vendors','staff','sessions','order_events',
    'vendor_documents','vendor_transactions','withdrawals','reports','broadcasts','audit_logs',
    'notifications','app_settings','__meta'
  ];
  var dbPromise;
  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('Trình duyệt không hỗ trợ IndexedDB.')); return; }
      var request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function () {
        var db = request.result;
        TABLES.forEach(function (table) {
          if (!db.objectStoreNames.contains(table)) db.createObjectStore(table, { keyPath: 'id' });
        });
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { dbPromise = null; reject(request.error || new Error('Không mở được cơ sở dữ liệu.')); };
      request.onblocked = function () { reject(new Error('Cơ sở dữ liệu đang bị chặn bởi tab khác.')); };
    });
    return dbPromise;
  }
  function validTable(table) {
    if (TABLES.indexOf(table) < 0) throw new Error('Bảng không hợp lệ: ' + table);
    return table;
  }
  function run(table, mode, action) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(table, mode), store = tx.objectStore(table), request;
        try { request = action(store); } catch (e) { reject(e); return; }
        var result;
        if (request) { request.onsuccess = function () { result = request.result; }; request.onerror = function () { reject(request.error); }; }
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = tx.onabort = function () { reject(tx.error || (request && request.error) || new Error('Thao tác IndexedDB thất bại.')); };
      });
    });
  }
  var store = {
    dbName: DB_NAME,
    tables: TABLES.filter(function (t) { return t !== '__meta'; }),
    ready: openDb,
    list: function (table) { validTable(table); return run(table, 'readonly', function (s) { return s.getAll(); }).then(function (rows) { return rows || []; }); },
    get: function (table, id) { validTable(table); return run(table, 'readonly', function (s) { return s.get(String(id)); }).then(function (row) { return row || null; }); },
    put: function (table, record) {
      validTable(table);
      if (!record || typeof record !== 'object') return Promise.reject(new TypeError('Bản ghi phải là object.'));
      var copy = Object.assign({}, record);
      if (copy.id === undefined || copy.id === null || String(copy.id) === '') return Promise.reject(new Error('Bản ghi phải có id.'));
      copy.id = String(copy.id);
      return run(table, 'readwrite', function (s) { return s.put(copy); }).then(function () { return copy; });
    },
    remove: function (table, id) { validTable(table); return run(table, 'readwrite', function (s) { return s.delete(String(id)); }).then(function () { return true; }); },
    query: function (table, criteria) {
      validTable(table); criteria = criteria || {};
      return store.list(table).then(function (rows) {
        if (typeof criteria === 'function') return rows.filter(criteria);
        var where = criteria.where || criteria;
        var keys = Object.keys(where);
        return rows.filter(function (row) { return keys.every(function (key) {
          if (key === 'limit' || key === 'offset' || key === 'orderBy' || key === 'direction') return true;
          var expected = where[key];
          if (typeof expected === 'function') return expected(row[key], row);
          if (Array.isArray(expected)) return expected.indexOf(row[key]) >= 0;
          return row[key] === expected;
        }); }).sort(function (a, b) {
          if (!where.orderBy) return 0;
          var x = a[where.orderBy], y = b[where.orderBy];
          return (x < y ? -1 : x > y ? 1 : 0) * (where.direction === 'desc' ? -1 : 1);
        }).slice(Number(where.offset) || 0, where.limit == null ? undefined : (Number(where.offset) || 0) + Math.max(0, Number(where.limit) || 0));
      });
    },
    clear: function (table) { validTable(table); return run(table, 'readwrite', function (s) { return s.clear(); }).then(function () { return true; }); },
    count: function (table) { validTable(table); return run(table, 'readonly', function (s) { return s.count(); }); },
    transaction: function (tables, callback) {
      tables = (Array.isArray(tables) ? tables : [tables]).map(validTable);
      return openDb().then(function (db) { return new Promise(function (resolve, reject) {
        var tx = db.transaction(tables, 'readwrite');
        var api = { get: function (table, id) { return tx.objectStore(validTable(table)).get(String(id)); }, put: function (table, value) { return tx.objectStore(validTable(table)).put(value); }, remove: function (table, id) { return tx.objectStore(validTable(table)).delete(String(id)); }, clear: function (table) { return tx.objectStore(validTable(table)).clear(); } };
        try { callback(api, tx); } catch (e) { tx.abort(); reject(e); return; }
        tx.oncomplete = function () { resolve(true); }; tx.onerror = tx.onabort = function () { reject(tx.error || new Error('Giao dịch thất bại.')); };
      }); });
    }
  };
  TTV.Store = store;
  TTV.store = store;
})(window.TTV);
