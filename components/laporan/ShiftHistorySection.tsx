'use client';

import { useEffect, useState } from 'react';
import { Wallet, CheckCircle2, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import type { ShiftEntry } from '@/lib/types';
import { getShiftHistory } from '@/lib/storage/shiftService';
import { formatRupiah, formatDateTime } from '@/lib/utils/format';

// Riwayat shift laci kas (buka dengan modal awal, tutup dengan hitung fisik
// & selisih) — lihat lib/storage/shiftService.ts. Dipisah jadi komponen
// sendiri (bukan ditulis langsung di app/laporan/page.tsx yang sudah besar)
// karena datanya per-shift, bukan per-tanggal-yang-dipilih seperti bagian
// lain di halaman itu.
export default function ShiftHistorySection() {
  const [shifts, setShifts] = useState<ShiftEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    getShiftHistory()
      .then(setShifts)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (shifts.length === 0) return null;

  const visible = expanded ? shifts : shifts.slice(0, 5);

  return (
    <section className="mb-6">
      <h2 className="font-display font-semibold text-espresso mb-2 flex items-center gap-1.5">
        <Wallet size={17} /> Riwayat Shift
      </h2>
      <div className="space-y-2">
        {visible.map((shift) => (
          <ShiftRow key={shift.id} shift={shift} />
        ))}
      </div>
      {shifts.length > 5 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-sm font-medium text-espresso underline underline-offset-2"
        >
          {expanded ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${shifts.length})`}
        </button>
      )}
    </section>
  );
}

function ShiftRow({ shift }: { shift: ShiftEntry }) {
  if (shift.status === 'open') {
    return (
      <div className="bg-surface rounded-card border border-cream-dark p-3.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-espresso flex items-center gap-1.5">
            <Clock size={13} className="text-caramel shrink-0" />
            Sedang berjalan — {shift.operatorName}
          </p>
          <p className="text-xs text-espresso/50 mt-0.5">
            Dibuka {formatDateTime(shift.openedAt)} · Modal {formatRupiah(shift.modalAwal)}
          </p>
        </div>
      </div>
    );
  }

  const selisih = shift.selisih ?? 0;

  return (
    <div className="bg-surface rounded-card border border-cream-dark p-3.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-medium text-espresso truncate">
            {shift.operatorName}
            {shift.closedByOperatorName && shift.closedByOperatorName !== shift.operatorName
              ? ` → ditutup ${shift.closedByOperatorName}`
              : ''}
          </p>
          <p className="text-xs text-espresso/50 mt-0.5">
            {formatDateTime(shift.openedAt)} — {shift.closedAt ? formatDateTime(shift.closedAt) : '-'}
          </p>
        </div>
        <div
          className={`flex items-center gap-1.5 text-sm font-semibold shrink-0 ${
            selisih === 0 ? 'text-sage' : selisih > 0 ? 'text-caramel' : 'text-brick'
          }`}
        >
          {selisih === 0 ? (
            <CheckCircle2 size={15} />
          ) : selisih > 0 ? (
            <TrendingUp size={15} />
          ) : (
            <TrendingDown size={15} />
          )}
          {selisih === 0 ? 'Pas' : formatRupiah(Math.abs(selisih))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-cream-dark text-xs">
        <div>
          <p className="text-espresso/50">Modal Awal</p>
          <p className="font-medium text-espresso">{formatRupiah(shift.modalAwal)}</p>
        </div>
        <div>
          <p className="text-espresso/50">Kas Sistem</p>
          <p className="font-medium text-espresso">{formatRupiah(shift.systemCash ?? 0)}</p>
        </div>
        <div>
          <p className="text-espresso/50">Kas Fisik</p>
          <p className="font-medium text-espresso">{formatRupiah(shift.physicalCash ?? 0)}</p>
        </div>
      </div>

      {shift.note && (
        <p className="text-xs text-espresso/60 mt-2.5 pt-2.5 border-t border-cream-dark italic">
          &ldquo;{shift.note}&rdquo;
        </p>
      )}
    </div>
  );
}
