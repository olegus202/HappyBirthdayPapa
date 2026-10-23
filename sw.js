/* ==========================================================================
   Service worker: офлайн-режим (работает только по http/https)
   ========================================================================== */
var CACHE = 'quest71-v4';
var ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/config.js',
  './js/app.js',
  './js/sfx.js',
  './js/confetti.js',
  './js/games/wordle.js',
  './js/games/mahjong.js',
  './js/games/klondike.js',
  './js/games/memory.js',
  './js/games/words.js',
  './js/games/quiz.js',
  './manifest.json',
  './icons/favicon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(ASSETS.map(function (u) {
        return c.add(u).catch(function () { /* одного файла не хватило — не страшно */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) {
        // обновляем кэш в фоне
        fetch(e.request).then(function (res) {
          if (res && res.status === 200) caches.open(CACHE).then(function (c) { c.put(e.request, res.clone()); });
        }).catch(function () {});
        return hit;
      }
      return fetch(e.request).then(function (res) {
        if (res && res.status === 200 && e.request.url.indexOf('http') === 0) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});
