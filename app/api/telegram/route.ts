import { NextRequest, NextResponse } from 'next/server';

// Kerangka awal. Logika lengkap (format pesan rekap harian) akan dilengkapi
// di tahap Halaman Rekap & Laporan. Set TELEGRAM_BOT_TOKEN dan
// TELEGRAM_CHAT_ID di file .env.local.
export async function POST(req: NextRequest) {
  try {
    const { message } = (await req.json()) as { message: string };

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
