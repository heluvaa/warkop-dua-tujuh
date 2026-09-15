import { NextRequest, NextResponse } from 'next/server';

// Kerangka awal. Logika lengkap (format pesan rekap harian) akan dilengkapi
// di tahap Halaman Rekap & Laporan. Set TELEGRAM_BOT_TOKEN dan
// TELEGRAM_CHAT_ID di file .env.local.

// --- Cegah notifikasi KEMBAR (double-send) --------------------------------
//
// Kasus yang mau dicegah: kasir kepencet tombol konfirmasi dua kali dengan
// cepat (mis. koneksi lambat jadi dikira belum kepencet), sehingga dua
// request dengan ISI PESAN PERSIS SAMA masuk dalam rentang beberapa detik.
// Kalau itu terjadi, permintaan kedua (dan seterusnya) tidak diteruskan ke
// Telegram lagi — cukup dianggap berhasil supaya UI tidak menampilkan error.
//
// Disimpan in-memory di modul ini saja (bukan di storage/kv_store) karena
// sifatnya cuma "penjaga sesaat", bukan riwayat permanen — otomatis reset
// kalau server di-restart, dan entry lama otomatis dibuang sendiri (lihat
// pruneOldEntries) supaya Map ini tidak terus membesar.
const recentlySent = new Map<string, number>();
const DEDUPE_WINDOW_MS = 5000;

function pruneOldEntries(now: number) {
  for (const [key, sentAt] of recentlySent) {
    if (now - sentAt > DEDUPE_WINDOW_MS) recentlySent.delete(key);
  }
}

// true kalau pesan yang SAMA PERSIS baru saja dikirim dalam beberapa detik
// terakhir. Sekalian mencatat pesan ini sebagai "baru dikirim" untuk cek
// berikutnya (baik dedupe berhasil dicegah maupun tidak, supaya request
// ketiga/keempat yang menyusul cepat tetap kena cegah juga).
function isDuplicate(message: string): boolean {
  const now = Date.now();
  pruneOldEntries(now);

  const lastSentAt = recentlySent.get(message);
  const duplicate = lastSentAt !== undefined && now - lastSentAt < DEDUPE_WINDOW_MS;
  recentlySent.set(message, now);
  return duplicate;
}

export async function POST(req: NextRequest) {
  try {
    const { message } = (await req.json()) as { message: string };

    if (isDuplicate(message)) {
      // Diam-diam dianggap sukses — dari sudut pandang pemanggil (kasir)
      // tetap terlihat berhasil, tapi Telegram tidak dikirimi pesan yang
      // sama dua kali.
      return NextResponse.json({ ok: true, deduped: true });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return NextResponse.json(
        { ok: false, error: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum diset di .env.local' },
        { status: 500 }
      );
    }

    const tgResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });

    const tgData = await tgResponse.json();

    if (!tgResponse.ok) {
      // Teruskan pesan error asli dari Telegram (mis. "Unauthorized" kalau
      // token salah, "chat not found" kalau chat ID salah) supaya lebih
      // gampang didiagnosis dari tampilan Laporan, bukan cuma "Gagal".
      return NextResponse.json(
        { ok: false, error: tgData.description || 'Telegram menolak permintaan.', telegram: tgData },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true, telegram: tgData });
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Gagal mengirim laporan' }, { status: 500 });
  }
}
