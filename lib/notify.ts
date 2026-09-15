// Titik masuk TUNGGAL untuk semua notifikasi event (transaksi baru, kasbon,
// stok menipis, buka/tutup shift, dst). Dulu tiap tempat pemicu notifikasi
// memanggil sendTelegramNotification langsung; sekarang semua panggil
// sendNotification() di sini, yang meneruskan pesan yang sama ke tiap
// channel (Telegram / WhatsApp) sesuai yang dinyalakan pemilik di
// Pengaturan — tanpa perlu tiap tempat tahu channel mana saja yang aktif.
//
// Pengecualian: balasan perintah bot Telegram (/omzet, /stok, /kasbon di
// components/telegram/TelegramCommandListener.tsx) TETAP memanggil
// sendTelegramNotification langsung dari lib/telegram.ts, karena itu balasan
// ke orang yang baru saja chat bot Telegram-nya — bukan broadcast event.
import { sendTelegramNotification } from './telegram';
import { sendWhatsappNotification } from './whatsapp';
import { getSettings } from './storage/settingsService';

export async function sendNotification(message: string): Promise<boolean> {
  const settings = await getSettings();

  const jobs: Promise<boolean>[] = [];

  // Default tetap nyala kalau belum pernah diatur (kompatibel dengan
  // instalasi lama yang cuma pakai Telegram, sebelum field ini ada).
  if (settings.telegramChannelEnabled !== false) {
    jobs.push(sendTelegramNotification(message));
  }
  if (settings.whatsappChannelEnabled) {
    jobs.push(sendWhatsappNotification(message));
  }

  if (jobs.length === 0) return true;

  const results = await Promise.all(jobs);
  // Dianggap berhasil kalau MINIMAL SATU channel yang aktif berhasil kirim —
  // supaya satu channel yang lagi bermasalah (mis. token Fonnte kadaluarsa)
  // tidak bikin UI kasir menampilkan error padahal Telegram tetap terkirim.
  return results.some(Boolean);
}
