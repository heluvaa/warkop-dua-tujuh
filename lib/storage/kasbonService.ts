import { getItem, setItem, generateId, STORAGE_KEYS } from './db';
import type { KasbonEntry, KasbonPayment } from '../types';
import { createTransaction, updateTransaction, voidTransaction } from './transactionService';
import { getSettings } from './settingsService';
import { sendNotification } from '../notify';
import { daysSince } from '../utils/date';
import { formatRupiah } from '../utils/format';
import { KASBON_OVERDUE_DAYS } from '../constants';

export async function getAllKasbon(): Promise<KasbonEntry[]> {
  return getItem<KasbonEntry[]>(STORAGE_KEYS.KASBON, []);
}

// Hapus SELURUH riwayat kasbon — dipakai fitur reset data laporan, lihat
// clearAllTransactions di transactionService.ts untuk konteks yang sama.
export async function clearAllKasbon(): Promise<void> {
  await setItem(STORAGE_KEYS.KASBON, []);
  // Sekalian bersihkan daftar ID yang pernah dinotifikasi jatuh tempo, biar
  // tidak ada sisa ID basi yang mengacu ke kasbon yang sudah dihapus.
  await setItem(STORAGE_KEYS.KASBON_OVERDUE_NOTIFIED, []);
}

// Total yang sudah dibayar (cicilan + pelunasan) untuk satu kasbon. Kasbon
// lama (dibuat sebelum fitur cicilan ada) tidak punya `payments`, tapi kalau
// statusnya sudah 'lunas' dianggap sudah dibayar penuh (total-nya) —
// supaya tetap konsisten tanpa perlu migrasi data.
export function getKasbonAmountPaid(entry: Pick<KasbonEntry, 'total' | 'status' | 'payments'>): number {
  if (entry.payments && entry.payments.length > 0) {
    return entry.payments.reduce((sum, p) => sum + p.amount, 0);
  }
  return entry.status === 'lunas' ? entry.total : 0;
}

// Sisa yang belum dibayar — tidak pernah negatif.
export function getKasbonSisa(entry: Pick<KasbonEntry, 'total' | 'status' | 'payments'>): number {
  return Math.max(0, entry.total - getKasbonAmountPaid(entry));
}

export async function createKasbon(
  data: Omit<KasbonEntry, 'id' | 'createdAt' | 'status'>
): Promise<KasbonEntry> {
  const all = await getAllKasbon();
  const newEntry: KasbonEntry = {
    ...data,
    id: generateId('kasbon'),
    status: 'belum_lunas',
    createdAt: new Date().toISOString(),
  };
  await setItem(STORAGE_KEYS.KASBON, [...all, newEntry]);

  const settings = await getSettings();
  if (settings.kasbonCreatedNotifyEnabled) {
    const itemLines = newEntry.items.map((i) => `- ${i.name} x${i.quantity}`).join('\n');
    await sendNotification(
      `🧾 <b>Kasbon Baru</b>\n${newEntry.customerName}\n${itemLines}\nTotal: ${formatRupiah(newEntry.total)}`
    );
  }

  return newEntry;
}

// Edit kasbon juga boleh dilakukan setelah lunas. Kalau kasbon itu sudah
// punya transactionId (dibuat otomatis saat lunasiKasbon) DAN cuma dibayar
// dalam satu kali transaksi (bukan dicicil beberapa kali), transaksi
// pemasukan terkait di Laporan ikut diperbarui item & totalnya supaya tetap
// sinkron dengan Buku Kasbon. Kalau sudah dicicil lebih dari sekali, sinkron
// otomatis ini SENGAJA dilewati — item/total sudah terpecah ke beberapa
// Transaction terpisah (satu per cicilan), jadi tidak ada satu transaksi
// tunggal yang bisa ditimpa dengan aman tanpa salah catat.
export async function updateKasbon(
  id: string,
  data: Partial<Pick<KasbonEntry, 'customerName' | 'items' | 'total'>>
): Promise<void> {
  const all = await getAllKasbon();
  const entry = all.find((k) => k.id === id);
  const updated = all.map((k) => (k.id === id ? { ...k, ...data } : k));
  await setItem(STORAGE_KEYS.KASBON, updated);

  const paymentCount = entry?.payments?.length ?? 0;
  if (
    entry?.status === 'lunas' &&
    entry.transactionId &&
    paymentCount <= 1 &&
    (data.items || data.total !== undefined)
  ) {
    const trxPatch: Parameters<typeof updateTransaction>[1] = {};
    if (data.items) {
      trxPatch.items = data.items.map((i) => ({
        menuItemId: '',
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        variantLabel: i.variantLabel,
      }));
    }
    if (data.total !== undefined) {
      trxPatch.total = data.total;
    }
    await updateTransaction(entry.transactionId, trxPatch);
  }
}

// Hapus kasbon yang sudah lunas juga membatalkan (void, bukan menghapus)
// SEMUA transaksi pemasukan hasil pembayarannya (bisa lebih dari satu kalau
// dicicil), supaya Laporan tidak mencatat pemasukan untuk kasbon yang sudah
// tidak ada lagi di Buku Kasbon.
export async function deleteKasbon(id: string): Promise<void> {
  const all = await getAllKasbon();
  const entry = all.find((k) => k.id === id);
  await setItem(
    STORAGE_KEYS.KASBON,
    all.filter((k) => k.id !== id)
  );

  if (!entry) return;

  // Kumpulkan semua transactionId yang pernah dibuat untuk kasbon ini:
  // dari payments[] (cicilan/pelunasan lewat fitur baru) DAN transactionId
  // legacy di level entry (kasbon lama, dari sebelum fitur cicilan ada) —
  // pakai Set supaya tidak void transaksi yang sama dua kali kalau kebetulan
  // keduanya menunjuk ID yang sama.
  const txIds = new Set<string>();
  for (const p of entry.payments ?? []) txIds.add(p.transactionId);
  if (entry.status === 'lunas' && entry.transactionId) txIds.add(entry.transactionId);

  for (const txId of txIds) {
    await voidTransaction(txId, 'Kasbon dihapus dari Buku Kasbon');
  }
}

// Bayar kasbon secara PENUH atau SEBAGIAN (cicilan). `amount` di-clamp ke
// rentang (0, sisa] — kalau sisa sudah 0 (kasbon sudah lunas) atau amount
// <= 0, tidak melakukan apa-apa. Tiap pemanggilan membuat satu Transaction
// pemasukan baru (source 'kasbon_lunas', sama seperti pelunasan penuh
// sebelumnya) sebesar `amount` itu saja — BUKAN sebesar total kasbon —
// supaya Laporan tetap akurat mencatat kapan & berapa tiap cicilan masuk.
// Status kasbon otomatis berubah jadi 'lunas' begitu total yang sudah
// dibayar (termasuk cicilan sebelumnya) mencapai `total`.
export async function bayarCicilanKasbon(
  id: string,
  amount: number,
  operatorName?: string
): Promise<KasbonEntry | null> {
  const all = await getAllKasbon();
  const entry = all.find((k) => k.id === id);
  if (!entry || entry.status === 'lunas') return null;

  const sisaSebelum = getKasbonSisa(entry);
  const bayar = Math.min(Math.round(amount), sisaSebelum);
  if (bayar <= 0) return null;

  const isPelunasanPenuh = bayar >= sisaSebelum;
  // Cicilan sebagian dicatat sebagai satu baris transaksi ringkas (bukan
  // rincian item aslinya) karena satu cicilan belum tentu pas dengan harga
  // satu item tertentu — beda dari pelunasan penuh yang masih membawa
  // rincian item asli seperti sebelumnya (supaya struk/riwayat pelunasan
  // penuh tidak berubah tampilannya untuk kasus paling umum).
  const trx = await createTransaction({
    items: isPelunasanPenuh
      ? entry.items.map((i) => ({
          menuItemId: '',
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          variantLabel: i.variantLabel,
        }))
      : [{ menuItemId: '', name: `Cicilan Kasbon — ${entry.customerName}`, price: bayar, quantity: 1 }],
    total: bayar,
    paymentMethod: 'cash',
    source: 'kasbon_lunas',
    operatorName,
  });

  const payment: KasbonPayment = {
    id: generateId('kasbonpay'),
    amount: bayar,
    paidAt: new Date().toISOString(),
    transactionId: trx.id,
    operatorName,
  };
  const payments = [...(entry.payments ?? []), payment];
  const sisaSesudah = Math.max(0, entry.total - payments.reduce((sum, p) => sum + p.amount, 0));
  const lunasSekarang = sisaSesudah <= 0;

  const updatedEntry: KasbonEntry = {
    ...entry,
    payments,
    transactionId: trx.id,
    status: lunasSekarang ? 'lunas' : 'belum_lunas',
    paidAt: lunasSekarang ? new Date().toISOString() : entry.paidAt,
  };
  await setItem(
    STORAGE_KEYS.KASBON,
    all.map((k) => (k.id === id ? updatedEntry : k))
  );

  const settings = await getSettings();
  if (settings.kasbonPaidNotifyEnabled) {
    if (lunasSekarang) {
      await sendNotification(
        `✅ <b>Kasbon Lunas</b>\n${entry.customerName} — ${formatRupiah(entry.total)}`
      );
    } else {
      await sendNotification(
        `💵 <b>Kasbon Dicicil</b>\n${entry.customerName} — bayar ${formatRupiah(bayar)}\n` +
          `Sisa: ${formatRupiah(sisaSesudah)}`
      );
    }
  }

  return updatedEntry;
}

// Menandai kasbon lunas total sekaligus DAN otomatis mencatatnya sebagai
// pemasukan hari ini — kalau sebelumnya sudah ada cicilan berjalan, ini
// cuma melunasi SISANYA saja (bukan menagih ulang dari total penuh).
export async function lunasiKasbon(id: string): Promise<void> {
  const all = await getAllKasbon();
  const entry = all.find((k) => k.id === id);
  if (!entry) return;
  await bayarCicilanKasbon(id, getKasbonSisa(entry));
}

// --- Notifikasi kasbon jatuh tempo ke Telegram ---------------------------
//
// Sama seperti notifikasi stok menipis: tiap kasbon yang sudah jatuh tempo
// hanya dikirim notifikasi SEKALI (ID-nya dicatat di
// STORAGE_KEYS.KASBON_OVERDUE_NOTIFIED), tidak berulang tiap kali halaman
// Kasbon dibuka. Begitu kasbon itu dilunasi (atau sudah tidak jatuh tempo
// lagi), ID-nya dilepas dari daftar.
//
// Dipanggil dari halaman Kasbon setiap kali datanya di-refresh.
export async function checkOverdueKasbonNotifications(): Promise<void> {
  const settings = await getSettings();
  if (!settings.kasbonOverdueNotifyEnabled) return;

  const all = await getAllKasbon();
  const notified = await getItem<string[]>(STORAGE_KEYS.KASBON_OVERDUE_NOTIFIED, []);

  const overdueNow = all.filter(
    (k) => k.status === 'belum_lunas' && daysSince(k.createdAt) >= KASBON_OVERDUE_DAYS
  );

  for (const entry of overdueNow) {
    if (!notified.includes(entry.id)) {
      await sendNotification(
        `⏰ <b>Kasbon Jatuh Tempo</b>\n${entry.customerName} — ${formatRupiah(entry.total)} ` +
          `(belum lunas ${daysSince(entry.createdAt)} hari).`
      );
    }
  }

  // Simpan ulang daftar notified: hanya ID yang masih jatuh tempo sekarang
  // yang dipertahankan — sisanya (sudah lunas, atau entry-nya sudah hilang)
  // otomatis lepas dari daftar.
  const overdueIds = overdueNow.map((k) => k.id);
  await setItem(STORAGE_KEYS.KASBON_OVERDUE_NOTIFIED, overdueIds);
}
