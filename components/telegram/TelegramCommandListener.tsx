'use client';

import { useEffect, useRef } from 'react';
import { getItem, setItem, STORAGE_KEYS } from '@/lib/storage/db';
import { getSettings } from '@/lib/storage/settingsService';
import { sendTelegramNotification } from '@/lib/telegram';
import { buildCommandReply } from '@/lib/telegramCommands';

const POLL_INTERVAL_MS = 4000;

// Komponen tak-tampak (dipasang sekali di app/layout.tsx) yang polling
// endpoint app/api/telegram/updates secara berkala untuk mengecek apakah
// ada perintah baru (mis. /omzet) yang dikirim ke bot dari Telegram.
//
// Kenapa polling dari browser, bukan webhook server? Karena semua data
// (transaksi, kasbon, stok) cuma tersimpan di localStorage perangkat kasir
// — server tidak tahu apa-apa soal data itu. Jadi bot HANYA bisa membalas
// selama ada tab aplikasi ini yang terbuka di suatu perangkat. Untuk
// pemakaian warkop sehari-hari ini biasanya cukup, karena perangkat kasir
// memang menyala sepanjang jam operasional — tapi kalau semua tab
// ditutup, bot tidak akan membalas apa pun sampai ada yang buka lagi.
export default function TelegramCommandListener() {
  const isPolling = useRef(false);

  useEffect(() => {
    let stopped = false;

    async function poll() {
      if (isPolling.current || stopped) return;
      isPolling.current = true;

      try {
        const settings = await getSettings();
        if (!settings.telegramCommandsEnabled) return;

        const offset = await getItem<number | null>(STORAGE_KEYS.TELEGRAM_UPDATE_OFFSET, null);
        const url = offset ? `/api/telegram/updates?offset=${offset}` : '/api/telegram/updates';
        const res = await fetch(url);
        const data = await res.json();

        // Kalau gagal (belum diset / Telegram error), diamkan saja — coba
        // lagi di siklus polling berikutnya tanpa mengganggu pemakaian app.
        if (!data.ok) return;

        for (const msg of (data.messages ?? []) as { update_id: number; text: string }[]) {
          const reply = await buildCommandReply(msg.text);
          if (reply) await sendTelegramNotification(reply);
        }

        if (typeof data.lastUpdateId === 'number') {
          await setItem(STORAGE_KEYS.TELEGRAM_UPDATE_OFFSET, data.lastUpdateId + 1);
        }
      } catch {
        // Abaikan — jaringan/telegram bermasalah sesaat, coba lagi nanti.
      } finally {
        isPolling.current = false;
      }
    }

    poll(); // cek sekali segera, tidak perlu tunggu interval pertama
    const interval = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, []);

  return null;
}
