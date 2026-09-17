import { getItem, setItem, generateId, STORAGE_KEYS } from './db';
import type { Transaction } from '../types';
import { toDateKey, todayDateKey, toMonthKey } from '../utils/date';
import { sendNotification } from '../notify';
import { getSettings } from './settingsService';
import { formatRupiah, paymentMethodLabel } from '../utils/format';

export async function getAllTransactions(): Promise<Transaction[]> {
  return getItem<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
}

// Bagian cash & QRIS dari satu transaksi, dihitung seragam terlepas dari
// apakah transaksi itu 'cash'/'qris' biasa atau 'split' — dipakai di semua
// agregasi laporan (harian, bulanan, per kasir, rekap Telegram) supaya tidak
// ada logika penjumlahan cash/QRIS yang tercecer & lupa menghitung split.
export function getCashAmount(t: Pick<Transaction, 'paymentMethod' | 'total' | 'splitDetail'>): number {
  if (t.paymentMethod === 'cash') return t.total;
  if (t.paymentMethod === 'split') return t.splitDetail?.cash ?? 0;
  return 0;
}

export function getQrisAmount(t: Pick<Transaction, 'paymentMethod' | 'total' | 'splitDetail'>): number {
  if (t.paymentMethod === 'qris') return t.total;
  if (t.paymentMethod === 'split') return t.splitDetail?.qris ?? 0;
  return 0;
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
  // 'pending_paid' (pesanan Belum Bayar yang baru saja ditandai lunas) ikut
  // dianggap transaksi kasir biasa di sini, bukan alur kasbon.
  if (newTx.source === 'pos' || newTx.source === 'pending_paid') {
    const settings = await getSettings();
    if (settings.transactionNotifyEnabled) {
      const itemLines = newTx.items.map((i) => `- ${i.name} x${i.quantity}`).join('\n');
      const metode = paymentMethodLabel(newTx.paymentMethod);
      const bayarLines =
        newTx.paymentMethod === 'cash' && newTx.cashReceived !== undefined
          ? `\nBayar: ${formatRupiah(newTx.cashReceived)}\nKembali: ${formatRupiah(newTx.change ?? 0)}`
          : newTx.paymentMethod === 'split' && newTx.splitDetail
            ? `\nCash: ${formatRupiah(newTx.splitDetail.cash)} · QRIS: ${formatRupiah(newTx.splitDetail.qris)}` +
              (newTx.splitDetail.kasbon > 0
                ? `\nSisa Kasbon: ${formatRupiah(newTx.splitDetail.kasbon)}`
                : '')
            : '';
      await sendNotification(
        `🛒 <b>Transaksi Baru</b>${newTx.operatorName ? ` — ${newTx.operatorName}` : ''}\n` +
          `${itemLines}\n` +
          `Total: ${formatRupiah(newTx.total)} (${metode})` +
          bayarLines,
        // 'pos' (checkout langsung di Kasir) DAN 'pending_paid' (pelunasan
        // dari halaman Belum Bayar) sekarang sama-sama selalu diikuti
        // ReceiptModal, yang begitu tampil langsung mengirim SATU pesan
        // Telegram foto struk + caption lengkap (lihat
        // components/pos/ReceiptModal.tsx) — jadi teks di sini dimatikan
        // untuk keduanya supaya tidak jadi dua pesan per transaksi.
        { telegram: false }
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
  data: Partial<Pick<Transaction, 'items' | 'total' | 'linkedKasbonId'>>
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
      await sendNotification(
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

// Hapus SELURUH riwayat transaksi (semua tanggal) — dipakai fitur reset data
// laporan di halaman Laporan, misalnya untuk membersihkan data testing
// sebelum warkop mulai dipakai sungguhan. Tidak menyentuh menu/pengaturan/
// data kasir, cuma riwayat transaksinya saja.
export async function clearAllTransactions(): Promise<void> {
  await setItem(STORAGE_KEYS.TRANSACTIONS, []);
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

export interface WeekSummary {
  total: number;
  count: number;
  days: { dateKey: string; total: number }[];
}

export interface WeekComparison {
  thisWeek: WeekSummary;
  lastWeek: WeekSummary;
}

// Bandingkan omzet & jumlah transaksi 7 hari terakhir (termasuk hari ini)
// dengan 7 hari sebelum itu — dipakai untuk kartu "Perbandingan Mingguan" di
// Laporan. Pakai window bergulir (bukan Senin-Minggu kalender) supaya selalu
// jelas "minggu ini" = 7 hari terakhir, tidak berubah drastis tergantung
// hari apa sekarang dibuka.
export async function getWeekComparison(): Promise<WeekComparison> {
  const all = await getAllTransactions();
  const daily = await getDailyTotals(14); // urut lama -> baru, panjang 14
  const lastWeekDays = daily.slice(0, 7);
  const thisWeekDays = daily.slice(7);

  function summarize(days: { dateKey: string; total: number }[]): WeekSummary {
    const keys = new Set(days.map((d) => d.dateKey));
    const total = days.reduce((sum, d) => sum + d.total, 0);
    const count = all.filter(
      (t) => !t.voided && keys.has(toDateKey(new Date(t.createdAt)))
    ).length;
    return { total, count, days };
  }

  return { thisWeek: summarize(thisWeekDays), lastWeek: summarize(lastWeekDays) };
}

export interface MonthSummary {
  monthKey: string;
  total: number;
  count: number;
}

export interface MonthComparison {
  thisMonth: MonthSummary;
  lastMonth: MonthSummary;
}

// Bandingkan omzet & jumlah transaksi bulan kalender berjalan dengan bulan
// kalender sebelumnya (mis. dibuka tanggal 16 September -> "bulan ini" =
// 1-16 September, "bulan lalu" = 1-31 Agustus penuh). Beda dari
// getWeekComparison yang pakai rolling 7 hari — di sini sengaja pakai batas
// kalender supaya sejalan dengan "Rekap Bulanan" yang juga per bulan
// kalender, meski akibatnya bulan berjalan wajar terlihat lebih kecil kalau
// dibuka di awal bulan (belum genap sebulan).
export async function getMonthComparison(): Promise<MonthComparison> {
  const all = await getAllTransactions();
  const now = new Date();
  const thisMonthKey = toMonthKey(now);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = toMonthKey(lastMonthDate);

  function summarize(monthKey: string): MonthSummary {
    const txs = all.filter((t) => !t.voided && toMonthKey(new Date(t.createdAt)) === monthKey);
    return { monthKey, total: txs.reduce((sum, t) => sum + t.total, 0), count: txs.length };
  }

  return { thisMonth: summarize(thisMonthKey), lastMonth: summarize(lastMonthKey) };
}

// Semua transaksi aktif (tidak void) dalam N hari terakhir (termasuk hari
// ini), diurutkan lama -> baru. Dipakai untuk analisis pola jam/hari/menu
// ramai yang tidak terikat ke satu tanggal saja (lihat halaman Laporan,
// bagian "Pola Penjualan") — supaya kasir/pemilik bisa lihat jam & hari mana
// yang konsisten ramai dalam seminggu/sebulan terakhir untuk atur jadwal
// staf & waktu restock, bukan cuma sibuk-tidaknya satu hari yang bisa saja
// kebetulan ramai/sepi.
export async function getActiveTransactionsSince(days: number): Promise<Transaction[]> {
  const all = await getAllTransactions();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days - 1));
  cutoff.setHours(0, 0, 0, 0);
  return all
    .filter((t) => !t.voided && new Date(t.createdAt) >= cutoff)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
