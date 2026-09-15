# Warkop Dua Tujuh — POS & Manajemen Warung

## Menjalankan secara lokal

```bash
npm install
cp .env.local.example .env.local   # isi NEXT_PUBLIC_GOOGLE_REVIEW_URL, dll.
npm run dev
```

Buka http://localhost:3000 — akan otomatis diarahkan ke halaman `/kasir`.

## Pindah ke Supabase (opsional)

Secara default semua data (menu, transaksi, kasbon, dst) disimpan di
`localStorage` browser — artinya data terkunci di 1 device dan hilang kalau
cache di-clear. Untuk pindah ke Supabase (data tersimpan di cloud, bisa
diakses dari banyak device):

1. Bikin project baru di [supabase.com](https://supabase.com).
2. Buka **SQL Editor** di dashboard Supabase, jalankan isi file
   `supabase/schema.sql` (bikin tabel `kv_store` + policy akses).
3. Ambil **Project URL** dan **anon public key** dari
   **Project Settings → API**, isi ke `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
4. `npm install` lagi (supaya `@supabase/supabase-js` di `package.json`
   ke-install), lalu jalankan ulang `npm run dev` / re-deploy.

Kalau kedua env var itu dikosongkan, app otomatis tetap jalan pakai
`localStorage` seperti sebelumnya — jadi aman untuk dicoba kapan saja tanpa
harus setup Supabase dulu (lihat komentar di `lib/storage/db.ts`).

Catatan: data lama yang sudah ada di `localStorage` **tidak otomatis
pindah** ke Supabase — ini cuma mengganti ke mana data BARU disimpan. Kalau
mau bawa data lama, pakai fitur Export CSV di halaman Laporan dulu sebagai
cadangan sebelum pindah.

## Status saat ini

Semua halaman utama sudah berfungsi:

- **Kasir**: grid menu, keranjang, pembayaran Cash/QRIS dengan kembalian
  otomatis, pengurangan stok otomatis, dan struk digital berisi QR Code
  menuju ulasan Google.
- **Kasbon**: catat pelanggan berutang, tombol "Lunasi" otomatis masuk ke
  rekap pemasukan hari itu.
- **Pengeluaran**: catat pengeluaran operasional harian.
- **Menu & Stok**: CRUD menu + indikator stok menipis (≤5).
- **Laporan**: ringkasan pemasukan (Cash/QRIS terpisah), pengeluaran, laba
  bersih, tabel riwayat transaksi & pengeluaran hari ini, export CSV,
  "Clear Data Harian", dan tombol "Tutup Warung & Kirim Laporan" yang
  memanggil `app/api/telegram/route.ts` untuk mengirim rekap ke bot
  Telegram (isi `TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHAT_ID` di `.env.local`).
- **Notifikasi Telegram**: selain rekap harian manual, ada notifikasi
  otomatis untuk transaksi baru, stok menipis, kasbon baru, kasbon jatuh
  tempo, kasbon lunas, transaksi dibatalkan (void), pengeluaran besar
  (≥ `EXPENSE_NOTIFY_THRESHOLD` di `lib/constants.ts`), dan buka/tutup
  shift kasir. Semua bisa dinyalakan/dimatikan satu per satu di halaman
  Pengaturan, yang juga punya tombol "Tes Koneksi Bot" untuk memastikan
  token & chat ID sudah benar.
- **Perintah Bot Telegram**: kirim `/omzet`, `/stok`, `/kasbon`, atau
  `/help` ke bot untuk dapat balasan langsung dari Telegram (lihat
  `lib/telegramCommands.ts`). Karena semua data cuma tersimpan di
  localStorage perangkat kasir (bukan server), bot ini di-poll dari
  browser lewat `components/telegram/TelegramCommandListener.tsx` — jadi
  cuma bisa membalas selama ada tab aplikasi kasir yang terbuka di salah
  satu perangkat warung. Pastikan bot TIDAK punya webhook terdaftar (kalau
  pernah di-setup sebelumnya, panggil
  `https://api.telegram.org/bot<TOKEN>/deleteWebhook` sekali saja), karena
  webhook aktif akan bikin polling `getUpdates` gagal.

## Deploy ke Netlify

Tambahkan `@netlify/plugin-nextjs` (biasanya otomatis terdeteksi Netlify untuk
project Next.js App Router). Set environment variables yang ada di
`.env.local.example` pada dashboard Netlify.
