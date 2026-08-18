/**
 * 只快取公開的靜態檔案。
 *
 * 頁面 HTML 和 /api/* 都帶有這個帳號的健康資料，共用裝置時把它們留在快取裡
 * 會讓下一個人看到，所以一律走網路、離線時改顯示 offline.html。
 */
const VERSION = "catcare-v1";
const PRECACHE = ["/offline.html", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png"];
// 只有這些公開檔案可以在執行期進快取。
const RUNTIME = /^\/(food-nutrition\.json|cat-[a-z]+\.jpg|favicon\.svg|icon-[a-z0-9-]+\.png)$/;

self.addEventListener("install", event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== VERSION).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 換頁一律連線取得最新資料，離線時給一頁說明，不拿舊畫面充數。
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  if (!RUNTIME.test(url.pathname)) return;

  event.respondWith(
    caches.match(request).then(hit => {
      const fresh = fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => hit);
      return hit || fresh;
    })
  );
});
