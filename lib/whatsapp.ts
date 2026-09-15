// Helper kecil untuk mengirim pesan ke WhatsApp lewat app/api/whatsapp/route.ts.
// Dipakai lewat lib/notify.ts (bukan dipanggil langsung dari tempat lain)
// supaya satu pesan yang sama bisa dikirim ke Telegram & WhatsApp sekaligus
// tanpa menulis ulang teksnya di tiap tempat notifikasi dipicu.
import { htmlToWhatsappText } from './utils/format';

export async function sendWhatsappNotification(message: string): Promise<boolean> {
  try {
    const res = await fetch('/api/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Pesan ditulis sekali pakai gaya HTML Telegram (mis. "<b>...</b>") —
      // dikonversi dulu ke gaya WhatsApp (*tebal*) sebelum dikirim.
      body: JSON.stringify({ message: htmlToWhatsappText(message) }),
    });
    const data = await res.json();
    return Boolean(data.ok);
  } catch (err) {
    console.error('[whatsapp] Gagal mengirim notifikasi', err);
    return false;
  }
}
