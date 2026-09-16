'use client';

import { useState } from 'react';
import { X, Wallet } from 'lucide-react';
import type { KasbonEntry } from '@/lib/types';
import { getKasbonAmountPaid, getKasbonSisa } from '@/lib/storage/kasbonService';
import { formatRupiah } from '@/lib/utils/format';

// Modal pembayaran kasbon — bisa dipakai untuk lunasi penuh (nominal
// prefill = sisa penuh, tinggal tekan Bayar) maupun cicilan sebagian
// (nominal diedit lebih kecil dari sisa). Dipisah dari tombol "Lunasi"
// cepat di KasbonListItem supaya kasir yang cuma mau bayar penuh tidak
// perlu buka modal ini sama sekali — lihat app/kasbon/page.tsx.
export default function KasbonCicilanModal({
  entry,
  onClose,
  onConfirm,
}: {
  entry: KasbonEntry;
  onClose: () => void;
  onConfirm: (amount: number) => void | Promise<void>;
}) {
  const sisa = getKasbonSisa(entry);
  const sudahDibayar = getKasbonAmountPaid(entry);
  const [amountInput, setAmountInput] = useState(String(sisa));
  const [submitting, setSubmitting] = useState(false);

  const amount = Number(amountInput) || 0;
  const isValid = amount > 0 && amount <= sisa;
  const isPelunasanPenuh = amount === sisa;

  async function handleSubmit() {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(amount);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-0 sm:px-4">
      <div className="bg-cream w-full sm:max-w-sm rounded-t-2xl sm:rounded-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg text-espresso flex items-center gap-1.5">
            <Wallet size={18} /> Bayar Kasbon
          </h2>
          <button onClick={onClose} disabled={submitting} aria-label="Tutup">
            <X size={20} className="text-espresso/60" />
          </button>
        </div>

        <div className="bg-surface rounded-card border border-cream-dark p-3 text-sm">
          <p className="font-medium text-espresso">{entry.customerName}</p>
          <div className="flex items-center justify-between mt-1.5 text-xs text-espresso/60">
            <span>Total kasbon</span>
            <span>{formatRupiah(entry.total)}</span>
          </div>
          {sudahDibayar > 0 && (
            <div className="flex items-center justify-between mt-0.5 text-xs text-sage">
              <span>Sudah dibayar</span>
              <span>{formatRupiah(sudahDibayar)}</span>
            </div>
          )}
          <div className="flex items-center justify-between mt-0.5 text-xs font-semibold text-brick">
            <span>Sisa</span>
            <span>{formatRupiah(sisa)}</span>
          </div>
        </div>

        <div>
          <label className="text-xs text-espresso/60">Nominal Dibayar</label>
          <input
            inputMode="numeric"
            autoFocus
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value.replace(/\D/g, ''))}
            placeholder="0"
            className="w-full border border-cream-dark rounded-card px-4 py-3 bg-surface text-espresso mt-1 text-lg font-semibold focus:outline-none focus:border-espresso"
          />
          {amount > sisa && (
            <p className="text-xs text-brick mt-1">Tidak boleh lebih dari sisa kasbon.</p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setAmountInput(String(Math.round(sisa / 2)))}
            disabled={submitting}
            className="flex-1 px-3 py-1.5 rounded-full bg-surface border border-cream-dark text-xs font-medium text-espresso disabled:opacity-40"
          >
            Separuh ({formatRupiah(Math.round(sisa / 2))})
          </button>
          <button
            onClick={() => setAmountInput(String(sisa))}
            disabled={submitting}
            className="flex-1 px-3 py-1.5 rounded-full bg-surface border border-cream-dark text-xs font-medium text-espresso disabled:opacity-40"
          >
            Lunas ({formatRupiah(sisa)})
          </button>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="w-full bg-espresso text-cream rounded-card py-3 font-medium disabled:opacity-40"
        >
          {submitting ? 'Memproses...' : isPelunasanPenuh ? 'Lunasi' : 'Catat Cicilan'}
        </button>
      </div>
    </div>
  );
}
