// Logika balasan perintah bot Telegram (mis. /omzet). Dipanggil oleh
// TelegramCommandListener setiap kali ada pesan baru yang berhasil di-poll
// dari app/api/telegram/updates/route.ts.
//
// CATATAN ARSITEKTUR: seluruh data (transaksi, kasbon, stok, dst) hanya
// tersimpan di localStorage perangkat kasir, bukan di server. Karena itu
// bot ini TIDAK bisa membalas lewat webhook server biasa — ia hanya bisa
// membalas selama ada tab aplikasi kasir yang terbuka di suatu perangkat
// (lihat TelegramCommandListener), karena di situlah data sebenarnya bisa
// diakses untuk dihitung. Untuk pemakaian warkop sehari-hari ini biasanya
// cukup, karena perangkat kasir memang menyala sepanjang jam operasional.

import { getAllKasbon } from './storage/kasbonService';
import { getAllMenu } from './storage/menuService';
import { getPengeluaranByDate } from './storage/pengeluaranService';
import { getTransactionsByDate, getCashAmount, getQrisAmount } from './storage/transactionService';
import { daysSince, todayDateKey } from './utils/date';
import { formatRupiah } from './utils/format';
import { LOW_STOCK_THRESHOLD } from './constants';

// Mengembalikan teks balasan (format HTML Telegram) untuk perintah yang
// dikenali, atau null kalau teks bukan perintah yang didukung (supaya
// pesan biasa/obrolan tidak dibalas apa-apa).
export async function buildCommandReply(rawText: string): Promise<string | null> {
  // Perintah di grup Telegram kadang berformat "/omzet@NamaBot" — buang
  // bagian @NamaBot dan argumen tambahan, cuma ambil kata pertama.
  const command = rawText.trim().split(/\s+/)[0]?.split('@')[0]?.toLowerCase();

  switch (command) {
    case '/omzet':
      return buildOmzetReply();
    case '/stok':
      return buildStokReply();
    case '/kasbon':
      return buildKasbonReply();
    case '/help':
    case '/start':
      return buildHelpReply();
    default:
      return null;
  }
}

async function buildOmzetReply(): Promise<string> {
  const dateKey = todayDateKey();
  const transactions = (await getTransactionsByDate(dateKey)).filter((t) => !t.voided);
  const pengeluaran = await getPengeluaranByDate(dateKey);

  const totalCash = transactions.reduce((sum, t) => sum + getCashAmount(t), 0);
  const totalQris = transactions.reduce((sum, t) => sum + getQrisAmount(t), 0);
  const totalPemasukan = totalCash + totalQris;
  const totalPengeluaran = pengeluaran.reduce((sum, e) => sum + e.amount, 0);
  const laba = totalPemasukan - totalPengeluaran;

  return (
    `📊 <b>Omzet Hari Ini</b>\n` +
    `Cash: ${formatRupiah(totalCash)}\n` +
    `QRIS: ${formatRupiah(totalQris)}\n` +
    `Total Pemasukan: ${formatRupiah(totalPemasukan)}\n` +
    `Pengeluaran: ${formatRupiah(totalPengeluaran)}\n` +
    `<b>Laba Bersih: ${formatRupiah(laba)}</b>\n` +
    `Jumlah transaksi: ${transactions.length}`
  );
}

async function buildStokReply(): Promise<string> {
  const menu = await getAllMenu();
  const low = menu.filter((m) => m.stock <= LOW_STOCK_THRESHOLD).sort((a, b) => a.stock - b.stock);

  if (low.length === 0) {
    return `📦 <b>Stok Menipis</b>\nTidak ada — semua stok masih aman.`;
  }

  const lines = low.map((m) => `- ${m.name}: ${m.stock === 0 ? 'HABIS' : `tersisa ${m.stock}`}`).join('\n');
  return `📦 <b>Stok Menipis</b>\n${lines}`;
}

async function buildKasbonReply(): Promise<string> {
  const all = await getAllKasbon();
  const belumLunas = all
    .filter((k) => k.status === 'belum_lunas')
    .sort((a, b) => daysSince(b.createdAt) - daysSince(a.createdAt));

  if (belumLunas.length === 0) {
    return `🧾 <b>Kasbon Belum Lunas</b>\nTidak ada — semua pelanggan sudah lunas.`;
  }

  const totalBelumLunas = belumLunas.reduce((sum, k) => sum + k.total, 0);
  const lines = belumLunas
    .map((k) => `- ${k.customerName}: ${formatRupiah(k.total)} (${daysSince(k.createdAt)} hari)`)
    .join('\n');

  return `🧾 <b>Kasbon Belum Lunas — Total ${formatRupiah(totalBelumLunas)}</b>\n${lines}`;
}

function buildHelpReply(): string {
  return (
    `🤖 <b>Perintah Warkop Dua Tujuh</b>\n` +
    `/omzet — omzet & laba hari ini\n` +
    `/stok — daftar menu yang stoknya menipis\n` +
    `/kasbon — daftar kasbon yang belum lunas\n\n` +
    `Catatan: bot cuma bisa membalas selama aplikasi kasir sedang terbuka ` +
    `di salah satu perangkat warung.`
  );
}
