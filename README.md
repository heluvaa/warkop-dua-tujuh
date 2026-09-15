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

- **Kasir** (`/kasir`): grid menu dengan varian, keranjang, pembayaran
  Cash/QRIS/split payment dengan kembalian otomatis, pengurangan stok
  otomatis, simpan pesanan sebagai "Belum Bayar", struk digital + **struk
  bergambar** (digambar ke `<canvas>` bergaya kertas thermal, bisa dikirim
  sebagai foto ke Telegram lewat tombol "Kirim Gambar Struk ke Telegram" —
  lihat `lib/utils/receiptCanvas.ts`) berisi QR Code menuju ulasan Google,
  buka/tutup shift kasir dengan modal awal kas, pilih nama kasir + PIN
  sebelum mulai jualan (`OperatorGate`), dan void/batalkan transaksi.
- **Belum Bayar** (`/belum-bayar`): daftar pesanan yang disimpan dari
  Kasir tapi belum dibayar, bisa dilanjutkan ke pembayaran atau dibatalkan.
- **Kasbon** (`/kasbon`): catat pelanggan berutang, tombol "Lunasi"
  otomatis masuk ke rekap pemasukan hari itu, filter status (belum
  lunas/lunas/jatuh tempo), dan penanda jatuh tempo otomatis setelah
  `KASBON_OVERDUE_DAYS` hari.
- **Pelanggan** (`/pelanggan`): riwayat per pelanggan yang dikumpulkan
  otomatis dari nama yang diisi di Kasir & Kasbon — total belanja, total
  kasbon belum lunas, dan detail transaksi per pelanggan. Bisa dicari
  berdasarkan nama.
- **Pengeluaran** (`/pengeluaran`): catat pengeluaran operasional harian,
  dengan notifikasi khusus untuk pengeluaran besar.
- **Menu & Stok** (`/menu`): CRUD menu, indikator stok menipis (≤5), dan
  fitur "Belanja Stok" untuk menambah stok sekaligus (opsional) update
  harga pokok (HPP), lengkap dengan riwayat belanja stok terbaru.
- **Laporan** (`/laporan`): ringkasan pemasukan (Cash/QRIS terpisah),
  pengeluaran, laba bersih, perbandingan minggu ini vs minggu lalu & bulan
  ini vs bulan lalu, grafik tren penjualan (mingguan/bulanan), menu
  terlaris, ringkasan omzet per kasir/shift (termasuk riwayat buka-tutup
  shift & selisih kas), pencarian transaksi, tabel riwayat transaksi &
  pengeluaran hari ini, export CSV (harian/bulanan/per kasir), "Clear Data
  Tanggal Ini", dan tombol "Tutup Warung & Kirim Laporan" yang memanggil
  `app/api/telegram/route.ts` untuk mengirim rekap ke bot Telegram (isi
  `TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHAT_ID` di `.env.local`).
- **Pengaturan** (`/pengaturan`): mode terang/gelap, on/off tiap jenis
  notifikasi Telegram + tes koneksi bot, kode QRIS statis untuk pembayaran,
  kelola akun kasir (nama, PIN, peran pemilik/kasir), backup & restore
  seluruh data sebagai file JSON. Lihat bagian **"Panduan Halaman
  Pengaturan"** di bawah untuk detail tiap opsi.
- **Notifikasi Telegram & WhatsApp**: selain rekap harian manual, ada
  notifikasi otomatis untuk transaksi baru, pesanan belum bayar baru, stok
  menipis, kasbon baru, kasbon jatuh tempo, kasbon lunas, transaksi
  dibatalkan (void), pengeluaran besar (≥ `EXPENSE_NOTIFY_THRESHOLD` di
  `lib/constants.ts`), dan buka/tutup shift kasir (termasuk modal awal &
  selisih kas). Semua jenis notifikasi bisa dinyalakan/dimatikan satu per
  satu di halaman Pengaturan, dan setiap notifikasi bisa diteruskan ke
  **Telegram**, **WhatsApp**, atau keduanya sekaligus — lihat "Notifikasi
  WhatsApp" di bawah untuk cara setupnya.
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
- **Multi-kasir & peran**: tiap kasir login dengan nama + PIN (bukan
  sistem login yang aman, cuma penanda shift/siapa yang jaga). Ada 2 peran:
  **Pemilik** (bisa akses semua pengaturan sensitif) dan **Kasir** (akses
  terbatas — lihat tabel di panduan Pengaturan).
- **PWA**: bisa di-"install" ke home screen HP/laptop dan tetap ringan
  dibuka lewat browser (`components/pwa/ServiceWorkerRegister.tsx`,
  `public/manifest.json`).

## Notifikasi WhatsApp

Selain Telegram, semua notifikasi event (transaksi, kasbon, stok menipis,
dst — daftar lengkap di atas) bisa juga diteruskan ke WhatsApp lewat
`app/api/whatsapp/route.ts`. Dua channel ini independen — bisa nyalakan
salah satu atau keduanya sekaligus di **Pengaturan → Channel Notifikasi**.

Catatan: fitur balas perintah bot (`/omzet`, `/stok`, `/kasbon`, `/help`)
tetap khusus Telegram saja, karena itu balasan ke orang yang chat bot
Telegram-nya langsung, bukan notifikasi broadcast.

### Opsi 1 — Fonnte (disarankan, paling gampang)

[Fonnte](https://fonnte.com) adalah gateway WhatsApp yang populer dipakai
UMKM/warkop di Indonesia — setup-nya cuma scan QR sekali dari HP pemilik,
tanpa perlu proses verifikasi bisnis ke Meta.

1. Daftar di [fonnte.com](https://fonnte.com), tambah device baru, scan QR
   dengan WhatsApp yang mau dipakai untuk kirim notifikasi.
2. Ambil **Token** device dari dashboard Fonnte.
3. Isi di `.env.local`:
   ```
   WHATSAPP_PROVIDER=fonnte
   FONNTE_TOKEN=isi_token_dari_dashboard
   WHATSAPP_TARGET=628xxxxxxxxxx   # nomor WA pemilik warung, awali 62
   ```
4. Nyalakan channel WhatsApp di **Pengaturan → Channel Notifikasi**, lalu
   tekan **"Tes Koneksi WhatsApp"** untuk memastikan sudah terhubung.

### Opsi 2 — WhatsApp Cloud API (resmi dari Meta)

Kalau warkop sudah punya WhatsApp Business Account resmi dan mau pakai
jalur API resmi Meta (kuota gratisnya lumayan besar, tapi setup lebih
teknis — perlu Meta Business + verifikasi):

```
WHATSAPP_PROVIDER=cloud
WHATSAPP_CLOUD_TOKEN=isi_access_token
WHATSAPP_CLOUD_PHONE_NUMBER_ID=isi_phone_number_id
WHATSAPP_TARGET=628xxxxxxxxxx
```

Token & Phone Number ID didapat dari dashboard **Meta for Developers** →
app WhatsApp Business milik warkop.

## Panduan Halaman Pengaturan

Halaman **Pengaturan** (`/pengaturan`) berisi 5 bagian. Beberapa aksi
hanya bisa dilakukan oleh operator dengan peran **Pemilik** — kalau login
sebagai **Kasir**, bagian tersebut otomatis disembunyikan/dibatasi.

### 1. Tampilan
Tombol toggle untuk ganti mode **terang/gelap**. Berlaku untuk semua
halaman, tersimpan otomatis di perangkat.

### 2. Channel Notifikasi
Dua switch terpisah untuk memilih ke mana notifikasi diteruskan:
**Telegram** (perlu `TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHAT_ID`) dan
**WhatsApp** (perlu `FONNTE_TOKEN`/`WHATSAPP_CLOUD_TOKEN` & `WHATSAPP_TARGET`
— lihat bagian "Notifikasi WhatsApp" di atas). Bisa nyalakan salah satu
atau keduanya. Ada juga tombol **"Tes Koneksi Telegram"** dan **"Tes
Koneksi WhatsApp"** untuk memastikan channel yang dipakai sudah terhubung
sebelum mengandalkan notifikasi otomatis.

### 3. Jenis Notifikasi
Tiap jenis kejadian punya switch on/off sendiri — ini menentukan kejadian
apa saja yang mengirim notifikasi, terpisah dari channel di atas yang
menentukan ke mana notifikasi itu diteruskan:

| Notifikasi | Kapan terkirim |
|---|---|
| Transaksi Kasir | Setiap transaksi di Kasir selesai dibayar |
| Pesanan Belum Bayar | Ada pesanan baru disimpan sebagai "Belum Bayar" |
| Stok Menipis | Stok menu turun ke ambang batas menipis (≤5) |
| Kasbon Jatuh Tempo | Kasbon belum lunas sudah lebih dari `KASBON_OVERDUE_DAYS` hari |
| Kasbon Baru | Ada kasbon baru dicatat di halaman Kasbon |
| Kasbon Lunas | Pelanggan melunasi kasbonnya |
| Transaksi Dibatalkan | Ada transaksi yang di-void (penanda keamanan sederhana) |
| Pengeluaran Besar | Pengeluaran ≥ `EXPENSE_NOTIFY_THRESHOLD` (default Rp50.000) |
| Buka/Tutup Shift | Kasir pilih nama & PIN, atau tekan "Ganti Kasir" |
| Buka/Tutup Shift Kas | Berisi modal awal saat shift dibuka, dan kas sistem/fisik/selisih saat shift ditutup |
| Perintah Bot | Mengaktifkan/menonaktifkan balasan otomatis `/omzet`, `/stok`, `/kasbon`, `/help` dari Telegram |

### 4. QRIS
Simpan kode QRIS statis (bisa ketik manual atau upload foto/scan QR) supaya
muncul otomatis di halaman Kasir saat pelanggan bayar QRIS. **Hanya
Pemilik** yang bisa mengubah/menghapus kode ini.

### 5. Kasir & Shift
Daftar akun kasir (nama + PIN + peran). **Hanya Pemilik** yang bisa
menambah, mengubah, atau menghapus akun kasir — Kasir biasa hanya bisa
melihat daftarnya. Ini bukan sistem login yang aman, cuma penanda shift
"siapa yang sedang jaga".

### 6. Backup & Pulihkan Data
- **Backup Data**: unduh seluruh data (menu, transaksi, kasbon,
  pengeluaran, akun kasir) sebagai satu file JSON. Karena semua data cuma
  tersimpan di localStorage perangkat ini, sebaiknya backup rutin —
  terutama sebelum ganti HP/laptop atau membersihkan cache browser. Akan
  muncul peringatan otomatis kalau sudah `BACKUP_REMINDER_DAYS` hari (default
  3 hari) sejak backup terakhir.
- **Pulihkan Data**: pilih file backup `.json` untuk memulihkan data —
  akan **menimpa seluruh data yang ada saat ini** di perangkat ini, jadi
  ada dialog konfirmasi sebelum eksekusi. **Hanya Pemilik** yang bisa
  melakukan restore.

### Ringkasan akses berdasarkan peran

| Aksi | Kasir | Pemilik |
|---|---|---|
| Ganti mode terang/gelap | ✅ | ✅ |
| Nyala/matikan channel Telegram & WhatsApp | ✅ | ✅ |
| Nyala/matikan tiap jenis notifikasi | ✅ | ✅ |
| Tes koneksi Telegram / WhatsApp | ✅ | ✅ |
| Lihat daftar akun kasir | ✅ | ✅ |
| Tambah/ubah/hapus akun kasir | ❌ | ✅ |
| Ubah/hapus kode QRIS | ❌ | ✅ |
| Unduh backup data | ✅ | ✅ |
| Pulihkan (restore) data | ❌ | ✅ |

## Deploy ke Netlify

Tambahkan `@netlify/plugin-nextjs` (biasanya otomatis terdeteksi Netlify untuk
project Next.js App Router). Set environment variables yang ada di
`.env.local.example` pada dashboard Netlify.
