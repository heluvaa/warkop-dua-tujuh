import { getItem, setItem, generateId, STORAGE_KEYS } from './db';
import type { PengeluaranEntry } from '../types';
import { toDateKey, todayDateKey, toMonthKey } from '../utils/date';
import { sendNotification } from '../notify';
import { getSettings } from './settingsService';
import { formatRupiah } from '../utils/format';
import { EXPENSE_NOTIFY_THRESHOLD } from '../constants';

export async function getAllPengeluaran(): Promise<PengeluaranEntry[]> {
  return getItem<PengeluaranEntry[]>(STORAGE_KEYS.PENGELUARAN, []);
}

export async function createPengeluaran(
  data: Omit<PengeluaranEntry, 'id' | 'createdAt'>
): Promise<PengeluaranEntry> {
  const all = await getAllPengeluaran();
  const newEntry: PengeluaranEntry = {
    ...data,
    id: generateId('exp'),
    createdAt: new Date().toISOString(),
  };
  await setItem(STORAGE_KEYS.PENGELUARAN, [...all, newEntry]);

  // Notifikasi khusus untuk pengeluaran besar, supaya pemilik warung tahu
  // ada dana keluar dalam jumlah signifikan meski sedang tidak di tempat.
  if (newEntry.amount >= EXPENSE_NOTIFY_THRESHOLD) {
    const settings = await getSettings();
    if (settings.expenseNotifyEnabled) {
      await sendNotification(
        `💸 <b>Pengeluaran Besar</b>${newEntry.operatorName ? ` — ${newEntry.operatorName}` : ''}\n` +
          `${newEntry.name}: ${formatRupiah(newEntry.amount)}`
      );
    }
  }

  return newEntry;
}

export async function updatePengeluaran(
  id: string,
  data: Partial<Pick<PengeluaranEntry, 'name' | 'amount'>>
): Promise<void> {
  const all = await getAllPengeluaran();
  const updated = all.map((e) => (e.id === id ? { ...e, ...data } : e));
  await setItem(STORAGE_KEYS.PENGELUARAN, updated);
}

export async function deletePengeluaran(id: string): Promise<void> {
  const all = await getAllPengeluaran();
  await setItem(
    STORAGE_KEYS.PENGELUARAN,
    all.filter((e) => e.id !== id)
  );
}

// dateKey berformat 'YYYY-MM-DD' (sesuai value dari <input type="date">).
export async function getPengeluaranByDate(dateKey: string): Promise<PengeluaranEntry[]> {
  const all = await getAllPengeluaran();
  return all.filter((e) => toDateKey(new Date(e.createdAt)) === dateKey);
}

export async function clearPengeluaranByDate(dateKey: string): Promise<void> {
  const all = await getAllPengeluaran();
  await setItem(
    STORAGE_KEYS.PENGELUARAN,
    all.filter((e) => toDateKey(new Date(e.createdAt)) !== dateKey)
  );
}

// monthKey berformat 'YYYY-MM' (sesuai value dari <input type="month">).
// Dipakai untuk rekap bulanan di halaman Laporan.
export async function getPengeluaranByMonth(monthKey: string): Promise<PengeluaranEntry[]> {
  const all = await getAllPengeluaran();
  return all.filter((e) => toMonthKey(new Date(e.createdAt)) === monthKey);
}

// Dipertahankan untuk kompatibilitas — dipakai saat butuh data "hari ini" saja.
export async function getTodayPengeluaran(): Promise<PengeluaranEntry[]> {
  return getPengeluaranByDate(todayDateKey());
}

export async function clearTodayPengeluaran(): Promise<void> {
  return clearPengeluaranByDate(todayDateKey());
}

// Hapus SELURUH riwayat pengeluaran (semua tanggal) — dipakai fitur reset
// data laporan, lihat clearAllTransactions untuk konteks yang sama.
export async function clearAllPengeluaran(): Promise<void> {
  await setItem(STORAGE_KEYS.PENGELUARAN, []);
}
