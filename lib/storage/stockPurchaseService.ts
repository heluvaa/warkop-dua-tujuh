import { getItem, setItem, generateId, STORAGE_KEYS } from './db';
import type { MenuItem, StockPurchaseEntry, StockPurchaseLineItem } from '../types';
import { getAllMenu, updateMenuItem } from './menuService';
import { createPengeluaran } from './pengeluaranService';

export async function getAllStockPurchases(): Promise<StockPurchaseEntry[]> {
  return getItem<StockPurchaseEntry[]>(STORAGE_KEYS.STOCK_PURCHASES, []);
}

// Hapus SELURUH riwayat pembelian stok — dipakai fitur reset data laporan,
// lihat clearAllTransactions di transactionService.ts untuk konteks yang
// sama. Tidak mengubah stok/HPP menu saat ini, cuma riwayat pembeliannya.
export async function clearAllStockPurchases(): Promise<void> {
  await setItem(STORAGE_KEYS.STOCK_PURCHASES, []);
}

// HPP baru dari satu baris pembelian, pakai rata-rata tertimbang antara
// stok lama (dengan HPP lama) dan stok yang baru masuk (dengan harga beli
// kali ini) — supaya kalau harga bahan naik-turun, HPP menu tidak melompat
// mengikuti pembelian terakhir saja.
//
// Pengecualian: kalau menu belum pernah punya HPP tercatat, atau stok lama
// sudah 0 (stok kosong lalu diisi ulang), rata-rata tidak dipakai — HPP
// baru = harga beli kali ini, sebab tidak ada dasar biaya lama yang valid
// untuk dicampur (mencegah HPP "diencerkan" oleh angka 0 palsu).
function computeWeightedHpp(item: MenuItem, qtyBought: number, unitCost: number): number {
  if (item.hpp === undefined || item.stock <= 0) {
    return Math.round(unitCost);
  }
  const totalValueLama = item.stock * item.hpp;
  const totalValueBaru = qtyBought * unitCost;
  return Math.round((totalValueLama + totalValueBaru) / (item.stock + qtyBought));
}

export async function createStockPurchase(data: {
  items: StockPurchaseLineItem[];
  updateHpp: boolean;
  operatorName?: string;
}): Promise<StockPurchaseEntry> {
  const menu = await getAllMenu();

  for (const line of data.items) {
    const item = menu.find((m) => m.id === line.menuItemId);
    if (!item || line.quantity <= 0) continue;

    const unitCost = line.quantity > 0 ? line.totalCost / line.quantity : 0;
    const patch: Partial<MenuItem> = { stock: item.stock + line.quantity };
    if (data.updateHpp) {
      patch.hpp = computeWeightedHpp(item, line.quantity, unitCost);
    }
    await updateMenuItem(item.id, patch);
  }

  const total = data.items.reduce((sum, i) => sum + i.totalCost, 0);
  const ringkasan = data.items.map((i) => `${i.name} x${i.quantity}`).join(', ');

  // Dicatat juga sebagai pengeluaran biasa supaya otomatis ikut dihitung di
  // Total Pengeluaran & Laba Bersih pada Laporan tanpa perlu ubah logika di
  // sana, dan tetap kena notifikasi Telegram "pengeluaran besar" kalau lewat
  // ambang batas.
  const pengeluaran = await createPengeluaran({
    name: `Belanja Stok: ${ringkasan}`,
    amount: total,
    operatorName: data.operatorName,
  });

  const all = await getAllStockPurchases();
  const entry: StockPurchaseEntry = {
    id: generateId('stockpurchase'),
    items: data.items,
    total,
    updateHpp: data.updateHpp,
    createdAt: new Date().toISOString(),
    operatorName: data.operatorName,
    pengeluaranId: pengeluaran.id,
  };
  await setItem(STORAGE_KEYS.STOCK_PURCHASES, [...all, entry]);
  return entry;
}

// Belanja stok terbaru untuk ditampilkan sebagai riwayat ringkas di halaman
// Manajemen Menu — dibatasi jumlahnya supaya tidak memuat seluruh histori.
export async function getRecentStockPurchases(limit = 10): Promise<StockPurchaseEntry[]> {
  const all = await getAllStockPurchases();
  return [...all]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}
