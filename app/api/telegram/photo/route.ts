import { NextRequest, NextResponse } from 'next/server';

// Kirim FOTO ke bot Telegram — dipakai khusus untuk gambar struk hasil
// canvas (lihat lib/utils/receiptCanvas.ts). Terpisah dari
// app/api/telegram/route.ts (yang cuma kirim teks) karena Telegram butuh
// endpoint & format body (multipart/form-data) berbeda untuk sendPhoto.
export async function POST(req: NextRequest) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return NextResponse.json(
        { ok: false, error: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum diset di .env.local' },
        { status: 500 }
      );
    }

    const incoming = await req.formData();
    const photo = incoming.get('photo');
    const caption = incoming.get('caption');

    if (!(photo instanceof Blob)) {
      return NextResponse.json({ ok: false, error: 'File gambar struk tidak ditemukan.' }, { status: 400 });
    }

    const tgForm = new FormData();
    tgForm.append('chat_id', chatId);
    tgForm.append('photo', photo, 'struk.png');
    if (typeof caption === 'string' && caption) {
      tgForm.append('caption', caption);
      tgForm.append('parse_mode', 'HTML');
    }

    const tgResponse = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: tgForm,
    });

    const tgData = await tgResponse.json();

    if (!tgResponse.ok) {
      return NextResponse.json(
        { ok: false, error: tgData.description || 'Telegram menolak permintaan.', telegram: tgData },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true, telegram: tgData });
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Gagal mengirim gambar struk' }, { status: 500 });
  }
}
