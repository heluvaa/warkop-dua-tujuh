/**
 * Akun kasir sederhana. Tujuannya cuma supaya tahu siapa yang jaga shift —
 * BUKAN sistem otentikasi sungguhan. PIN disimpan polos di localStorage,
 * jangan pakai untuk data sensitif.
 */

import { getItem, setItem, getLocalItem, setLocalItem, generateId, STORAGE_KEYS } from './db';
import type { Operator, OperatorRole, LoginLogEntry, LoginLogAction } from '../types';
import { todayDateKey } from '../utils/date';
import { formatTime } from '../utils/format';
import { sendNotification } from '../notify';
import { getSettings } from './settingsService';

export async function getAllOperators(): Promise<Operator[]> {
  return getItem<Operator[]>(STORAGE_KEYS.OPERATORS, []);
}

// Akun yang belum punya field `role` (dibuat sebelum fitur ini ada)
// dianggap 'pemilik' — supaya kasir yang sudah lebih dulu pakai app ini
// tidak mendadak kehilangan akses ke Laba Bersih/hapus data begitu upgrade.
// Akun BARU selalu diminta pilih role secara eksplisit lewat form (lihat
// OperatorFormModal), jadi fallback ini murni untuk kompatibilitas data lama.
export function getOperatorRole(operator: Operator): OperatorRole {
  return operator.role ?? 'pemilik';
}

export function isPemilik(role: OperatorRole): boolean {
  return role === 'pemilik';
}

export async function createOperator(data: { name: string; pin: string; role?: OperatorRole }): Promise<Operator> {
  const all = await getAllOperators();
  const newOp: Operator = {
    name: data.name,
    pin: data.pin,
    role: data.role ?? 'kasir',
    id: generateId('op'),
    createdAt: new Date().toISOString(),
  };
  await setItem(STORAGE_KEYS.OPERATORS, [...all, newOp]);
  return newOp;
}

export async function updateOperator(id: string, data: Partial<Operator>): Promise<void> {
  const all = await getAllOperators();
  await setItem(
    STORAGE_KEYS.OPERATORS,
    all.map((o) => (o.id === id ? { ...o, ...data } : o))
  );
}

export async function deleteOperator(id: string): Promise<void> {
  const all = await getAllOperators();
  await setItem(
    STORAGE_KEYS.OPERATORS,
    all.filter((o) => o.id !== id)
  );
}

export interface ActiveOperatorSession {
  operatorId: string;
  operatorName: string;
  // Role diambil dari akun operator saat PIN dimasukkan (lihat
  // setActiveOperator) dan ikut disimpan di sesi supaya halaman manapun bisa
  // langsung tahu batasan akses tanpa perlu getAllOperators() ulang. Kalau
  // role operator diubah di Pengaturan, kasir yang sedang login perlu
  // logout/login lagi supaya sesinya ikut ter-update.
  role: OperatorRole;
  // Tanggal (YYYY-MM-DD) saat sesi dimulai — dipakai supaya sesi otomatis
  // dianggap habis begitu ganti hari, tanpa perlu logout manual tiap malam.
  dateKey: string;
}

// Sesi aktif hanya dianggap valid untuk hari yang sama. Ini bukan
// "logout" beneran, cuma reminder ringan siapa yang pegang kasir hari ini.
//
// Sengaja pakai getLocalItem/setLocalItem (selalu localStorage per-device),
// BUKAN getItem/setItem (yang lewat Supabase) — supaya status login kasir
// tidak dibagi/bocor ke device lain. Lihat komentar di lib/storage/db.ts.
export async function getActiveOperator(): Promise<ActiveOperatorSession | null> {
  const session = getLocalItem<ActiveOperatorSession | null>(STORAGE_KEYS.ACTIVE_OPERATOR, null);
  if (!session || session.dateKey !== todayDateKey()) return null;
  // Sesi yang tersimpan SEBELUM fitur role ada belum punya field `role` di
  // localStorage (meski tipenya bilang wajib ada) — fallback ke 'pemilik'
  // di sini juga, sama seperti getOperatorRole, supaya sesi lama yang masih
  // berlaku hari ini tidak mendadak kehilangan akses.
  return { ...session, role: session.role ?? 'pemilik' };
}

export async function setActiveOperator(operator: Operator): Promise<void> {
  const session: ActiveOperatorSession = {
    operatorId: operator.id,
    operatorName: operator.name,
    role: getOperatorRole(operator),
    dateKey: todayDateKey(),
  };
  setLocalItem(STORAGE_KEYS.ACTIVE_OPERATOR, session);
  await recordLoginLog(operator.id, operator.name, 'login');

  const settings = await getSettings();
  if (settings.shiftNotifyEnabled) {
    await sendNotification(
      `🟢 <b>Kasir Dibuka</b>\n${operator.name}, ${formatTime(new Date())}`
    );
  }
}

export async function clearActiveOperator(): Promise<void> {
  // Ambil sesi yang masih aktif SEBELUM dihapus, supaya notifikasi tutup
  // shift tahu nama kasir yang barusan logout.
  const session = await getActiveOperator();
  setLocalItem(STORAGE_KEYS.ACTIVE_OPERATOR, null);

  if (session) {
    await recordLoginLog(session.operatorId, session.operatorName, 'logout');

    const settings = await getSettings();
    if (settings.shiftNotifyEnabled) {
      await sendNotification(
        `🔴 <b>Kasir Ditutup</b>\n${session.operatorName}, ${formatTime(new Date())}`
      );
    }
  }
}

// Jumlah maksimum baris log yang disimpan — dipangkas dari yang paling
// lama supaya key ini tidak tumbuh tanpa batas (log ini murni catatan,
// bukan data yang wajib lengkap selamanya seperti transaksi).
const MAX_LOGIN_LOG_ENTRIES = 500;

async function getAllLoginLogs(): Promise<LoginLogEntry[]> {
  return getItem<LoginLogEntry[]>(STORAGE_KEYS.LOGIN_LOGS, []);
}

// Dipanggil dari setActiveOperator (login) & clearActiveOperator (logout)
// di atas — bukan API publik untuk dipanggil langsung dari luar, supaya
// satu-satunya jalan masuk log ini tetap lewat aksi login/logout beneran.
async function recordLoginLog(
  operatorId: string,
  operatorName: string,
  action: LoginLogAction
): Promise<void> {
  const all = await getAllLoginLogs();
  const entry: LoginLogEntry = {
    id: generateId('log'),
    operatorId,
    operatorName,
    action,
    at: new Date().toISOString(),
  };
  // Simpan yang terbaru duluan (mempermudah tampilan) & pangkas dari
  // ekor (yang paling lama) kalau sudah lewat batas.
  const next = [entry, ...all].slice(0, MAX_LOGIN_LOG_ENTRIES);
  await setItem(STORAGE_KEYS.LOGIN_LOGS, next);
}

// API publik untuk halaman Pengaturan — sudah terurut terbaru-duluan.
// `limit` opsional untuk membatasi berapa baris yang ditarik/ditampilkan.
export async function getLoginLogs(limit?: number): Promise<LoginLogEntry[]> {
  const all = await getAllLoginLogs();
  return typeof limit === 'number' ? all.slice(0, limit) : all;
}

// Dipakai tombol "Hapus Riwayat" di Pengaturan — cuma pemilik yang boleh
// (pengecekan role dilakukan di pemanggil/UI, bukan di sini).
export async function clearLoginLogs(): Promise<void> {
  await setItem(STORAGE_KEYS.LOGIN_LOGS, []);
}
