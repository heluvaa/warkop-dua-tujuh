import { getItem, setItem, generateId, STORAGE_KEYS } from './db';
import type { KasbonEntry } from '../types';
import { createTransaction } from './transactionService';
import { getSettings } from './settingsService';
import { sendTelegramNotification } from '../telegram';
import { daysSince } from '../utils/date';
import { formatRupiah } from '../utils/format';
import { KASBON_OVERDUE_DAYS } from '../constants';

export async function getAllKasbon(): Promise<KasbonEntry[]> {
  return getItem<KasbonEntry[]>(STORAGE_KEYS.KASBON, []);
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
    await sendTelegramNotification(
      `🧾 <b>Kasbon Baru</b>\n${newEntry.customerName}\n${itemLines}\nTotal: ${formatRupiah(newEntry.total)}`
    );
  }

  return newEntry;
}

// Edit/hapus hanya untuk kasbon yang BELUM lunas — begitu lunas, kasbon
// sudah tercatat sebagai transaksi pemasukan (lihat lunasiKasbon), jadi
// mengubah/menghapusnya di sini tidak akan menyentuh catatan transaksi itu.
export async function updateKasbon(
  id: string,
  data: Partial<Pick<KasbonEntry, 'customerName' | 'items' | 'total'>>
): Promise<void> {
  const all = await getAllKasbon();
  const updated = all.map((k) => (k.id === id ? { ...k, ...data } : k));
  await setItem(STORAGE_KEYS.KASBON, updated);
}

export async function deleteKasbon(id: string): Promise<void> {
  const all = await getAllKasbon();
  await setItem(
    STORAGE_KEYS.KASBON,
    all.filter((k) => k.id !== id)
  );
}

// Menandai kasbon lunas DAN otomatis mencatatnya sebagai pemasukan hari ini
// lewat createTransaction, sesuai requirement.
export async function lunasiKasbon(id: string): Promise<void> {
  const all = await getAllKasbon();
  const entry = all.find((k) => k.id === id);
  if (!entry) return;

  const updated = all.map((k) =>
    k.id === id ? { ...k, status: 'lunas' as const, paidAt: new Date().toISOString() } : k
  );
  await setItem(STORAGE_KEYS.KASBON, updated);

  await createTransaction({
    items: entry.items.map((i) => ({ menuItemId: '', name: i.name, price: i.price, quantity: i.quantity })),
    total: entry.total,
    paymentMethod: 'cash',
    source: 'kasbon_lunas',
  });

  const settings = await getSettings();
  if (settings.kasbonPaidNotifyEnabled) {
    await sendTelegramNotification(
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
      await sendTelegramNotification(
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
