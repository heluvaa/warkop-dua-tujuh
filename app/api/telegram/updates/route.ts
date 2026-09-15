import { NextRequest, NextResponse } from 'next/server';

// Di-poll berkala oleh components/telegram/TelegramCommandListener.tsx (lihat
// komponen itu untuk alasan kenapa harus polling dari browser, bukan
// webhook server). Endpoint ini cuma proxy tipis ke getUpdates Telegram —
// token bot tetap rahasia di server, browser cuma dapat teks pesan +
// offset berikutnya.
//
// PENTING: kalau bot Telegram ini juga didaftarkan pakai webhook di tempat
// lain, getUpdates akan selalu gagal (409 Conflict). Pastikan tidak ada
// webhook aktif untuk bot ini.
export async function GET(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return NextResponse.json(
      { ok: false, error: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum diset di .env.local' },
      { status: 200 }
    );
  }

  const offsetParam = req.nextUrl.searchParams.get('offset');
  const params = new URLSearchParams({ timeout: '0', limit: '20' });
  if (offsetParam) params.set('offset', offsetParam);

  try {
    const tgResponse = await fetch(`https://api.telegram.org/bot${token}/getUpdates?${params.toString()}`);
    const tgData = await tgResponse.json();

    if (!tgData.ok) {
      return NextResponse.json(
        { ok: false, error: tgData.description || 'Telegram menolak permintaan getUpdates.' },
        { status: 200 }
      );
    }

    const results = (tgData.result ?? []) as Array<{
      update_id: number;
      message?: { text?: string; chat?: { id: number | string } };
    }>;

    // Hanya teruskan pesan teks dari chat yang cocok TELEGRAM_CHAT_ID, supaya
    // orang lain yang kebetulan menemukan bot ini tidak bisa memicu balasan.
    const messages = results
      .filter((u) => u.message?.text && String(u.message.chat?.id) === String(chatId))
      .map((u) => ({ update_id: u.update_id, text: u.message!.text as string }));

    // Offset dihitung dari SEMUA update (bukan cuma yang lolos filter chat
    // id) supaya polling berikutnya tidak mengulang-ulang update dari chat
    // lain yang diabaikan.
    const lastUpdateId = results.length > 0 ? results[results.length - 1].update_id : null;

    return NextResponse.json({ ok: true, messages, lastUpdateId });
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Gagal terhubung ke Telegram' }, { status: 200 });
  }
}
