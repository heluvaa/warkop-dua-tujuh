/**
 * Backup & restore seluruh data aplikasi (menu, transaksi, kasbon,
 * pengeluaran, settings) dalam satu file JSON. Berguna karena semua data
 * saat ini hanya tersimpan di localStorage browser — rawan hilang kalau
 * ganti device, ganti browser, atau cache dibersihkan.
 */

import { getItem, setItem, STORAGE_KEYS } from './db';
import type {
  MenuItem,
  Transaction,
  KasbonEntry,
  PengeluaranEntry,
  Operator,
  StockPurchaseEntry,
} from '../types';

const BACKUP_VERSION = 3;

export interface BackupData {
  version: number;
  exportedAt: string;
  data: {
    menu: MenuItem[];
    transactions: Transaction[];
    kasbon: KasbonEntry[];
    pengeluaran: PengeluaranEntry[];
    settings: unknown;
    operators?: Operator[];
    stockPurchases?: StockPurchaseEntry[];
  };
}

export async function buildBackup(): Promise<BackupData> {
  const [menu, transactions, kasbon, pengeluaran, settings, operators, stockPurchases] =
    await Promise.all([
      getItem<MenuItem[]>(STORAGE_KEYS.MENU, []),
      getItem<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []),
      getItem<KasbonEntry[]>(STORAGE_KEYS.KASBON, []),
      getItem<PengeluaranEntry[]>(STORAGE_KEYS.PENGELUARAN, []),
      getItem<unknown>(STORAGE_KEYS.SETTINGS, {}),
      getItem<Operator[]>(STORAGE_KEYS.OPERATORS, []),
      getItem<StockPurchaseEntry[]>(STORAGE_KEYS.STOCK_PURCHASES, []),
    ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: { menu, transactions, kasbon, pengeluaran, settings, operators, stockPurchases },
  };
}

// Memicu unduhan file backup-warkop27-YYYY-MM-DD.json berisi seluruh data.
export async function downloadBackup(): Promise<void> {
  const backup = await buildBackup();
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateKey = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `backup-warkop27-${dateKey}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  await setItem(STORAGE_KEYS.LAST_BACKUP_AT, backup.exportedAt);
}

// Kapan terakhir kali pengguna mengunduh file backup (bukan restore).
// Null berarti belum pernah backup sama sekali sejak app ini dipakai.
export async function getLastBackupAt(): Promise<string | null> {
  return getItem<string | null>(STORAGE_KEYS.LAST_BACKUP_AT, null);
}

// Jumlah hari sejak backup terakhir, atau null kalau belum pernah backup.
export async function getDaysSinceLastBackup(): Promise<number | null> {
  const lastAt = await getLastBackupAt();
  if (!lastAt) return null;
  const ms = Date.now() - new Date(lastAt).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export class BackupValidationError extends Error {}

// Validasi ringan supaya tidak menimpa data dengan file yang salah/rusak.
function assertValidBackup(parsed: unknown): asserts parsed is BackupData {
  if (!parsed || typeof parsed !== 'object') {
    throw new BackupValidationError('File tidak valid: bukan JSON objek.');
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.version !== 'number' || !obj.data || typeof obj.data !== 'object') {
    throw new BackupValidationError('File tidak valid: format backup tidak dikenali.');
  }
  const data = obj.data as Record<string, unknown>;
  const requiredArrays = ['menu', 'transactions', 'kasbon', 'pengeluaran'];
  for (const key of requiredArrays) {
    if (!Array.isArray(data[key])) {
      throw new BackupValidationError(`File tidak valid: bagian "${key}" hilang atau rusak.`);
    }
  }
}

// Membaca isi File (dari <input type="file">) sebagai teks.
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsText(file);
  });
}

// Menimpa SELURUH data lokal dengan isi backup. Tindakan destruktif —
// pastikan sudah dikonfirmasi oleh pengguna di UI sebelum memanggil ini.
export async function restoreBackup(file: File): Promise<void> {
  const text = await readFileAsText(file);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupValidationError('File tidak valid: gagal membaca JSON.');
  }

  assertValidBackup(parsed);

  const { menu, transactions, kasbon, pengeluaran, settings, operators, stockPurchases } =
    parsed.data;

  await Promise.all([
    setItem(STORAGE_KEYS.MENU, menu),
    setItem(STORAGE_KEYS.TRANSACTIONS, transactions),
    setItem(STORAGE_KEYS.KASBON, kasbon),
    setItem(STORAGE_KEYS.PENGELUARAN, pengeluaran),
    setItem(STORAGE_KEYS.SETTINGS, settings ?? {}),
    // operators & stockPurchases baru ada mulai versi backup 2/3 — file lama
    // tidak punya field ini, jadi jangan timpa data yang sudah ada di device
    // dengan array kosong.
    ...(Array.isArray(operators) ? [setItem(STORAGE_KEYS.OPERATORS, operators)] : []),
    ...(Array.isArray(stockPurchases)
      ? [setItem(STORAGE_KEYS.STOCK_PURCHASES, stockPurchases)]
      : []),
  ]);
}
