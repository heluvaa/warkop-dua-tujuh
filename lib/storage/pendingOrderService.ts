import { getItem, setItem, generateId, STORAGE_KEYS } from './db';
import type {
  PendingOrder,
  PaymentMethod,
  SplitPaymentDetail,
  Transaction,
  KasbonEntry,
  TransactionLineItem,
} from '../types';
import { createTransaction, updateTransaction } from './transactionService';
import { createKasbon } from './kasbonService';
import { getSettings } from './settingsService';
import { sendNotification } from '../notify';
import { formatRupiah } from '../utils/format';
import { nextAutoCustomerName } from '../utils/customerName';

export async function getAllPendingOrders(): Promise<PendingOrder[]> {
  return getItem<PendingOrder[]>(STORAGE_KEYS.PENDING_ORDERS, []);
}

// Hapus SELURUH pesanan belum bayar — dipakai fitur reset data laporan,
// lihat clearAllTransactions di transactionService.ts untuk konteks yang sama.
export async function clearAllPendingOrders(): Promise<void> {
  await setItem(STORAGE_KEYS.PENDING_ORDERS, []);
}

export async function createPendingOrder(
  data: Omit<PendingOrder, 'id' | 'createdAt'>
): Promise<PendingOrder> {
  const all = await getAllPendingOrders();
  const newEntry: PendingOrder = {
    ...data,
    customerName: data.customerName?.trim() || nextAutoCustomerName(all.map((p) => p.customerName)),
    id: generateId('pending'),
    createdAt: new Date().toISOString(),
  };
  await setItem(STORAGE_KEYS.PENDING_ORDERS, [...all, newEntry]);

  const settings = await getSettings();
  if (settings.pendingOrderNotifyEnabled) {
    const itemLines = newEntry.items.map((i) => `- ${i.name} x${i.quantity}`).join('\n');
    await sendNotification(
      `📝 <b>Pesanan Belum Dibayar</b>${newEntry.customerName ? ` — ${newEntry.customerName}` : ''}\n` +
        `${itemLines}\nTotal: ${formatRupiah(newEntry.total)}`
    );
  }

  return newEntry;
}

// Menambahkan item baru ke pesanan Belum Bayar yang SUDAH ADA — dipakai saat
// pelanggan yang pesanannya belum dibayar nambah pesanan lagi. Baris dengan
// menu + varian + catatan yang PERSIS SAMA digabung quantity-nya, kombinasi
// lain jadi baris baru. Total pesanan otomatis bertambah. Stok TIDAK dipotong
// di sini — itu tanggung jawab pemanggil (lihat AddItemsModal), sama seperti
// pola createPendingOrder di Kasir.
export async function addItemsToPendingOrder(
  id: string,
  newItems: TransactionLineItem[]
): Promise<PendingOrder | undefined> {
  const all = await getAllPendingOrders();
  const idx = all.findIndex((p) => p.id === id);
  if (idx === -1) return undefined;

  const entry = all[idx];
  const mergedItems: TransactionLineItem[] = entry.items.map((i) => ({ ...i }));
  for (const item of newItems) {
    const existing = mergedItems.find(
      (i) =>
        i.menuItemId === item.menuItemId &&
        i.variantLabel === item.variantLabel &&
        i.note === item.note
    );
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      mergedItems.push({ ...item });
    }
  }

  const addedTotal = newItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const updated: PendingOrder = { ...entry, items: mergedItems, total: entry.total + addedTotal };
  const nextAll = [...all];
  nextAll[idx] = updated;
  await setItem(STORAGE_KEYS.PENDING_ORDERS, nextAll);
  return updated;
}

// Mengganti daftar item pesanan Belum Bayar dengan versi yang sudah
// dikoreksi kasir lewat EditItemsModal (qty diubah dan/atau ada baris yang
// dihapus karena salah pesan). Total dihitung ulang dari daftar item baru.
// Stok TIDAK disesuaikan di sini — itu tanggung jawab pemanggil (lihat
// EditItemsModal), sama seperti pola addItemsToPendingOrder di atas.
export async function updatePendingOrderItems(
  id: string,
  items: TransactionLineItem[]
): Promise<PendingOrder | undefined> {
  const all = await getAllPendingOrders();
  const idx = all.findIndex((p) => p.id === id);
  if (idx === -1) return undefined;

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const updated: PendingOrder = { ...all[idx], items, total };
  const nextAll = [...all];
  nextAll[idx] = updated;
  await setItem(STORAGE_KEYS.PENDING_ORDERS, nextAll);
  return updated;
}

// Mengubah nama pelanggan pada pesanan Belum Bayar yang sudah ada — dipakai
// saat kasir mau mengoreksi nama yang salah ketik, atau mengganti nama
// otomatis "Pelanggan N" begitu tahu nama aslinya.
export async function updatePendingOrderCustomerName(
  id: string,
  customerName: string
): Promise<PendingOrder | undefined> {
  const all = await getAllPendingOrders();
  const idx = all.findIndex((p) => p.id === id);
  if (idx === -1) return undefined;

  const updated: PendingOrder = { ...all[idx], customerName: customerName.trim() };
  const nextAll = [...all];
  nextAll[idx] = updated;
  await setItem(STORAGE_KEYS.PENDING_ORDERS, nextAll);
  return updated;
}

async function takePendingOrder(id: string): Promise<PendingOrder | undefined> {
  const all = await getAllPendingOrders();
  const entry = all.find((p) => p.id === id);
  if (!entry) return undefined;
  await setItem(
    STORAGE_KEYS.PENDING_ORDERS,
    all.filter((p) => p.id !== id)
  );
  return entry;
}

// Menandai pesanan belum bayar sebagai SUDAH DIBAYAR — otomatis mencatatnya
// sebagai transaksi pemasukan (langsung ikut ke Laporan), lalu pesanan ini
// hilang dari daftar Belum Bayar. Stok TIDAK dipotong lagi di sini karena
// sudah terpotong saat pesanan pertama kali dibuat di Kasir.
export async function markPendingOrderPaid(
  id: string,
  method: Exclude<PaymentMethod, 'split'>,
  cashReceived?: number
): Promise<Transaction | undefined> {
  const entry = await takePendingOrder(id);
  if (!entry) return undefined;

  return createTransaction({
    items: entry.items,
    total: entry.total,
    paymentMethod: method,
    cashReceived,
    change: cashReceived !== undefined ? cashReceived - entry.total : undefined,
    source: 'pending_paid',
    operatorName: entry.operatorName,
    customerName: entry.customerName,
  });
}

// Melunasi pesanan Belum Bayar dengan pembayaran yang DIPECAH — sebagian
// cash/QRIS diterima sekarang (dicatat jadi Transaction seperti biasa),
// sisanya (splitDetail.kasbon) langsung dicatat sebagai KasbonEntry baru,
// atas nama pelanggan pesanan ini (atau kasbonCustomerName kalau pesanan
// belum ada namanya). Beda dari movePendingOrderToKasbon: di sini sebagian
// nominal sudah benar-benar diterima, bukan seluruhnya jadi utang.
export async function settlePendingOrderSplit(
  id: string,
  splitDetail: SplitPaymentDetail,
  kasbonCustomerName?: string
): Promise<{ transaction?: Transaction; kasbon?: KasbonEntry } | undefined> {
  const entry = await takePendingOrder(id);
  if (!entry) return undefined;

  const collected = splitDetail.cash + splitDetail.qris;
  let transaction: Transaction | undefined;
  if (collected > 0) {
    transaction = await createTransaction({
      items: entry.items,
      total: collected,
      paymentMethod: 'split',
      splitDetail,
      source: 'pending_paid',
      operatorName: entry.operatorName,
      customerName: entry.customerName,
    });
  }

  let kasbon: KasbonEntry | undefined;
  if (splitDetail.kasbon > 0) {
    const name = (kasbonCustomerName || entry.customerName || '').trim();
    kasbon = await createKasbon({
      customerName: name,
      items: entry.items.map((i) => ({
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        variantLabel: i.variantLabel,
      })),
      total: splitDetail.kasbon,
      originTransactionId: transaction?.id,
    });
    if (transaction) {
      await updateTransaction(transaction.id, { linkedKasbonId: kasbon.id });
    }
  }

  return { transaction, kasbon };
}

// Memindahkan pesanan yang TIDAK dibayar sama sekali ke Buku Kasbon (jadi
// utang pelanggan yang ditagih belakangan). Nama pelanggan wajib diisi di
// sini kalau pesanan belum punya nama, karena KasbonEntry butuh itu untuk
// ditagih. Stok TIDAK dikembalikan — makanan/minumannya sudah terlanjur
// dibuat & diantar, cuma belum dibayar.
export async function movePendingOrderToKasbon(
  id: string,
  customerName: string
): Promise<KasbonEntry | undefined> {
  const entry = await takePendingOrder(id);
  if (!entry) return undefined;

  return createKasbon({
    customerName,
    items: entry.items.map((i) => ({
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      variantLabel: i.variantLabel,
    })),
    total: entry.total,
  });
}

// Membatalkan pesanan belum bayar (mis. salah input di Kasir). TIDAK
// mengembalikan stok di sini — itu tanggung jawab pemanggil (lihat halaman
// Belum Bayar) karena service ini tidak perlu tahu detail menu, sama
// seperti pola voidTransaction di transactionService.
export async function deletePendingOrder(id: string): Promise<void> {
  await takePendingOrder(id);
}

export async function getPendingOrdersTotal(): Promise<number> {
  const all = await getAllPendingOrders();
  return all.reduce((sum, p) => sum + p.total, 0);
}
