import { getItem, setItem, generateId, STORAGE_KEYS } from './db';
import type { MenuItem } from '../types';
import { LOW_STOCK_THRESHOLD } from '../constants';
import { sendNotification } from '../notify';
import { getSettings } from './settingsService';

export async function getAllMenu(): Promise<MenuItem[]> {
  return getItem<MenuItem[]>(STORAGE_KEYS.MENU, []);
}

export async function getMenuById(id: string): Promise<MenuItem | undefined> {
  const all = await getAllMenu();
  return all.find((m) => m.id === id);
}

export async function createMenuItem(
  data: Omit<MenuItem, 'id' | 'createdAt'>
): Promise<MenuItem> {
  const all = await getAllMenu();
  const newItem: MenuItem = {
    ...data,
    id: generateId('menu'),
    createdAt: new Date().toISOString(),
  };
  await setItem(STORAGE_KEYS.MENU, [...all, newItem]);
  return newItem;
}

export async function updateMenuItem(id: string, data: Partial<MenuItem>): Promise<void> {
  const all = await getAllMenu();
  const updated = all.map((m) => (m.id === id ? { ...m, ...data } : m));
  await setItem(STORAGE_KEYS.MENU, updated);

  if (data.stock !== undefined) {
    const item = updated.find((m) => m.id === id);
    if (item) await checkLowStockNotification(item);
  }
}

export async function deleteMenuItem(id: string): Promise<void> {
  const all = await getAllMenu();
  await setItem(
    STORAGE_KEYS.MENU,
    all.filter((m) => m.id !== id)
  );
}

// Kategori tidak disimpan sebagai entitas terpisah — cuma teks bebas di
// tiap MenuItem, daftar "kategori yang ada" (existingCategories di
// app/menu/page.tsx) selalu diturunkan dari nilai unik yang lagi dipakai
// menu. Konsekuensinya: "edit nama kategori" dan "hapus kategori" sama-sama
// cukup dikerjakan dengan mengganti nilai category di semua menu yang
// memakainya — begitu tidak ada menu lagi yang pakai nama lama, kategori
// itu otomatis hilang dari daftar tanpa perlu langkah "hapus" terpisah.
//
// - Rename: renameCategory(from, to) dengan `to` nama baru yang belum ada.
// - Delete: renameCategory(from, to) dengan `to` = kategori LAIN yang sudah
//   ada (menu-menunya dipindah ke situ) — lihat CategoryManagerModal.
// Kalau `to` kebetulan sama dengan kategori lain yang sudah ada, otomatis
// tergabung ke situ (dipakai juga oleh alur delete-dengan-pindah).
export async function renameCategory(from: string, to: string): Promise<number> {
  const trimmedTo = to.trim();
  if (!trimmedTo || trimmedTo === from) return 0;

  const all = await getAllMenu();
  let count = 0;
  const updated = all.map((m) => {
    if (m.category !== from) return m;
    count += 1;
    return { ...m, category: trimmedTo };
  });
  if (count > 0) await setItem(STORAGE_KEYS.MENU, updated);
  return count;
}

export async function decrementStock(id: string, qty: number): Promise<void> {
  const all = await getAllMenu();
  const updated = all.map((m) => (m.id === id ? { ...m, stock: Math.max(0, m.stock - qty) } : m));
  await setItem(STORAGE_KEYS.MENU, updated);

  const item = updated.find((m) => m.id === id);
  if (item) await checkLowStockNotification(item);
}

// Kebalikan dari decrementStock — dipakai saat transaksi dibatalkan (void)
// supaya stok yang tadi terpotong dikembalikan.
export async function incrementStock(id: string, qty: number): Promise<void> {
  const all = await getAllMenu();
  const updated = all.map((m) => (m.id === id ? { ...m, stock: m.stock + qty } : m));
  await setItem(STORAGE_KEYS.MENU, updated);

  const item = updated.find((m) => m.id === id);
  if (item) await checkLowStockNotification(item);
}

// --- Notifikasi stok menipis ke Telegram --------------------------------
//
// Supaya tidak spam tiap kali ada transaksi baru, tiap menu hanya dikirim
// notifikasi SEKALI selama stoknya masih di bawah/​sama dengan
// LOW_STOCK_THRESHOLD (ID-nya dicatat di STORAGE_KEYS.LOW_STOCK_NOTIFIED).
// Begitu stok diisi ulang di atas ambang batas, ID-nya dilepas dari daftar
// supaya bisa notifikasi lagi kalau nanti menipis lagi.

async function getNotifiedLowStockIds(): Promise<string[]> {
  return getItem<string[]>(STORAGE_KEYS.LOW_STOCK_NOTIFIED, []);
}

async function setNotifiedLowStockIds(ids: string[]): Promise<void> {
  await setItem(STORAGE_KEYS.LOW_STOCK_NOTIFIED, ids);
}

async function checkLowStockNotification(item: MenuItem): Promise<void> {
  const isLow = item.stock <= LOW_STOCK_THRESHOLD;
  const notified = await getNotifiedLowStockIds();
  const alreadyNotified = notified.includes(item.id);

  if (isLow && !alreadyNotified) {
    const settings = await getSettings();
    if (settings.lowStockNotifyEnabled) {
      const label = item.stock === 0 ? 'HABIS' : `tersisa ${item.stock}`;
      await sendNotification(
        `⚠️ <b>Stok Menipis</b>\n${item.name} (${item.category}) ${label}.`
      );
    }
    await setNotifiedLowStockIds([...notified, item.id]);
  } else if (!isLow && alreadyNotified) {
    await setNotifiedLowStockIds(notified.filter((existingId) => existingId !== item.id));
  }
}

// Menandai/melepas menu sebagai favorit — dipakai di Kasir supaya item yang
// sering dipesan pinned di bagian atas grid dan gak perlu dicari lagi.
export async function toggleFavorite(id: string): Promise<void> {
  const all = await getAllMenu();
  const updated = all.map((m) => (m.id === id ? { ...m, isFavorite: !m.isFavorite } : m));
  await setItem(STORAGE_KEYS.MENU, updated);
}

// Mengisi beberapa menu contoh di percobaan pertama supaya halaman Kasir
// tidak kosong. Tidak melakukan apa-apa jika sudah ada data.
export async function seedMenuIfEmpty(): Promise<void> {
  const all = await getAllMenu();
  if (all.length > 0) return;

  const seed: Omit<MenuItem, 'id' | 'createdAt'>[] = [
    { name: 'Kopi Hitam', price: 8000, hpp: 2000, category: 'Kopi', stock: 20 },
    { name: 'Kopi Susu Gula Aren', price: 12000, hpp: 4500, category: 'Kopi', stock: 20 },
    { name: 'Es Teh Manis', price: 5000, hpp: 1500, category: 'Non-Kopi', stock: 30 },
    { name: 'Es Jeruk', price: 6000, hpp: 2500, category: 'Non-Kopi', stock: 15 },
    { name: 'Indomie Goreng', price: 10000, hpp: 5500, category: 'Makanan', stock: 12 },
    { name: 'Roti Bakar Coklat Keju', price: 13000, hpp: 6000, category: 'Makanan', stock: 4 },
  ];

  for (const item of seed) {
    await createMenuItem(item);
  }
}
