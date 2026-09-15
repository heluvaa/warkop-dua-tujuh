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
  // Transaksi dibatalkan (void) — penanda keamanan/audit sederhana.
  voidNotifyEnabled: boolean;
  // Pengeluaran dengan nominal besar (>= EXPENSE_NOTIFY_THRESHOLD).
  expenseNotifyEnabled: boolean;
  // Kasir buka/tutup shift (pilih nama & PIN / "Ganti Kasir").
  shiftNotifyEnabled: boolean;
  // Bot Telegram merespons perintah seperti /omzet, /stok, /kasbon — lihat
  // lib/telegramCommands.ts. Hanya aktif selama app kasir terbuka di
  // perangkat (lihat components/telegram/TelegramCommandListener.tsx).
  telegramCommandsEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  lowStockNotifyEnabled: true,
  kasbonOverdueNotifyEnabled: true,
  transactionNotifyEnabled: true,
  kasbonCreatedNotifyEnabled: true,
  kasbonPaidNotifyEnabled: true,
  voidNotifyEnabled: true,
  expenseNotifyEnabled: true,
  shiftNotifyEnabled: true,
  telegramCommandsEnabled: true,
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
