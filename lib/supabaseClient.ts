import { createClient } from '@supabase/supabase-js';

/**
 * Client Supabase terpusat, dipakai oleh lib/storage/db.ts.
 *
 * Sengaja dibuat "opsional": kalau NEXT_PUBLIC_SUPABASE_URL /
 * NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi di .env.local, `supabase` akan
 * bernilai null dan db.ts otomatis fallback ke localStorage (lihat komentar
 * di sana). Jadi project ini tetap bisa jalan tanpa Supabase kalau belum
 * sempat di-setup, dan tinggal isi env var ini kapan pun untuk pindah.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;
