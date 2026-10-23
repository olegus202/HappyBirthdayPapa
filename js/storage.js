/* ==========================================================================
   ХРАНИЛИЩЕ: IndexedDB с fallback на localStorage
   --------------------------------------------------------------------------
   На iOS localStorage могут очистить через 7 дней, если приложение не
   открывали. IndexedDB не очищается автоматически.
   ========================================================================== */
(function () {
  'use strict';

  var DB_NAME = 'quest71';
  var STORE = 'state';
  var KEY = 'appState';
  var idb = null;
  var memory = null;
  var useIDB = false;

  function openDB() {
    if (idb) return Promise.resolve(idb);
    if (!window.indexedDB) return Promise.reject('no idb');

    return new Promise(function (resolve, reject) {
      var req = window.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      req.onsuccess = function (e) { idb = e.target.result; resolve(idb); };
      req.onerror = function () { reject('idb error'); };
    });
  }

  var idbData = undefined; // кэш прочитанных из IndexedDB данных (undefined = ещё не читали)

  function idbGet() {
    if (idbData !== undefined) return Promise.resolve(idbData);
    return openDB().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(STORE, 'readonly');
        var req = tx.objectStore(STORE).get(KEY);
        req.onsuccess = function () { idbData = req.result || null; resolve(idbData); };
        req.onerror = function () { resolve(null); };
      });
    });
  }

  function idbSet(value) {
    return openDB().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, KEY);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { resolve(false); };
      });
    });
  }

  function idbClear() {
    return openDB().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(KEY);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { resolve(false); };
      });
    });
  }

  function lsGet() {
    try { return window.localStorage.getItem(KEY); }
    catch (e) { return memory; }
  }
  function lsSet(value) {
    memory = value;
    try { window.localStorage.setItem(KEY, value); } catch (e) {}
  }
  function lsClear() {
    memory = null;
    try { window.localStorage.removeItem(KEY); } catch (e) {}
  }

  window.Storage = {
    isIDB: function () { return useIDB; },

    init: function () {
      return idbGet().then(function (data) {
        if (data != null) { useIDB = true; return data; }
        var raw = lsGet();
        if (raw) {
          try {
            var parsed = JSON.parse(raw);
            idbSet(parsed).then(function () { useIDB = true; });
            return parsed;
          } catch (e) { return null; }
        }
        return null;
      }).catch(function () {
        useIDB = false;
        var raw = lsGet();
        return raw ? JSON.parse(raw) : null;
      });
    },

    get: function () {
      if (useIDB) {
        if (idbData !== undefined) {
          return idbData;   /* синхронно — уже прочитали в init() */
        }
        var raw = lsGet();
        return raw ? JSON.parse(raw) : null;
      }
      var raw2 = lsGet();
      return raw2 ? JSON.parse(raw2) : null;
    },

    set: function (value) {
      idbData = value;
      if (useIDB) { idbSet(value).catch(function () {}); }
      lsSet(JSON.stringify(value));
    },

    clear: function () {
      idbData = null;
      if (useIDB) { idbClear().catch(function () {}); }
      lsClear();
    }
  };
})();
