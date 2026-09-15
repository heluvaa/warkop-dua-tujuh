'use client';

import { useState } from 'react';
import { UserRound, LogOut, Wallet } from 'lucide-react';
import type { ShiftEntry } from '@/lib/types';
import { formatRupiah } from '@/lib/utils/format';
import { useOperatorSession } from '@/lib/context/OperatorSessionContext';

/**
 * Baris tipis di paling atas halaman (khusus HP — md:hidden) berisi nama
 * kasir yang lagi jaga + tombol keluar. Sengaja bukan elemen "fixed" yang
 * melayang di pojok kanan atas, karena beberapa halaman (mis. Menu &
 * Stok) sudah punya tombol aksi sendiri persis di pojok itu ("+ Tambah")
 * — kalau dibuat melayang malah bisa saling tindih/menutupi.
 *
 * Di desktop info & tombol yang sama sudah ada di Sidebar (aside), jadi
 * bar ini tidak perlu tampil di sana.
 */
export default function OperatorBadge({
  name,
  onLogout,
  activeShift,
  onRequestCloseShift,
}: {
  name: string;
  onLogout: () => void;
  // Shift laci kas yang sedang berjalan (null/undefined kalau belum
  // dibuka) — dikelola terpusat di AuthGate, lihat komentar di sana.
  activeShift?: ShiftEntry | null;
  onRequestCloseShift?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const session = useOperatorSession();

  return (
    <div className="md:hidden flex items-center justify-between gap-2 px-3 py-1.5 bg-cream border-b border-cream-dark">
      {activeShift ? (
        <button
          onClick={onRequestCloseShift}
          className="flex items-center gap-1.5 text-xs text-espresso/70 min-w-0"
          title="Tutup shift"
        >
          <Wallet size={13} className="shrink-0 text-caramel" />
          <span className="truncate">
            Modal: <span className="font-medium text-espresso">{formatRupiah(activeShift.modalAwal)}</span>
          </span>
        </button>
      ) : (
        <span />
      )}

      {confirming ? (
        <div className="flex items-center gap-1.5 text-xs text-espresso/70">
          <span>Keluar?</span>
          <button
            onClick={onLogout}
            className="bg-brick text-cream rounded-full px-2 py-1 font-medium"
          >
            Ya
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-espresso/50 px-2 py-1"
          >
            Batal
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="flex items-center gap-1.5 text-xs text-espresso/70"
          title="Keluar / ganti kasir"
        >
          <span className="w-5 h-5 rounded-full bg-espresso text-cream flex items-center justify-center shrink-0">
            <UserRound size={11} />
          </span>
          <span className="font-medium text-espresso max-w-[7rem] truncate">{name}</span>
          <span className="text-espresso/40 text-[10px]">
            ({session.role === 'pemilik' ? 'Pemilik' : 'Kasir'})
          </span>
          <LogOut size={13} className="shrink-0" />
        </button>
      )}
    </div>
  );
}
