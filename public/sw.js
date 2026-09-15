// Service worker Warkop Dua Tujuh.
//
// Tujuannya sederhana: supaya app shell (HTML/JS/CSS) tetap kebuka walau
// koneksi warung lagi putus-putus, karena semua data transaksi/menu
// disimpan di localStorage (client-side), bukan lewat server. Jadi begitu
// shell-nya ke-cache, kasir tetap bisa jualan meski wifi mati — cuma fitur
// yang memang butuh internet (kirim laporan Telegram) yang tidak akan jalan.
//
// Strategi:
// - Navigasi (buka halaman): network-first, fallback ke cache kalau offline.
// - Aset statis (_next/static, ikon, font): cache-first, karena sudah
//   punya hash di nama file-nya jadi aman selama-lamanya di-cache.
// - Endpoint /api/*: selalu lewat network saja, tidak pernah di-cache,
//   supaya kirim laporan Telegram tidak mengembalikan respons basi.

const CACHE_VERSION = 'warkop27-v1';
const APP_SHELL = ['/kasir', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {
        // Kalau salah satu gagal (mis. offline saat install pertama),
        // jangan sampai gagal total — service worker tetap terpasang.
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Jangan pernah cache API — data laporan/telegram harus selalu fresh.
  if (url.pathname.startsWith('/api/')) return;

  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json';

  if (isStaticAsset) {
    event.respondWith(
      caches.open(CACHE_VERSION).then((cache) =>
        cache.match(request).then(
          (cached) =>
            cached ||
            fetch(request).then((response) => {
              cache.put(request, response.clone());
              return response;
            })
        )
      )
    );
    return;
  }

  // Navigasi halaman: coba network dulu (biar selalu dapat versi terbaru
  // kalau online), simpan salinannya ke cache, dan kalau gagal (offline)
  // baru jatuh ke cache terakhir yang tersimpan.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/kasir')))
    );
  }
});
