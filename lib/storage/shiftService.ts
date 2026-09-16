/**
 * Shift laci kas — dibuka dengan modal awal, ditutup dengan menghitung uang
 * fisik dan membandingkannya dengan catatan sistem (modal awal + penjualan
 * cash - pengeluaran). Selisihnya dicatat supaya kelihatan kalau ada kas
 * yang kurang/lebih.
 *
 * Beda dari "sesi login kasir" di operatorService.ts: shift di sini adalah
 * data WARUNG (ikut Supabase kalau sudah dikonfigurasi, dibagi ke semua
 * device), bukan status per-device. Satu shift bisa dipakai bergantian oleh
 * beberapa kasir (ganti kasir di tengah hari tidak otomatis tutup shift) —
 * lihat komentar di ShiftEntry pada lib/types.ts.
 */

import { getItem, setItem, generateId, STORAGE_KEYS } from './db';
import type { ShiftEntry } from '../types';
import { getAllTransactions, getCashAmount, getQrisAmount } from './transactionService';
import { getAllPengeluaran } from './pengeluaranService';
import { getSettings } from './settingsService';
import { sendNotification } from '../notify';
import { formatRupiah } from '../utils/format';

export async function getAllShifts(): Promise<ShiftEntry[]> {
  return getItem<ShiftEntry[]>(STORAGE_KEYS.SHIFTS, []);
}

// Hapus SELURUH riwayat shift (termasuk shift yang sedang berjalan kalau
// ada) — dipakai fitur reset data laporan, lihat clearAllTransactions di
// transactionService.ts untuk konteks yang sama. Setelah ini status shift
// kembali "belum dibuka", jadi kasir perlu buka shift baru untuk lanjut jualan.
export async function clearAllShifts(): Promise<void> {
  await setItem(STORAGE_KEYS.SHIFTS, []);
}

// Riwayat shift, terbaru dulu — dipakai untuk daftar di halaman Laporan.
export async function getShiftHistory(): Promise<ShiftEntry[]> {
  const all = await getAllShifts();
  return [...all].sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
}

// Hanya ada maksimal SATU shift yang statusnya 'open' di satu waktu —
// mewakili satu laci kas yang sedang dipakai jualan.
export async function getActiveShift(): Promise<ShiftEntry | null> {
  const all = await getAllShifts();
  return all.find((s) => s.status === 'open') ?? null;
}

export async function openShift(data: {
  operatorId: string;
  operatorName: string;
  modalAwal: number;
}): Promise<ShiftEntry> {
  // Jaga-jaga kalau tombol dipencet dobel / dipanggil ulang — jangan sampai
  // ada dua shift 'open' bersamaan, kembalikan yang sudah ada saja.
  const existing = await getActiveShift();
  if (existing) return existing;

  const all = await getAllShifts();
  const newShift: ShiftEntry = {
    ...data,
    id: generateId('shift'),
    openedAt: new Date().toISOString(),
    status: 'open',
  };
  await setItem(STORAGE_KEYS.SHIFTS, [...all, newShift]);

  const settings = await getSettings();
  if (settings.shiftCashNotifyEnabled) {
    await sendNotification(
      `🟢 <b>Shift Dibuka</b>\n${newShift.operatorName}\nModal awal: ${formatRupiah(newShift.modalAwal)}`
    );
  }

  return newShift;
}

export interface ShiftCashSummary {
  cashSalesTotal: number;
  qrisSalesTotal: number;
  pengeluaranTotal: number;
  // modalAwal + cashSalesTotal - pengeluaranTotal.
  systemCash: number;
}

// Hitung ringkasan kas suatu shift dari transaksi & pengeluaran yang
// terjadi selama openedAt..until (default: sekarang). Dipakai baik untuk
// pratinjau LIVE saat kasir masih menghitung uang fisik (belum ditutup),
// maupun untuk snapshot final saat closeShift() dipanggil.
export async function getShiftCashSummary(
  shift: Pick<ShiftEntry, 'openedAt' | 'modalAwal'>,
  until: Date = new Date()
): Promise<ShiftCashSummary> {
  const openedAtMs = new Date(shift.openedAt).getTime();
  const untilMs = until.getTime();

  const [allTransactions, allPengeluaran] = await Promise.all([
    getAllTransactions(),
    getAllPengeluaran(),
  ]);

  const txInWindow = allTransactions.filter((t) => {
    if (t.voided) return false;
    const ms = new Date(t.createdAt).getTime();
    return ms >= openedAtMs && ms <= untilMs;
  });
  const pengeluaranInWindow = allPengeluaran.filter((e) => {
    const ms = new Date(e.createdAt).getTime();
    return ms >= openedAtMs && ms <= untilMs;
  });

  const cashSalesTotal = txInWindow.reduce((sum, t) => sum + getCashAmount(t), 0);
  const qrisSalesTotal = txInWindow.reduce((sum, t) => sum + getQrisAmount(t), 0);
  const pengeluaranTotal = pengeluaranInWindow.reduce((sum, e) => sum + e.amount, 0);
  const systemCash = shift.modalAwal + cashSalesTotal - pengeluaranTotal;

  return { cashSalesTotal, qrisSalesTotal, pengeluaranTotal, systemCash };
}

export async function closeShift(data: {
  shiftId: string;
  physicalCash: number;
  note?: string;
  closedByOperatorId: string;
  closedByOperatorName: string;
}): Promise<ShiftEntry | null> {
  const all = await getAllShifts();
  const shift = all.find((s) => s.id === data.shiftId);
  if (!shift || shift.status !== 'open') return null;

  const closedAt = new Date();
  const summary = await getShiftCashSummary(shift, closedAt);
  const selisih = data.physicalCash - summary.systemCash;

  const updatedShift: ShiftEntry = {
    ...shift,
    status: 'closed',
    closedAt: closedAt.toISOString(),
    closedByOperatorId: data.closedByOperatorId,
    closedByOperatorName: data.closedByOperatorName,
    cashSalesTotal: summary.cashSalesTotal,
    qrisSalesTotal: summary.qrisSalesTotal,
    pengeluaranTotal: summary.pengeluaranTotal,
    systemCash: summary.systemCash,
    physicalCash: data.physicalCash,
    selisih,
    note: data.note?.trim() || undefined,
  };

  await setItem(
    STORAGE_KEYS.SHIFTS,
    all.map((s) => (s.id === shift.id ? updatedShift : s))
  );

  const settings = await getSettings();
  if (settings.shiftCashNotifyEnabled) {
    const selisihLabel =
      selisih === 0
        ? 'Pas, tidak ada selisih ✅'
        : selisih > 0
          ? `Lebih ${formatRupiah(selisih)}`
          : `Kurang ${formatRupiah(Math.abs(selisih))} ⚠️`;
    await sendNotification(
      `🔴 <b>Shift Ditutup</b>\n${updatedShift.closedByOperatorName}\n` +
        `Modal awal: ${formatRupiah(updatedShift.modalAwal)}\n` +
        `Kas sistem: ${formatRupiah(summary.systemCash)}\n` +
        `Kas fisik: ${formatRupiah(data.physicalCash)}\n` +
        `Selisih: ${selisihLabel}` +
        (updatedShift.note ? `\nCatatan: ${updatedShift.note}` : '')
    );
  }

  return updatedShift;
}
