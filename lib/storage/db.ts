/**
 * Adapter penyimpanan — Supabase (tabel `kv_store`) dengan fallback
 * localStorage.
 *
 * Setiap "STORAGE_KEYS" di bawah disimpan sebagai satu baris di tabel
 * `kv_store` (kolom `key` + `value jsonb`). Ini sengaja dibuat generik
 * (bukan tabel per entitas) supaya migrasi dari versi localStorage lama
 * minim perubahan — semua service di folder ini (menuService,
 * transactionService, dst) tidak perlu tahu ataupun berubah sama sekali.
 *
 * Kalau NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi
 * di .env.local, otomatis fallback ke localStorage seperti sebelumnya
 * (lihat lib/supabaseClient.ts) — supaya app tetap jalan tanpa setup
 * Supabase dulu. Jalankan SQL di supabase/schema.sql sebelum mengisi env
 * var-nya.
 */

import { supabase, isSupabaseConfigured } from '../supabaseClient';

const isBrowser = typeof window !== 'undefined';
const KV_TABLE = 'kv_store';

export async function getItem<T>(key: string, fallback: T): Promise<T> {
  if (!isBrowser) return fallback;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from(KV_TABLE)
        .select('value')
        .eq('key', key)
        .maybeSingle();
      if (error) throw error;
      return data ? (data.value as T) : fallback;
    } catch (err) {
      console.error(`[storage] Gagal membaca key "${key}" dari Supabase`, err);
      return fallback;
    }
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (err) {
    console.error(`[storage] Gagal membaca key "${key}"`, err);
    return fallback;
  }
}

export async function setItem<T>(key: string, value: T): Promise<void> {
  if (!isBrowser) return;

  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from(KV_TABLE)
        .upsert({ key, value, updated_at: new Date().toISOString() });
      if (error) throw error;
      return;
    } catch (err) {
      console.error(`[storage] Gagal menyimpan key "${key}" ke Supabase`, err);
      return;
    }
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`[storage] Gagal menyimpan key "${key}"`, err);
  }
}

export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Versi getItem/setItem yang SELALU pakai localStorage, tidak pernah lewat
 * Supabase — meski Supabase sudah dikonfigurasi.
 *
 * Dipakai khusus untuk data yang memang harus per-device (bukan data warung
 * yang perlu sinkron), contohnya sesi "siapa kasir yang lagi login" di
 * operatorService.ts. Kalau session itu ikut disimpan ke Supabase, status
 * login jadi 1 status GLOBAL yang dibagi ke semua device — akibatnya kasir A
 * login di HP-nya, lalu kasir B buka web di HP lain malah ikut ke-login
 * sebagai kasir A. localStorage per-device menghindari itu.
 */
export function getLocalItem<T>(key: string, fallback: T): T {
  if (!isBrowser) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (err) {
    console.error(`[storage] Gagal membaca key lokal "${key}"`, err);
    return fallback;
  }
}

export function setLocalItem<T>(key: string, value: T): void {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`[storage] Gagal menyimpan key lokal "${key}"`, err);
  }
}

// Semua key localStorage terpusat di sini supaya gampang ditelusuri/diubah.
export const STORAGE_KEYS = {
  MENU: 'warkop27_menu',
  TRANSACTIONS: 'warkop27_transactions',
  KASBON: 'warkop27_kasbon',
  // Pesanan yang sudah masuk (item & stok terpotong) tapi belum dibayar
  // saat itu juga — dari sini nanti ditandai "Sudah Dibayar" (jadi
  // Transaction) atau dipindah jadi "Kasbon" kalau tidak dibayar sama sekali.
  PENDING_ORDERS: 'warkop27_pending_orders',
  PENGELUARAN: 'warkop27_pengeluaran',
  // Riwayat belanja stok (restock) — terpisah dari PENGELUARAN karena punya
  // rincian item/qty/harga beli per baris, dipakai untuk audit & basis
  // perhitungan HPP rata-rata tertimbang. Nilainya tetap ikut tercatat di
  // PENGELUARAN juga (lewat createPengeluaran) supaya Laba Bersih akurat.
  STOCK_PURCHASES: 'warkop27_stock_purchases',
  SETTINGS: 'warkop27_settings',
  OPERATORS: 'warkop27_operators',
  ACTIVE_OPERATOR: 'warkop27_active_operator',
  // Riwayat shift laci kas (buka dengan modal awal, tutup dengan hitung
  // fisik & selisih) — lihat lib/storage/shiftService.ts. Beda dari
  // ACTIVE_OPERATOR: ini data warung (dibagi lewat Supabase kalau ada),
  // bukan status per-device.
  SHIFTS: 'warkop27_shifts',
  // Riwayat login/logout kasir (audit trail) — lihat LoginLogEntry di
  // lib/types.ts. Beda dari ACTIVE_OPERATOR: ini data warung (dibagi lewat
  // Supabase kalau ada), bukan status per-device, dan tidak pernah
  // ditimpa — hanya ditambah (append-only) sampai dipangkas otomatis di
  // operatorService.ts.
  LOGIN_LOGS: 'warkop27_login_logs',
  LAST_BACKUP_AT: 'warkop27_last_backup_at',
  // Daftar ID menu yang sudah dikirim notifikasi "stok menipis"-nya, supaya
  // tidak kirim ulang tiap kali ada transaksi baru. Direset (ID dilepas dari
  // daftar ini) begitu stok menu itu diisi ulang di atas ambang batas.
  LOW_STOCK_NOTIFIED: 'warkop27_low_stock_notified',
  // Sama seperti LOW_STOCK_NOTIFIED, tapi untuk kasbon yang sudah jatuh
  // tempo — supaya tidak kirim notifikasi Telegram berulang tiap halaman
  // Kasbon dibuka. Direset begitu kasbon itu dilunasi.
  KASBON_OVERDUE_NOTIFIED: 'warkop27_kasbon_overdue_notified',
  // Offset getUpdates Telegram (lihat app/api/telegram/updates/route.ts) —
  // menandai update mana yang sudah diproses supaya perintah bot (mis.
  // /omzet) tidak dibalas berulang-ulang tiap polling.
  TELEGRAM_UPDATE_OFFSET: 'warkop27_telegram_update_offset',
} as const;
