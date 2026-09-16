import { NextRequest, NextResponse } from 'next/server';
import type { Transaction, PengeluaranEntry } from '@/lib/types';
import type { AppSettings } from '@/lib/storage/settingsService';
import { DEFAULT_SETTINGS } from '@/lib/storage/settingsService';
import { getCashAmount, getQrisAmount } from '@/lib/storage/transactionService';
import { STORAGE_KEYS } from '@/lib/storage/db';
import { getServerItem, isServerSupabaseConfigured } from '@/lib/storage/serverKv';
import { toJakartaDateKey, yesterdayJakartaDateKey } from '@/lib/utils/date';
import { formatRupiah, htmlToWhatsappText } from '@/lib/utils/format';

// Jadwal jalannya diatur di vercel.json ("0 17 * * *" — 17:00 UTC = 00:00
// WIB keesokan harinya), dipicu Vercel Cron. TIDAK bergantung sama sekali
// pada app kasir sedang dibuka atau tidak — beda dari /omzet lewat chat bot
// Telegram (lihat lib/telegramCommands.ts) yang cuma bisa dijawab selama
// ada tab kasir yang terbuka, karena datanya baru bisa dibaca di sana.
//
// SYARAT: cuma bisa jalan kalau Supabase sudah dikonfigurasi (lihat
// lib/storage/serverKv.ts) — kalau masih localStorage-only, data transaksi
// terkunci di browser kasir dan server tidak punya cara membacanya.

// Ambang aman supaya endpoint publik ini tidak sembarangan bisa dipicu
// orang lain untuk spam Telegram — isi CRON_SECRET di .env.local / env
// project Vercel, Vercel otomatis mengirim header ini untuk cron job
// bawaannya. Kalau belum diisi, endpoint tetap jalan tanpa cek (memudahkan
// coba-coba lokal) — TAPI berarti siapa pun yang tahu URL-nya bisa memicu
// pengiriman rekap kapan saja, jadi disarankan selalu diisi di production.
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

async function sendTelegramText(message: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum diset.' };
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.description || 'Telegram menolak permintaan.' };
  return { ok: true };
}

// Provider WhatsApp sengaja TIDAK diduplikasi lengkap di sini (beda dari
// Telegram di atas) — cron ini fokus ke channel utama (Telegram) yang tidak
// butuh app terbuka. Kalau channel WhatsApp juga dinyalakan, kirim lewat
// provider yang sama seperti app/api/whatsapp/route.ts.
async function sendWhatsappText(message: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const provider = (process.env.WHATSAPP_PROVIDER || 'fonnte').toLowerCase();
    const target = process.env.WHATSAPP_TARGET;
    if (!target) return { ok: false, error: 'WHATSAPP_TARGET belum diset.' };

    if (provider === 'cloud') {
      const token = process.env.WHATSAPP_CLOUD_TOKEN;
      const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
      if (!token || !phoneNumberId) return { ok: false, error: 'Env WhatsApp Cloud API belum lengkap.' };
      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: target, type: 'text', text: { body: message } }),
      });
      if (!res.ok) return { ok: false, error: 'WhatsApp Cloud API menolak permintaan.' };
      return { ok: true };
    }

    const token = process.env.FONNTE_TOKEN;
    if (!token) return { ok: false, error: 'FONNTE_TOKEN belum diset.' };
    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, message }),
    });
    const data = await res.json();
    if (!res.ok || data?.status === false) return { ok: false, error: data?.reason || 'Fonnte menolak permintaan.' };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Gagal mengirim WhatsApp.' };
  }
}

function formatJakartaDateLabel(dateKey: string): string {
  const noonUtc = new Date(`${dateKey}T12:00:00+07:00`);
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(noonUtc);
}

function buildRecapMessage(dateKey: string, transactions: Transaction[], pengeluaran: PengeluaranEntry[]): string {
  const active = transactions.filter((t) => !t.voided);
  const totalCash = active.reduce((sum, t) => sum + getCashAmount(t), 0);
  const totalQris = active.reduce((sum, t) => sum + getQrisAmount(t), 0);
  const totalPemasukan = totalCash + totalQris;
  const totalPengeluaran = pengeluaran.reduce((sum, e) => sum + e.amount, 0);
  const laba = totalPemasukan - totalPengeluaran;

  // Menu terlaris (top 3 berdasarkan qty) — nilai tambah dibanding /omzet
  // biasa, cukup relevan buat rekap penutup hari.
  const qtyByName = new Map<string, number>();
  for (const t of active) {
    for (const item of t.items) {
      qtyByName.set(item.name, (qtyByName.get(item.name) ?? 0) + item.quantity);
    }
  }
  const topItems = [...qtyByName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topItemsLines = topItems.length
    ? topItems.map(([name, qty], i) => `${i + 1}. ${name} — ${qty} terjual`).join('\n')
    : '-';

  return (
    `🌙 <b>Rekap Harian — ${formatJakartaDateLabel(dateKey)}</b>\n\n` +
    `Jumlah transaksi: ${active.length}\n` +
    `Cash: ${formatRupiah(totalCash)}\n` +
    `QRIS: ${formatRupiah(totalQris)}\n` +
    `Total Pemasukan: ${formatRupiah(totalPemasukan)}\n` +
    `Pengeluaran: ${formatRupiah(totalPengeluaran)}\n` +
    `<b>Laba Bersih: ${formatRupiah(laba)}</b>\n\n` +
    `🏆 <b>Menu Terlaris</b>\n${topItemsLines}`
  );
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!isServerSupabaseConfigured) {
    // Bukan error server — ini kondisi yang diharapkan untuk instalasi yang
    // masih localStorage-only. Dikembalikan 200 supaya log cron Vercel tidak
    // menandainya sebagai kegagalan berulang.
    return NextResponse.json({
      ok: false,
      skipped: true,
      reason:
        'Supabase belum dikonfigurasi — rekap otomatis butuh data warung di Supabase, bukan localStorage device kasir. Lihat README bagian "Pindah ke Supabase".',
    });
  }

  const settingsStored = await getServerItem<Partial<AppSettings>>(STORAGE_KEYS.SETTINGS, {});
  const settings: AppSettings = { ...DEFAULT_SETTINGS, ...settingsStored };

  if (!settings.dailyRecapNotifyEnabled) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'dailyRecapNotifyEnabled dimatikan di Pengaturan.' });
  }

  const dateKey = yesterdayJakartaDateKey();
  const allTransactions = await getServerItem<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
  const allPengeluaran = await getServerItem<PengeluaranEntry[]>(STORAGE_KEYS.PENGELUARAN, []);

  const transactions = allTransactions.filter((t) => toJakartaDateKey(new Date(t.createdAt)) === dateKey);
  const pengeluaran = allPengeluaran.filter((e) => toJakartaDateKey(new Date(e.createdAt)) === dateKey);

  const message = buildRecapMessage(dateKey, transactions, pengeluaran);

  const results: Record<string, { ok: boolean; error?: string }> = {};

  if (settings.telegramChannelEnabled !== false) {
    results.telegram = await sendTelegramText(message);
  }
  if (settings.whatsappChannelEnabled) {
    results.whatsapp = await sendWhatsappText(htmlToWhatsappText(message));
  }

  const anySent = Object.values(results).some((r) => r.ok);
  return NextResponse.json({ ok: anySent, dateKey, results });
}
