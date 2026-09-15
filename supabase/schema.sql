-- Jalankan file ini sekali di Supabase Dashboard → SQL Editor → New query.
--
-- Tabel key-value generik untuk Warkop Dua Tujuh. Tiap STORAGE_KEYS di
-- lib/storage/db.ts (menu, transaksi, kasbon, pengeluaran, settings, dst)
-- disimpan sebagai satu baris di sini, persis seperti dulu satu key di
-- localStorage.

create table if not exists kv_store (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Wajib diaktifkan di Supabase (default-nya publicly readable kalau tidak).
alter table kv_store enable row level security;

-- CATATAN KEAMANAN:
-- App ini dipakai langsung dari browser kasir pakai anon key, tanpa login
-- (single warung, satu tim kasir yang saling percaya). Policy di bawah
-- sengaja dibuka penuh untuk role "anon" supaya app bisa baca/tulis tanpa
-- setup auth tambahan — sama persis sifatnya dengan localStorage yang
-- dipakai sebelumnya (siapa pun yang pegang device bisa akses).
--
-- Konsekuensinya: siapa pun yang tahu Project URL + anon key kamu (mis. dari
-- kode sumber kalau di-deploy publik) juga bisa baca/tulis tabel ini
-- langsung lewat API Supabase. Untuk warung kecil biasanya ini oke, tapi
-- kalau mau lebih aman: jangan expose repo secara publik, atau upgrade
-- nanti ke Supabase Auth + policy per user/warung.
drop policy if exists "Allow anon read" on kv_store;
drop policy if exists "Allow anon insert" on kv_store;
drop policy if exists "Allow anon update" on kv_store;

create policy "Allow anon read" on kv_store
  for select to anon using (true);

create policy "Allow anon insert" on kv_store
  for insert to anon with check (true);

create policy "Allow anon update" on kv_store
  for update to anon using (true) with check (true);
