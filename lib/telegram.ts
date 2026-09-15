// Helper kecil untuk mengirim pesan ke bot Telegram lewat app/api/telegram/route.ts.
// Dipakai di beberapa tempat (mis. notifikasi stok menipis) supaya logika
// fetch-nya tidak diulang-ulang.
export async function sendTelegramNotification(message: string): Promise<boolean> {
  try {
    const res = await fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    return Boolean(data.ok);
  } catch (err) {
    console.error('[telegram] Gagal mengirim notifikasi', err);
    return false;
  }
}
