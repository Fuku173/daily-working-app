// หน้าเปิดระบบเปิดได้แม้เน็ตหลุด: ไฟล์ของหน้านี้เอา "ล่าสุดจากเน็ตก่อน" ไม่ได้ค่อยใช้ที่เก็บไว้ (รุ่นใหม่ขึ้นทันทีที่มีเน็ต) ·
// หน้าระบบ (script.google.com) ไม่ผ่านที่นี่ — คนละโดเมน
var CACHE = 'dws-launcher-v1';
var SHELL = ['./', './index.html', './app.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-192.png', './icons/maskable-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png'];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key !== CACHE; }).map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request).then(function (response) {
    if (response.ok) {
      var copy = response.clone();
      caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
    }
    return response;
  }).catch(function () {
    return caches.match(request, { ignoreSearch: true }).then(function (hit) { return hit || caches.match('./'); });
  }));
});
