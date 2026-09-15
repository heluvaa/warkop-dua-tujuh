'use client';

import { useState } from 'react';
import type { KasbonEntry } from '@/lib/types';
import { formatRupiah, formatDateTime, formatItemLabel } from '@/lib/utils/format';
import { daysSince } from '@/lib/utils/date';
import { KASBON_OVERDUE_DAYS } from '@/lib/constants';
import { AlertTriangle, Pencil, Trash2 } from 'lucide-react';

export default function KasbonListItem({
  entry,
  onLunasi,
  onEdit,
  onDelete,
}: {
  entry: KasbonEntry;
  onLunasi: () => void | Promise<void>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const lunas = entry.status === 'lunas';
  const umurHari = daysSince(entry.createdAt);
  const overdue = !lunas && umurHari >= KASBON_OVERDUE_DAYS;
  // Cegah tombol "Lunasi" kepencet dua kali dengan cepat — sekali diproses,
  // dikunci sampai selesai supaya tidak dobel jadi transaksi & notifikasi.
  const [lunasiLoading, setLunasiLoading] = useState(false);

  async function handleLunasiClick() {
    if (lunasiLoading) return;
    setLunasiLoading(true);
    try {
      await onLunasi();
    } finally {
      // Kartu ini biasanya berpindah kategori (hilang dari daftar "Belum
      // Lunas") begitu berhasil, jadi reset ini cuma jaga-jaga kalau
      // ternyata masih tampil (mis. filter "Semua").
      setLunasiLoading(false);
    }
  }

  return (
    <div className={`bg-surface rounded-card p-4 border ${overdue ? 'border-brick/40' : 'border-cream-dark'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-espresso">{entry.customerName}</p>
          <p className="text-xs text-espresso/50">{formatDateTime(entry.createdAt)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`text-[11px] px-2.5 py-1 rounded-full font-medium shrink-0 ${
              lunas ? 'bg-sage/15 text-sage' : 'bg-brick/10 text-brick'
            }`}
          >
            {lunas ? 'Lunas' : 'Belum Lunas'}
          </span>
          {overdue && (
            <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-medium bg-brick text-cream shrink-0">
              <AlertTriangle size={11} /> {umurHari} hari
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 space-y-0.5">
        {entry.items.map((i, idx) => (
          <p key={idx} className="text-xs text-espresso/60">
            {formatItemLabel(i.name, i.variantLabel)} x{i.quantity}
          </p>
        ))}
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className="font-semibold text-espresso">{formatRupiah(entry.total)}</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onEdit}
            disabled={lunasiLoading}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-cream-dark text-espresso disabled:opacity-40"
            aria-label="Edit kasbon"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            disabled={lunasiLoading}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-brick/10 text-brick disabled:opacity-40"
            aria-label="Hapus kasbon"
          >
            <Trash2 size={14} />
          </button>
          {!lunas && (
            <button
              onClick={handleLunasiClick}
              disabled={lunasiLoading}
              className="text-sm bg-espresso text-cream px-4 py-1.5 rounded-card disabled:opacity-60"
            >
              {lunasiLoading ? 'Memproses...' : 'Lunasi'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
