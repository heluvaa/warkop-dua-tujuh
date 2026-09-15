import { getItem, setItem, generateId, STORAGE_KEYS } from './db';
import type { Transaction } from '../types';
import { toDateKey, todayDateKey, toMonthKey } from '../utils/date';
import { sendTelegramNotification } from '../telegram';
import { getSettings } from './settingsService';
import { formatRupiah } from '../utils/format';

export async function getAllTransactions(): Promise<Transaction[]> {
  return getItem<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
}

export async function createTransaction(
  data: Omit<Transaction, 'id' | 'createdAt'>
): Promise<Transaction> {
  const all = await getAllTransactions();
  const newTx: Transaction = {
    ...data,
    id: generateId('trx'),
    createdAt: new Date().toISOString(),
  };
  await setItem(STORAGE_KEYS.TRANSACTIONS, [...all, newTx]);

  // Notifikasi tiap transaksi kasir (bukan pelunasan kasbon, supaya tidak
  // dobel dengan alur kasbon) — bisa dimatikan lewat toggle di Pengaturan.
  if (newTx.source === 'pos') {
    const settings = await getSettings();
    if (settings.transactionNotifyEnabled) {
      const itemLines = newTx.items.map((i) => `- ${i.name} x${i.quantity}`).join('\n');
      const metode = newTx.paymentMethod === 'cash' ? 'Cash' : 'QRIS';
      const bayarLines =
        newTx.paymentMethod === 'cash' && newTx.cashReceived !== undefined
          ? `\nBayar: ${formatRupiah(newTx.cashReceived)}\nKembali: ${formatRupiah(newTx.change ?? 0)}`
          : '';
      await sendTelegramNotification(
        `🛒 <b>Transaksi Baru</b>${newTx.operatorName ? ` — ${newTx.operatorName}` : ''}\n` +
          `${itemLines}\n` +
          `Total: ${formatRupiah(newTx.total)} (${metode})` +
          bayarLines
      );
    }
  }

  return newTx;
}

// dateKey berformat 'YYYY-MM-DD' (sesuai value dari <input type="date">).
export async function getTransactionsByDate(dateKey: string): Promise<Transaction[]> {
  const all = await getAllTransactions();
  return all.filter((t) => toDateKey(new Date(t.createdAt)) === dateKey);
}

export async function clearTransactionsByDate(dateKey: string): Promise<void> {
  const all = await getAllTransactions();
  await setItem(
    STORAGE_KEYS.TRANSACTIONS,
    all.filter((t) => toDateKey(new Date(t.createdAt)) !== dateKey)
  );
}

// Memperbarui item/total transaksi yang sudah tercatat — dipakai saat kasbon
// yang sudah lunas diedit, supaya transaksi pemasukan hasil pelunasannya
// (source: 'kasbon_lunas') ikut disesuaikan dan Laporan tetap sinkron.
export async function updateTransaction(
  id: string,
  data: Partial<Pick<Transaction, 'items' | 'total'>>
): Promise<void> {
  const all = await getAllTransactions();
  const updated = all.map((t) => (t.id === id ? { ...t, ...data } : t));
  await setItem(STORAGE_KEYS.TRANSACTIONS, updated);
}

// Membatalkan transaksi (void) tanpa menghapusnya dari riwayat, supaya tetap
// tercatat untuk audit. Transaksi yang sudah voided dikecualikan dari total
// laporan. Stok item terkait dikembalikan secara terpisah oleh pemanggil
// (lihat handleVoid di halaman Laporan) karena service ini tidak tahu
// menuItemId mana yang masih valid.
export async function voidTransaction(id: string, reason?: string): Promise<void> {
  const all = await getAllTransactions();
  const updated = all.map((t) =>
    t.id === id
      ? { ...t, voided: true, voidedAt: new Date().toISOString(), voidReason: reason }
      : t
  );
  await setItem(STORAGE_KEYS.TRANSACTIONS, updated);

  // Notifikasi pembatalan transaksi — penanda keamanan/audit sederhana,
  // supaya pemilik warung tahu kalau ada transaksi yang dibatalkan meski
  // sedang tidak di tempat.
  const voided = updated.find((t) => t.id === id);
  if (voided) {
    const settings = await getSettings();
    if (settings.voidNotifyEnabled) {
      await sendTelegramNotification(
        `🚫 <b>Transaksi Dibatalkan</b>${voided.operatorName ? ` — ${voided.operatorName}` : ''}\n` +
          `Total: ${formatRupiah(voided.total)}` +
          (reason ? `\nAlasan: ${reason}` : '')
      );
    }
  }
}

// Dipertahankan untuk kompatibilitas — dipakai saat butuh data "hari ini" saja.
export async function getTodayTransactions(): Promise<Transaction[]> {
  return getTransactionsByDate(todayDateKey());
}

export async function clearTodayTransactions(): Promise<void> {
  return clearTransactionsByDate(todayDateKey());
}

// monthKey berformat 'YYYY-MM' (sesuai value dari <input type="month">).
// Dipakai untuk rekap bulanan di halaman Laporan.
export async function getTransactionsByMonth(monthKey: string): Promise<Transaction[]> {
  const all = await getAllTransactions();
  return all.filter((t) => toMonthKey(new Date(t.createdAt)) === monthKey);
}

// Total omzet per hari untuk N hari terakhir (termasuk hari ini), transaksi
// yang di-void tidak dihitung. Dipakai untuk grafik tren penjualan di Laporan.
export async function getDailyTotals(days: number): Promise<{ dateKey: string; total: number }[]> {
  const all = await getAllTransactions();
  const result: { dateKey: string; total: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateKey = toDateKey(d);
    const total = all
      .filter((t) => !t.voided && toDateKey(new Date(t.createdAt)) === dateKey)
      .reduce((sum, t) => sum + t.total, 0);
    result.push({ dateKey, total });
  }
  return result;
}
