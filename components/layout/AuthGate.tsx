'use client';

import { useEffect, useState } from 'react';
import type { Operator, ShiftEntry } from '@/lib/types';
import {
  getAllOperators,
  getActiveOperator,
  setActiveOperator,
  clearActiveOperator,
  createOperator,
  type ActiveOperatorSession,
} from '@/lib/storage/operatorService';
import { getActiveShift, openShift, closeShift } from '@/lib/storage/shiftService';
import { OperatorSessionProvider } from '@/lib/context/OperatorSessionContext';
import OperatorGate from '@/components/kasir/OperatorGate';
import OpenShiftModal from '@/components/kasir/OpenShiftModal';
import CloseShiftModal from '@/components/kasir/CloseShiftModal';
import OperatorBadge from './OperatorBadge';
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
  // Sesi lengkap (bukan cuma nama) supaya role-nya bisa dibagikan ke
  // seluruh app lewat OperatorSessionProvider di bawah — lihat
  // lib/context/OperatorSessionContext.tsx.
  const [session, setSession] = useState<ActiveOperatorSession | null>(null);
  const activeOperatorName = session?.operatorName ?? null;
  // Shift laci kas — beda dari sesi operator di atas, lihat komentar di
  // lib/types.ts (ShiftEntry) & lib/storage/shiftService.ts. null berarti
  // belum ada shift yang dibuka (perlu isi modal awal dulu sebelum jualan).
  const [activeShift, setActiveShift] = useState<ShiftEntry | null>(null);
  const [showCloseShift, setShowCloseShift] = useState(false);

  // Shift dicari berdasarkan operatorId yang SEDANG login — tiap operator
  // punya shift & modal awalnya sendiri (lihat komentar di shiftService.ts).
  async function refreshShift(operatorId: string | undefined) {
    setActiveShift(operatorId ? await getActiveShift(operatorId) : null);
  }

  useEffect(() => {
    (async () => {
      setOperators(await getAllOperators());
      const activeSession = await getActiveOperator();
      setSession(activeSession);
      await refreshShift(activeSession?.operatorId);
      setChecking(false);
    })();
  }, []);

  async function handleUnlock(operator: Operator) {
    await setActiveOperator(operator);
    const newSession = await getActiveOperator();
    setSession(newSession);
    await refreshShift(newSession?.operatorId);
  }

  async function handleOpenShift(modalAwal: number) {
    if (!session) return;
    await openShift({
      operatorId: session.operatorId,
      operatorName: session.operatorName,
      modalAwal,
    });
    await refreshShift(session.operatorId);
  }

  async function handleCloseShift(data: { physicalCash: number; note?: string }) {
    if (!activeShift || !session) return;
    await closeShift({
      shiftId: activeShift.id,
      physicalCash: data.physicalCash,
      note: data.note,
      closedByOperatorId: session.operatorId,
      closedByOperatorName: session.operatorName,
    });
    setShowCloseShift(false);
    await refreshShift(session.operatorId);
  }

  // Hanya dipakai saat operators.length === 0 — bikin akun kasir pertama
  // langsung dari layar login (lihat komentar di OperatorGate.tsx), supaya
  // tidak ke-lock total tanpa jalan masuk ke Pengaturan.
  async function handleCreateFirstOperator(data: { name: string; pin: string }) {
    // Akun pertama yang dibuat dari layar login ini selalu jadi 'pemilik'
    // (bukan minta pilih role) — orang yang pertama kali setup aplikasi di
    // warung ini paling masuk akal dianggap pemiliknya, dan supaya tidak
    // ada skenario ke-lock dari fitur pemilik-only karena lupa pilih role.
    const operator = await createOperator({ ...data, role: 'pemilik' });
    setOperators([operator]);
    await handleUnlock(operator);
  }

  async function handleLogout() {
    await clearActiveOperator();
    setSession(null);
    // Kosongkan shift yang kelihatan di layar juga — operator berikutnya
    // yang login mungkin punya shift lain (atau belum ada shift sama
    // sekali), jangan sampai sempat kelihatan modal/badge milik operator
    // sebelumnya sebelum refreshShift() untuk sesi baru selesai.
    setActiveShift(null);
  }

  // Cegah "kedip" nampilin layar login sebentar sebelum sesi dicek.
  if (checking) return null;

  if (!activeOperatorName) {
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

  // session pasti tidak null di sini (activeOperatorName sudah dicek di
  // atas), tapi TypeScript belum tahu itu — bikin variabel lokal supaya
  // Provider di bawah type-safe tanpa banyak `!`.
  if (!session) return null;

  return (
    <OperatorSessionProvider
      value={{ operatorId: session.operatorId, operatorName: session.operatorName, role: session.role }}
    >
      <div className="flex flex-col md:flex-row min-h-screen">
        <Sidebar onLogout={handleLogout} activeShift={activeShift} onRequestCloseShift={() => setShowCloseShift(true)} />
        <div className="flex-1 flex flex-col min-h-screen min-w-0">
          <OperatorBadge
            name={activeOperatorName}
            onLogout={handleLogout}
            activeShift={activeShift}
            onRequestCloseShift={() => setShowCloseShift(true)}
          />
          <main className="flex-1 pb-16 md:pb-0">{children}</main>
        </div>

        {/* Belum ada shift yang dibuka — kasir HARUS isi modal awal dulu
            sebelum bisa mulai jualan, tidak bisa ditutup/dilewati begitu
            saja (tidak ada tombol batal), supaya tidak ada shift "liar"
            tanpa modal awal tercatat. */}
        {!activeShift && <OpenShiftModal operatorName={activeOperatorName} onConfirm={handleOpenShift} />}

        {showCloseShift && activeShift && (
          <CloseShiftModal
            shift={activeShift}
            operatorName={activeOperatorName}
            onClose={() => setShowCloseShift(false)}
            onConfirm={handleCloseShift}
          />
        )}
      </div>
    </OperatorSessionProvider>
  );
}
