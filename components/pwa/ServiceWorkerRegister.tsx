'use client';

import { useEffect } from 'react';

// Mendaftarkan service worker (public/sw.js) supaya app bisa di-"Add to
// Home Screen" dan tetap terbuka walau koneksi warung putus-putus. Dipasang
// sebagai komponen client terpisah (bukan langsung di layout) karena
// registrasi service worker cuma boleh jalan di browser, tidak saat SSR.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // Daftarkan setelah halaman selesai load supaya tidak berebut bandwidth
    // dengan aset halaman pertama.
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Diamkan saja kalau gagal (mis. browser lama) — app tetap jalan
        // normal tanpa fitur offline, cuma tidak bisa di-install.
      });
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register);
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
