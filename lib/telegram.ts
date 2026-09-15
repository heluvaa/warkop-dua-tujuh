// Helper kecil untuk mengirim pesan ke bot Telegram lewat app/api/telegram/route.ts.
// Dipakai di beberapa tempat (mis. notifikasi stok menipis) supaya logika
// fetch-nya tidak diulang-ulang.
//
// Setiap pesan otomatis dilampiri baris waktu kejadian (hari, tanggal, jam)
// yang sudah dirapikan lewat formatNotificationTimestamp, supaya pemilik
// warung yang buka Telegram-nya belakangan tetap tahu persis kapan
// kejadiannya tanpa perlu buka aplikasi kasir.
import { formatNotificationTimestamp } from './utils/format';

export async function sendTelegramNotification(message: string): Promise<boolean> {
  try {
    const messageWithTimestamp = `${message}\n\n🕒 ${formatNotificationTimestamp()}`;

    const res = await fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: messageWithTimestamp }),
    });
    const data = await res.json();
    return Boolean(data.ok);
  } catch (err) {
    console.error('[telegram] Gagal mengirim notifikasi', err);
    return false;
  }
}

// Kirim gambar (dipakai untuk foto struk hasil canvas, lihat
// lib/utils/receiptCanvas.ts + ReceiptModal) lewat
// app/api/telegram/photo/route.ts. Caption opsional boleh pakai tag HTML
// Telegram seperti <b>...</b>, sama seperti pesan teks biasa.
export async function sendTelegramPhoto(photo: Blob, caption?: string): Promise<boolean> {
  try {
    const form = new FormData();
    form.append('photo', photo, 'struk.png');
    if (caption) form.append('caption', caption);

    const res = await fetch('/api/telegram/photo', { method: 'POST', body: form });
    const data = await res.json();
    return Boolean(data.ok);
  } catch (err) {
    console.error('[telegram] Gagal mengirim gambar struk', err);
    return false;
  }
}
