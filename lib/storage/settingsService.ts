import { getItem, setItem, STORAGE_KEYS } from './db';

// Pengaturan aplikasi yang sifatnya on/off sederhana. Disimpan di key yang
// sama dengan yang sudah dipakai backupService (STORAGE_KEYS.SETTINGS)
// supaya otomatis ikut ter-backup/restore tanpa perlu ubah backupService.
export interface AppSettings {
  lowStockNotifyEnabled: boolean;
  kasbonOverdueNotifyEnabled: boolean;
  transactionNotifyEnabled: boolean;
  // Kasbon baru dicatat (biar pemilik tahu ada utang baru, bukan cuma pas
  // sudah jatuh tempo).
  kasbonCreatedNotifyEnabled: boolean;
  // Kasbon dilunasi pelanggan.
  kasbonPaidNotifyEnabled: boolean;
  // Pesanan baru disimpan sebagai "Belum Bayar" dari Kasir.
  pendingOrderNotifyEnabled: boolean;
  // Transaksi dibatalkan (void) — penanda keamanan/audit sederhana.
  voidNotifyEnabled: boolean;
  // Rekap omzet harian otomatis, dikirim server (cron) tepat saat pergantian
  // hari WIB — lihat app/api/cron/rekap-harian/route.ts. Beda dari toggle
  // lain di file ini: field ini dibaca dari SERVER (bukan cuma browser),
  // jadi cuma berlaku kalau Supabase sudah dikonfigurasi (lihat catatan di
  // route tersebut) — kalau masih localStorage-only, cron tidak bisa
  // membaca data ini sama sekali.
  dailyRecapNotifyEnabled: boolean;
  // Pengeluaran dengan nominal besar (>= EXPENSE_NOTIFY_THRESHOLD).
  expenseNotifyEnabled: boolean;
  // Kasir buka/tutup shift (pilih nama & PIN / "Ganti Kasir").
  shiftNotifyEnabled: boolean;
  // Buka/tutup SHIFT LACI KAS (modal awal & hasil hitung selisih kas saat
  // tutup) — beda dari shiftNotifyEnabled di atas yang untuk ganti kasir.
  shiftCashNotifyEnabled: boolean;
  // Bot Telegram merespons perintah seperti /omzet, /stok, /kasbon — lihat
  // lib/telegramCommands.ts. Hanya aktif selama app kasir terbuka di
  // perangkat (lihat components/telegram/TelegramCommandListener.tsx).
  telegramCommandsEnabled: boolean;
  // Payload QRIS statis milik warkop (hasil decode kode QR dari kertas
  // cetakan resmi penyelenggara), disimpan pemilik lewat Pengaturan. Dipakai
  // untuk menyuntik nominal transaksi secara otomatis (lihat lib/utils/qris.ts)
  // supaya kode QR yang muncul di PaymentModal sudah terisi nominalnya —
  // kasir tidak perlu ketik manual di aplikasi/EDC QRIS terpisah. Opsional:
  // fitur ini nonaktif (fallback ke alur lama) kalau belum diisi.
  qrisStaticCode?: string;
  // Nama merchant hasil decode otomatis dari qrisStaticCode di atas —
  // disimpan sekali saat validasi supaya bisa ditampilkan lagi di
  // Pengaturan & PaymentModal tanpa perlu parsing ulang tiap kali.
  qrisMerchantName?: string;
  // Saklar UTAMA per channel — beda dari toggle per-jenis-event di atas.
  // Toggle per-event menentukan JENIS kejadian apa saja yang boleh
  // mengirim notifikasi; dua field ini menentukan lewat CHANNEL mana
  // notifikasi itu diteruskan (lihat lib/notify.ts). Kalau kedua channel
  // dinyalakan, satu kejadian akan mengirim ke Telegram DAN WhatsApp
  // sekaligus.
  telegramChannelEnabled: boolean;
  // Default false — WhatsApp perlu provider (Fonnte/WhatsApp Cloud API)
  // diisi dulu di .env.local (lihat app/api/whatsapp/route.ts) sebelum
  // channel ini masuk akal dinyalakan.
  whatsappChannelEnabled: boolean;
}

// Diekspor (bukan cuma dipakai internal lewat getSettings) supaya kode
// SERVER yang membaca settings langsung dari Supabase tanpa lewat getItem
// (mis. app/api/cron/rekap-harian/route.ts, lihat lib/storage/serverKv.ts)
// tetap dapat nilai default yang konsisten, bukan menulis ulang daftar ini.
export const DEFAULT_SETTINGS: AppSettings = {
  lowStockNotifyEnabled: true,
  kasbonOverdueNotifyEnabled: true,
  transactionNotifyEnabled: true,
  kasbonCreatedNotifyEnabled: true,
  kasbonPaidNotifyEnabled: true,
  pendingOrderNotifyEnabled: true,
  voidNotifyEnabled: true,
  dailyRecapNotifyEnabled: true,
  expenseNotifyEnabled: true,
  shiftNotifyEnabled: true,
  shiftCashNotifyEnabled: true,
  telegramCommandsEnabled: true,
  telegramChannelEnabled: true,
  whatsappChannelEnabled: false,
};

export async function getSettings(): Promise<AppSettings> {
  const stored = await getItem<Partial<AppSettings>>(STORAGE_KEYS.SETTINGS, {});
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  await setItem(STORAGE_KEYS.SETTINGS, updated);
  return updated;
}
