'use client';

import { useEffect, useState } from 'react';
import type { Operator } from '@/lib/types';
import { getAllOperators, getActiveOperator, setActiveOperator, createOperator } from '@/lib/storage/operatorService';
import OperatorGate from '@/components/kasir/OperatorGate';
import Sidebar from './Sidebar';

/**
 * Gerbang login kasir untuk SELURUH aplikasi — bukan cuma halaman Kasir.
 *
 * Selama belum ada operator aktif (belum "unlock" pakai PIN), tidak ada
 * satu halaman pun (Menu, Kasbon, Pengeluaran, Laporan, Pengaturan, dst)
 * yang dirender — termasuk Sidebar-nya. Begitu operator ter-set (lihat
 * `operatorService.setActiveOperator`), seluruh app + navigasi baru
 * muncul.
 *
 * Ingat: ini tetap PIN 4 digit yang disimpan polos di localStorage/kv
 * store (lihat komentar di operatorService.ts) — cukup untuk mencegah
 * orang iseng buka-buka data warung, TAPI bukan otentikasi yang aman
 * secara kriptografis.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    (async () => {
      setOperators(await getAllOperators());
      const session = await getActiveOperator();
      setUnlocked(!!session);
      setChecking(false);
    })();
  }, []);

  async function handleUnlock(operator: Operator) {
    await setActiveOperator(operator);
    setUnlocked(true);
  }

  // Hanya dipakai saat operators.length === 0 — bikin akun kasir pertama
  // langsung dari layar login (lihat komentar di OperatorGate.tsx), supaya
  // tidak ke-lock total tanpa jalan masuk ke Pengaturan.
  async function handleCreateFirstOperator(data: { name: string; pin: string }) {
    const operator = await createOperator(data);
    setOperators([operator]);
    await handleUnlock(operator);
  }

  // Cegah "kedip" nampilin layar login sebentar sebelum sesi dicek.
  if (checking) return null;

  if (!unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream px-4">
        <OperatorGate
          operators={operators}
          onUnlock={handleUnlock}
          onCreateFirstOperator={handleCreateFirstOperator}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Sidebar onLogout={() => setUnlocked(false)} />
      <main className="flex-1 pb-16 md:pb-0 min-h-screen">{children}</main>
    </div>
  );
}
