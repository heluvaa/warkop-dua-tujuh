'use client';

import { createContext, useContext } from 'react';
import type { OperatorRole } from '../types';

export interface OperatorSessionValue {
  operatorId: string;
  operatorName: string;
  role: OperatorRole;
}

const OperatorSessionContext = createContext<OperatorSessionValue | null>(null);

export const OperatorSessionProvider = OperatorSessionContext.Provider;

/**
 * Dipakai di halaman/komponen manapun yang dirender di dalam AuthGate untuk
 * tahu siapa kasir yang sedang login & role-nya (mis. untuk sembunyikan
 * Laba Bersih atau tombol hapus data dari kasir yang bukan pemilik).
 *
 * Melempar error kalau dipanggil di luar AuthGate — itu artinya ada bug
 * pemakaian (harusnya semua halaman aplikasi ini sudah pasti dibungkus
 * AuthGate, lihat app/layout.tsx), lebih baik ketahuan saat development
 * daripada diam-diam menganggap seseorang kasir biasa.
 */
export function useOperatorSession(): OperatorSessionValue {
  const ctx = useContext(OperatorSessionContext);
  if (!ctx) {
    throw new Error('useOperatorSession() dipanggil di luar OperatorSessionProvider (AuthGate)');
  }
  return ctx;
}

// Shortcut yang paling sering dipakai: apakah kasir yang login sekarang
// boleh lihat data finansial sensitif (Laba Bersih, Margin Produk) & lakukan
// aksi hapus data besar-besaran (Clear Data laporan, kelola akun kasir,
// pulihkan backup).
export function useIsPemilik(): boolean {
  return useOperatorSession().role === 'pemilik';
}
