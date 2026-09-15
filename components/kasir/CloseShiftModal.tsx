'use client';

import { useEffect, useState } from 'react';
import { X, Wallet, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';
import type { ShiftEntry } from '@/lib/types';
import { getShiftCashSummary, type ShiftCashSummary } from '@/lib/storage/shiftService';
import { formatRupiah } from '@/lib/utils/format';

export default function CloseShiftModal({
  shift,
  operatorName,
  onClose,
  onConfirm,
}: {
  shift: ShiftEntry;
  // Kasir yang sedang login SEKARANG (belum tentu sama dengan yang buka shift).
  operatorName: string;
  onClose: () => void;
  onConfirm: (data: { physicalCash: number; note?: string }) => void | Promise<void>;
}) {
  const [summary, setSummary] = useState<ShiftCashSummary | null>(null);
  const [physicalInput, setPhysicalInput] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Ringkasan dihitung ulang tiap modal ini dibuka (bukan sekali di awal
    // render halaman) supaya transaksi/pengeluaran terbaru ikut terhitung
    // kalau kasir sempat menunda konfirmasi tutup shift.
    getShiftCashSummary(shift).then(setSummary);
  }, [shift]);

  const physicalCash = Number(physicalInput) || 0;
  const isValid = physicalInput.length > 0;
  const selisih = summary ? physicalCash - summary.systemCash : 0;

  async function handleSubmit() {
    if (!isValid || submitting || !summary) return;
    setSubmitting(true);
    try {
      await onConfirm({ physicalCash, note: note.trim() || undefined });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-0 sm:px-4">
      <div className="bg-cream w-full sm:max-w-sm rounded-t-2xl sm:rounded-card p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg text-espresso">Tutup Shift</h2>
          <button onClick={onClose} aria-label="Tutup">
            <X size={20} className="text-espresso/60" />
          </button>
        </div>

        {!summary ? (
          <p className="text-sm text-espresso/60 py-6 text-center">Menghitung kas shift...</p>
        ) : (
          <>
            <div className="bg-surface border border-cream-dark rounded-card p-3.5 space-y-1.5 text-sm">
              <Row label="Modal awal" value={formatRupiah(shift.modalAwal)} />
              <Row label="Penjualan cash" value={formatRupiah(summary.cashSalesTotal)} />
              <Row label="Penjualan QRIS" value={formatRupiah(summary.qrisSalesTotal)} muted />
              <Row label="Pengeluaran" value={`- ${formatRupiah(summary.pengeluaranTotal)}`} />
              <div className="border-t border-cream-dark pt-1.5 mt-1.5">
                <Row label="Kas sistem (seharusnya)" value={formatRupiah(summary.systemCash)} bold />
              </div>
            </div>

            <div>
              <label className="text-xs text-espresso/60">Hasil Hitung Uang Fisik</label>
              <input
                inputMode="numeric"
                autoFocus
                value={physicalInput}
                onChange={(e) => setPhysicalInput(e.target.value.replace(/\D/g, ''))}
                placeholder="0"
                className="w-full border border-cream-dark rounded-card px-4 py-3 bg-surface text-espresso mt-1 text-lg font-semibold focus:outline-none focus:border-espresso"
              />
              <p className="text-xs text-espresso/50 mt-1">{formatRupiah(physicalCash)}</p>
            </div>

            {isValid && (
              <div
                className={`flex items-center gap-2.5 rounded-card px-3.5 py-3 text-sm font-medium ${
                  selisih === 0
                    ? 'bg-sage/10 text-sage'
                    : selisih > 0
                      ? 'bg-caramel/10 text-caramel'
                      : 'bg-brick/10 text-brick'
                }`}
              >
                {selisih === 0 ? (
                  <CheckCircle2 size={18} className="shrink-0" />
                ) : selisih > 0 ? (
                  <TrendingUp size={18} className="shrink-0" />
                ) : (
                  <TrendingDown size={18} className="shrink-0" />
                )}
                <span>
                  {selisih === 0
                    ? 'Kas pas, tidak ada selisih.'
                    : selisih > 0
                      ? `Lebih ${formatRupiah(selisih)}`
                      : `Kurang ${formatRupiah(Math.abs(selisih))}`}
                </span>
              </div>
            )}

            <div>
              <label className="text-xs text-espresso/60">Catatan (opsional)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={selisih !== 0 ? 'Contoh: ada uang recehan tercecer' : 'Contoh: aman, sudah dicek 2x'}
                className="w-full border border-cream-dark rounded-card px-4 py-2.5 bg-surface text-espresso mt-1 focus:outline-none focus:border-espresso"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={!isValid || submitting}
              className="w-full bg-espresso text-cream rounded-card py-3 font-medium disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <Wallet size={16} />
              {submitting ? 'Menutup Shift...' : 'Tutup Shift'}
            </button>
            <p className="text-[11px] text-espresso/50 text-center">
              Ditutup oleh {operatorName}. Dibuka oleh {shift.operatorName}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-espresso/50' : 'text-espresso/70'}>{label}</span>
      <span className={bold ? 'font-semibold text-espresso' : muted ? 'text-espresso/50' : 'text-espresso'}>
        {value}
      </span>
    </div>
  );
}
