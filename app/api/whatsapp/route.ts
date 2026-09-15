import { NextRequest, NextResponse } from 'next/server';

// Kirim notifikasi ke WhatsApp lewat salah satu provider di bawah, dipilih
// lewat env var WHATSAPP_PROVIDER:
//
// - 'fonnte' (default) — gateway WhatsApp tidak resmi yang populer dipakai
//   UMKM/warkop di Indonesia. Setup-nya cuma scan QR sekali dari dashboard
//   fonnte.com, tanpa proses verifikasi bisnis. Cocok buat notifikasi ke HP
//   pribadi pemilik warung. Env yang perlu diisi di .env.local:
//     FONNTE_TOKEN=...          (token device, dari dashboard Fonnte)
//     WHATSAPP_TARGET=628xxxx   (nomor tujuan, awali 62, tanpa tanda + / spasi)
//
// - 'cloud' — WhatsApp Cloud API resmi dari Meta. Lebih "proper" & gratis
//   kuotanya, tapi perlu setup Meta Business + WhatsApp Business Account.
//   Env yang perlu diisi:
//     WHATSAPP_PROVIDER=cloud
//     WHATSAPP_CLOUD_TOKEN=...            (access token, dari Meta for Developers)
//     WHATSAPP_CLOUD_PHONE_NUMBER_ID=...  (Phone Number ID dari WhatsApp Business Account)
//     WHATSAPP_TARGET=628xxxx
//
// Nomor WHATSAPP_TARGET yang dikirimi notifikasi sengaja diisi via env
// (bukan disimpan di Pengaturan seperti QRIS), karena ini nomor pemilik
// warung sendiri yang jarang berubah — mirip TELEGRAM_CHAT_ID.

// --- Cegah notifikasi KEMBAR (double-send) — pola sama seperti
// app/api/telegram/route.ts, lihat komentar di sana untuk penjelasan.
const recentlySent = new Map<string, number>();
const DEDUPE_WINDOW_MS = 5000;

function pruneOldEntries(now: number) {
  for (const [key, sentAt] of recentlySent) {
    if (now - sentAt > DEDUPE_WINDOW_MS) recentlySent.delete(key);
  }
}

function isDuplicate(message: string): boolean {
  const now = Date.now();
  pruneOldEntries(now);

  const lastSentAt = recentlySent.get(message);
  const duplicate = lastSentAt !== undefined && now - lastSentAt < DEDUPE_WINDOW_MS;
  recentlySent.set(message, now);
  return duplicate;
}

async function sendViaFonnte(message: string) {
  const token = process.env.FONNTE_TOKEN;
  const target = process.env.WHATSAPP_TARGET;

  if (!token || !target) {
    throw new Error('FONNTE_TOKEN / WHATSAPP_TARGET belum diset di .env.local');
  }

  const res = await fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ target, message }),
  });

  const data = await res.json();

  if (!res.ok || data?.status === false) {
    throw new Error(data?.reason || data?.detail || 'Fonnte menolak permintaan.');
  }

  return data;
}

async function sendViaCloudApi(message: string) {
  const token = process.env.WHATSAPP_CLOUD_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
  const target = process.env.WHATSAPP_TARGET;

  if (!token || !phoneNumberId || !target) {
    throw new Error(
      'WHATSAPP_CLOUD_TOKEN / WHATSAPP_CLOUD_PHONE_NUMBER_ID / WHATSAPP_TARGET belum diset di .env.local'
    );
  }

  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: target,
      type: 'text',
      text: { body: message },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || 'WhatsApp Cloud API menolak permintaan.');
  }

  return data;
}

export async function POST(req: NextRequest) {
  try {
    const { message } = (await req.json()) as { message: string };

    if (isDuplicate(message)) {
      return NextResponse.json({ ok: true, deduped: true });
    }

    const provider = (process.env.WHATSAPP_PROVIDER || 'fonnte').toLowerCase();

    try {
      const data = provider === 'cloud' ? await sendViaCloudApi(message) : await sendViaFonnte(message);
      return NextResponse.json({ ok: true, whatsapp: data });
    } catch (err) {
      // Sama seperti route Telegram: kembalikan status 200 dengan ok:false
      // supaya pesan error asli dari provider tetap bisa ditampilkan di
      // tombol "Tes Koneksi WhatsApp" pada halaman Pengaturan, bukan cuma
      // "Gagal" generik.
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : 'Gagal mengirim WhatsApp.' },
        { status: 200 }
      );
    }
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Gagal mengirim pesan' }, { status: 500 });
  }
}
