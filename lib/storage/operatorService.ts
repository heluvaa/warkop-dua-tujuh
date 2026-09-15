/**
 * Akun kasir sederhana. Tujuannya cuma supaya tahu siapa yang jaga shift —
 * BUKAN sistem otentikasi sungguhan. PIN disimpan polos di localStorage,
 * jangan pakai untuk data sensitif.
 */

import { getItem, setItem, generateId, STORAGE_KEYS } from './db';
import type { Operator } from '../types';
import { todayDateKey } from '../utils/date';
import { formatTime } from '../utils/format';
import { sendTelegramNotification } from '../telegram';
import { getSettings } from './settingsService';

export async function getAllOperators(): Promise<Operator[]> {
  return getItem<Operator[]>(STORAGE_KEYS.OPERATORS, []);
}

export async function createOperator(data: { name: string; pin: string }): Promise<Operator> {
  const all = await getAllOperators();
  const newOp: Operator = {
    ...data,
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
  // Tanggal (YYYY-MM-DD) saat sesi dimulai — dipakai supaya sesi otomatis
  // dianggap habis begitu ganti hari, tanpa perlu logout manual tiap malam.
  dateKey: string;
}

// Sesi aktif hanya dianggap valid untuk hari yang sama. Ini bukan
// "logout" beneran, cuma reminder ringan siapa yang pegang kasir hari ini.
export async function getActiveOperator(): Promise<ActiveOperatorSession | null> {
  const session = await getItem<ActiveOperatorSession | null>(STORAGE_KEYS.ACTIVE_OPERATOR, null);
  if (!session || session.dateKey !== todayDateKey()) return null;
  return session;
}

export async function setActiveOperator(operator: Operator): Promise<void> {
  const session: ActiveOperatorSession = {
    operatorId: operator.id,
    operatorName: operator.name,
    dateKey: todayDateKey(),
  };
  await setItem(STORAGE_KEYS.ACTIVE_OPERATOR, session);

  const settings = await getSettings();
  if (settings.shiftNotifyEnabled) {
    await sendTelegramNotification(
      `🟢 <b>Kasir Dibuka</b>\n${operator.name}, ${formatTime(new Date())}`
    );
  }
}

export async function clearActiveOperator(): Promise<void> {
  // Ambil sesi yang masih aktif SEBELUM dihapus, supaya notifikasi tutup
  // shift tahu nama kasir yang barusan logout.
  const session = await getActiveOperator();
  await setItem(STORAGE_KEYS.ACTIVE_OPERATOR, null);

  if (session) {
    const settings = await getSettings();
    if (settings.shiftNotifyEnabled) {
      await sendTelegramNotification(
        `🔴 <b>Kasir Ditutup</b>\n${session.operatorName}, ${formatTime(new Date())}`
      );
    }
  }
}
