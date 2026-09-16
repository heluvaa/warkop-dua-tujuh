import type { Transaction, KasbonEntry } from '../types';
import { getAllTransactions } from './transactionService';
import { getAllKasbon } from './kasbonService';
import { currentMonthKey, toMonthKey, todayDateKey, toDateKey } from '../utils/date';

/**
 * Riwayat per pelanggan — bukan entitas tersendiri (tidak ada tabel/ID
 * pelanggan), melainkan agregasi dari nama yang sudah diisi kasir di Kasir
 * (Transaction.customerName) dan Buku Kasbon (KasbonEntry.customerName).
 * Dikelompokkan berdasarkan nama yang dinormalisasi (trim + lowercase) supaya
 * "Budi" dan "budi " dianggap orang yang sama, dengan nama tampilan diambil
 * dari kemunculan TERBARU (biar ikut ejaan/kapitalisasi terakhir yang dipakai
 * kasir, kalau beda-beda).
 */

export function normalizeCustomerName(name: string): string {
  return name.trim().toLowerCase();
}

export interface CustomerSummary {
  // Kunci pengelompokan (dinormalisasi) — dipakai untuk navigasi ke detail.
  key: string;
  // Nama untuk ditampilkan, dari kemunculan paling baru.
  name: string;
  // Total belanja langsung yang sudah dibayar di Kasir (Transaction dengan
  // source 'pos'/'pending_paid', tidak termasuk yang di-void). Transaksi
  // hasil pelunasan kasbon (source 'kasbon_lunas') SENGAJA tidak dihitung di
  // sini karena tidak membawa customerName (lihat lunasiKasbon) dan supaya
  // tidak dobel dengan totalKasbonLunas di bawah.
  totalBelanja: number;
  transactionCount: number;
  // Ringkasan Buku Kasbon untuk pelanggan ini.
  totalKasbonBelumLunas: number;
  kasbonBelumLunasCount: number;
  totalKasbonLunas: number;
  kasbonLunasCount: number;
  // Aktivitas paling baru (transaksi ATAU kasbon, mana yang lebih baru) —
  // dipakai untuk urutan daftar pelanggan.
  lastActivityAt: string;
  // Aktivitas PALING AWAL (transaksi ATAU kasbon, mana yang lebih lama) —
  // dipakai untuk hitung "pelanggan baru bulan ini" di ringkasan halaman
  // Pelanggan (lihat getCustomerReportSummary di bawah).
  firstActivityAt: string;
}

export interface CustomerDetail extends CustomerSummary {
  transactions: Transaction[];
  kasbon: KasbonEntry[];
}

interface Accumulator extends CustomerSummary {
  transactions: Transaction[];
  kasbon: KasbonEntry[];
}

async function buildCustomerMap(): Promise<Map<string, Accumulator>> {
  const [transactions, kasbon] = await Promise.all([getAllTransactions(), getAllKasbon()]);
  const map = new Map<string, Accumulator>();

  function getOrCreate(rawName: string, createdAt: string): Accumulator {
    const key = normalizeCustomerName(rawName);
    const existing = map.get(key);
    if (existing) {
      // Nama tampilan ikut nama dari kejadian yang lebih baru.
      if (new Date(createdAt).getTime() >= new Date(existing.lastActivityAt).getTime()) {
        existing.name = rawName.trim();
        existing.lastActivityAt = createdAt;
      }
      if (new Date(createdAt).getTime() < new Date(existing.firstActivityAt).getTime()) {
        existing.firstActivityAt = createdAt;
      }
      return existing;
    }
    const fresh: Accumulator = {
      key,
      name: rawName.trim(),
      totalBelanja: 0,
      transactionCount: 0,
      totalKasbonBelumLunas: 0,
      kasbonBelumLunasCount: 0,
      totalKasbonLunas: 0,
      kasbonLunasCount: 0,
      lastActivityAt: createdAt,
      firstActivityAt: createdAt,
      transactions: [],
      kasbon: [],
    };
    map.set(key, fresh);
    return fresh;
  }

  for (const t of transactions) {
    if (t.voided) continue;
    if (!t.customerName?.trim()) continue;
    if (t.source !== 'pos' && t.source !== 'pending_paid') continue;
    const acc = getOrCreate(t.customerName, t.createdAt);
    acc.totalBelanja += t.total;
    acc.transactionCount += 1;
    acc.transactions.push(t);
  }

  for (const k of kasbon) {
    if (!k.customerName?.trim()) continue;
    const acc = getOrCreate(k.customerName, k.createdAt);
    acc.kasbon.push(k);
    if (k.status === 'lunas') {
      acc.totalKasbonLunas += k.total;
      acc.kasbonLunasCount += 1;
    } else {
      acc.totalKasbonBelumLunas += k.total;
      acc.kasbonBelumLunasCount += 1;
    }
  }

  return map;
}

// Daftar ringkas semua pelanggan, urut dari yang paling baru beraktivitas.
export async function getAllCustomerSummaries(): Promise<CustomerSummary[]> {
  const map = await buildCustomerMap();
  return Array.from(map.values())
    .map(({ transactions, kasbon, ...summary }) => summary)
    .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
}

export interface CustomerReportSummary {
  // Jumlah pelanggan unik (dari nama yang sudah dinormalisasi) yang pernah
  // tercatat, baik lewat transaksi Kasir maupun Kasbon.
  totalPelanggan: number;
  // Pelanggan unik yang punya aktivitas (transaksi Kasir ATAU Kasbon) hari
  // ini. Dihitung dari lastActivityAt karena kalau seorang pelanggan punya
  // aktivitas hari ini, itu otomatis jadi aktivitas TERBARUNYA (tidak ada
  // aktivitas yang tanggalnya di masa depan) — jadi cukup cek lastActivityAt,
  // tidak perlu simpan daftar semua tanggal aktivitas per pelanggan.
  pelangganHariIni: number;
  // Pelanggan yang aktivitas PERTAMA-nya (firstActivityAt) jatuh di bulan
  // berjalan — dipakai sebagai proxy "pelanggan baru", karena app ini tidak
  // punya tanggal registrasi pelanggan sungguhan (pelanggan bukan entitas
  // tersendiri, lihat komentar di atas).
  pelangganBaruBulanIni: number;
  // Rata-rata total belanja (Kasir, bukan kasbon) per pelanggan yang
  // PERNAH belanja langsung (transactionCount > 0) — pelanggan yang cuma
  // punya catatan kasbon tanpa transaksi Kasir tidak ikut jadi pembagi,
  // supaya angkanya tidak tertarik turun oleh pelanggan yang totalBelanja-nya
  // memang 0.
  rataRataBelanja: number;
}

// Ringkasan untuk kartu di atas halaman Pelanggan (lihat app/pelanggan/page.tsx).
export async function getCustomerReportSummary(): Promise<CustomerReportSummary> {
  const summaries = await getAllCustomerSummaries();
  const today = todayDateKey();
  const thisMonth = currentMonthKey();

  const totalPelanggan = summaries.length;
  const pelangganHariIni = summaries.filter(
    (c) => toDateKey(new Date(c.lastActivityAt)) === today
  ).length;
  const pelangganBaruBulanIni = summaries.filter(
    (c) => toMonthKey(new Date(c.firstActivityAt)) === thisMonth
  ).length;

  const spenders = summaries.filter((c) => c.transactionCount > 0);
  const rataRataBelanja =
    spenders.length > 0
      ? Math.round(spenders.reduce((sum, c) => sum + c.totalBelanja, 0) / spenders.length)
      : 0;

  return { totalPelanggan, pelangganHariIni, pelangganBaruBulanIni, rataRataBelanja };
}

// Detail satu pelanggan (dicari lewat nama, dinormalisasi) — termasuk daftar
// transaksi & kasbon miliknya, urut dari yang terbaru.
export async function getCustomerDetail(rawName: string): Promise<CustomerDetail | null> {
  const key = normalizeCustomerName(rawName);
  const map = await buildCustomerMap();
  const acc = map.get(key);
  if (!acc) return null;

  const { transactions, kasbon, ...summary } = acc;
  return {
    ...summary,
    transactions: [...transactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    kasbon: [...kasbon].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
  };
}
