/**
 * Pembaca kv_store KHUSUS server — dipakai satu-satunya oleh
 * app/api/cron/rekap-harian/route.ts.
 *
 * Kenapa tidak pakai getItem() dari lib/storage/db.ts saja? Karena getItem
 * sengaja langsung `return fallback` kalau `typeof window === 'undefined'`
 * (lihat komentar `isBrowser` di sana) — itu benar untuk semua service
 * lain di folder ini yang memang HANYA dipanggil dari komponen client
 * ('use client'). Tapi cron job jalan di server TANPA request dari
 * browser sama sekali, jadi guard itu justru membuatnya selalu membaca
 * data kosong. Modul ini query Supabase langsung, tanpa guard tersebut.
 *
 * Konsekuensi arsitektur: rekap harian otomatis HANYA bisa jalan kalau
 * Supabase sudah dikonfigurasi (lihat README bagian "Pindah ke Supabase").
 * Kalau app masih pakai localStorage-only (default), data transaksi
 * terkunci di browser device kasir — server tidak punya cara membacanya
 * sama sekali, terlepas dari kode apa pun yang ditulis di sini.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isServerSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const serverSupabase = isServerSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

export async function getServerItem<T>(key: string, fallback: T): Promise<T> {
  if (!serverSupabase) return fallback;
  try {
    const { data, error } = await serverSupabase.from('kv_store').select('value').eq('key', key).maybeSingle();
    if (error || !data) return fallback;
    return data.value as T;
  } catch (err) {
    console.error(`[serverKv] Gagal membaca key "${key}" dari Supabase`, err);
    return fallback;
  }
}
