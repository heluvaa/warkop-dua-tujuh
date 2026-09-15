import type { Transaction, KasbonEntry } from '../types';
import { getAllTransactions } from './transactionService';
import { getAllKasbon } from './kasbonService';

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
