/**
 * Shift laci kas — dibuka dengan modal awal, ditutup dengan menghitung uang
 * fisik dan membandingkannya dengan catatan sistem (modal awal + penjualan
 * cash - pengeluaran). Selisihnya dicatat supaya kelihatan kalau ada kas
 * yang kurang/lebih.
 *
 * Beda dari "sesi login kasir" di operatorService.ts: shift di sini adalah
 * data WARUNG (ikut Supabase kalau sudah dikonfigurasi, dibagi ke semua
 * device), bukan status per-device.
 *
 * PER-OPERATOR: tiap akun kasir punya shift & modal awalnya sendiri —
 * bisa ada BEBERAPA shift 'open' bersamaan (satu per operator yang lagi
 * jaga), bukan cuma satu laci bersama untuk seluruh warung. Shift operator A
 * tetap 'open' terus (modal awal tidak ditanya ulang) selama A belum tutup
 * shift-nya sendiri, walau A logout lalu login lagi. Operator lain (B) yang
 * login akan dapat OpenShiftModal miliknya sendiri kalau B belum punya shift
 * 'open'. Konsekuensinya: getShiftCashSummary() HARUS ikut memfilter
 * transaksi/pengeluaran berdasarkan operatorName shift ini (bukan cuma
 * rentang waktu), supaya penjualan operator lain yang shift-nya kebetulan
 * tumpang tindih waktu tidak ikut kehitung dobel di kedua shift.
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

// Shift 'open' MILIK operator ini (kalau ada). Bisa ada shift 'open' lain
// punya operator berbeda di saat yang sama — itu bukan urusan operator ini,
// makanya dicari berdasarkan operatorId, bukan sekadar status === 'open'.
export async function getActiveShift(operatorId: string): Promise<ShiftEntry | null> {
  if (!operatorId) return null;
  const all = await getAllShifts();
  return all.find((s) => s.status === 'open' && s.operatorId === operatorId) ?? null;
}

// Semua shift 'open' saat ini, dari semua operator — dipakai kalau ada
// tampilan ringkasan lintas-kasir (mis. pemilik mau lihat semua laci yang
// lagi jalan bersamaan).
export async function getAllActiveShifts(): Promise<ShiftEntry[]> {
  const all = await getAllShifts();
  return all.filter((s) => s.status === 'open');
}

export async function openShift(data: {
  operatorId: string;
  operatorName: string;
  modalAwal: number;
}): Promise<ShiftEntry> {
  // Jaga-jaga kalau tombol dipencet dobel / dipanggil ulang — jangan sampai
  // operator yang sama punya dua shift 'open' bersamaan, kembalikan yang
  // sudah ada saja. Operator LAIN yang shift-nya kebetulan masih 'open'
  // tidak menghalangi operator ini buka shift barunya sendiri.
  const existing = await getActiveShift(data.operatorId);
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

// Hitung ringkasan kas suatu shift dari transaksi & pengeluaran milik
// OPERATOR shift ini yang terjadi selama openedAt..until (default:
// sekarang). Dipakai baik untuk pratinjau LIVE saat kasir masih menghitung
// uang fisik (belum ditutup), maupun untuk snapshot final saat closeShift()
// dipanggil.
//
// Difilter juga berdasarkan operatorName (bukan cuma rentang waktu) karena
// sekarang bisa ada beberapa shift 'open' bersamaan (satu per operator) —
// tanpa filter ini, transaksi kasir lain yang shift-nya kebetulan tumpang
// tindih waktu akan ikut kehitung dobel di shift ini.
export async function getShiftCashSummary(
  shift: Pick<ShiftEntry, 'openedAt' | 'modalAwal' | 'operatorName'>,
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
    if (t.operatorName !== shift.operatorName) return false;
    const ms = new Date(t.createdAt).getTime();
    return ms >= openedAtMs && ms <= untilMs;
  });
  const pengeluaranInWindow = allPengeluaran.filter((e) => {
    if (e.operatorName !== shift.operatorName) return false;
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
