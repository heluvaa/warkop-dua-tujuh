import { getItem, setItem, generateId, STORAGE_KEYS } from './db';
import type { KasbonEntry } from '../types';
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
// punya transactionId (dibuat otomatis saat lunasiKasbon), transaksi
// pemasukan terkait di Laporan ikut diperbarui item & totalnya supaya tetap
// sinkron dengan Buku Kasbon.
export async function updateKasbon(
  id: string,
  data: Partial<Pick<KasbonEntry, 'customerName' | 'items' | 'total'>>
): Promise<void> {
  const all = await getAllKasbon();
  const entry = all.find((k) => k.id === id);
  const updated = all.map((k) => (k.id === id ? { ...k, ...data } : k));
  await setItem(STORAGE_KEYS.KASBON, updated);

  if (entry?.status === 'lunas' && entry.transactionId && (data.items || data.total !== undefined)) {
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
// transaksi pemasukan hasil pelunasannya, supaya Laporan tidak mencatat
// pemasukan untuk kasbon yang sudah tidak ada lagi di Buku Kasbon.
export async function deleteKasbon(id: string): Promise<void> {
  const all = await getAllKasbon();
  const entry = all.find((k) => k.id === id);
  await setItem(
    STORAGE_KEYS.KASBON,
    all.filter((k) => k.id !== id)
  );

  if (entry?.status === 'lunas' && entry.transactionId) {
    await voidTransaction(entry.transactionId, 'Kasbon dihapus dari Buku Kasbon');
  }
}

// Menandai kasbon lunas DAN otomatis mencatatnya sebagai pemasukan hari ini
// lewat createTransaction, sesuai requirement.
export async function lunasiKasbon(id: string): Promise<void> {
  const all = await getAllKasbon();
  const entry = all.find((k) => k.id === id);
  if (!entry) return;

  const trx = await createTransaction({
    items: entry.items.map((i) => ({
      menuItemId: '',
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      variantLabel: i.variantLabel,
    })),
    total: entry.total,
    paymentMethod: 'cash',
    source: 'kasbon_lunas',
  });

  const updated = all.map((k) =>
    k.id === id
      ? { ...k, status: 'lunas' as const, paidAt: new Date().toISOString(), transactionId: trx.id }
      : k
  );
  await setItem(STORAGE_KEYS.KASBON, updated);

  const settings = await getSettings();
  if (settings.kasbonPaidNotifyEnabled) {
    await sendNotification(
      `✅ <b>Kasbon Lunas</b>\n${entry.customerName} — ${formatRupiah(entry.total)}`
    );
  }
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
