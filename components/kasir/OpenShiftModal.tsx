'use client';

import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { formatRupiah, formatRupiahShort } from '@/lib/utils/format';

// Nominal cepat untuk modal awal — pecahan yang umum dipakai untuk isi laci
// kas warkop di awal shift (kembalian recehan).
const QUICK_AMOUNTS = [50000, 100000, 150000, 200000, 300000];

export default function OpenShiftModal({
  operatorName,
  onConfirm,
}: {
  operatorName: string;
  onConfirm: (modalAwal: number) => void | Promise<void>;
}) {
  const [amountInput, setAmountInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const modalAwal = Number(amountInput) || 0;
  const isValid = modalAwal >= 0 && amountInput.length > 0;

  function handleQuickAmount(amt: number) {
    setAmountInput((prev) => String((Number(prev) || 0) + amt));
  }

  async function handleSubmit() {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(modalAwal);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-0 sm:px-4">
      <div className="bg-cream w-full sm:max-w-sm rounded-t-2xl sm:rounded-card p-5 space-y-4">
        <div className="flex flex-col items-center text-center gap-2">
          <span className="w-11 h-11 rounded-full bg-espresso text-cream flex items-center justify-center">
            <Wallet size={20} />
          </span>
          <h2 className="font-display font-semibold text-lg text-espresso">Buka Shift</h2>
          <p className="text-sm text-espresso/60">
            {operatorName}, hitung dulu uang di laci kas sekarang lalu masukkan sebagai modal awal.
          </p>
        </div>

        <div>
          <label className="text-xs text-espresso/60">Modal Awal</label>
          <input
            inputMode="numeric"
            autoFocus
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value.replace(/\D/g, ''))}
            placeholder="0"
            className="w-full border border-cream-dark rounded-card px-4 py-3 bg-surface text-espresso mt-1 text-lg font-semibold focus:outline-none focus:border-espresso"
          />
          <p className="text-xs text-espresso/50 mt-1">{formatRupiah(modalAwal)}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((amt) => (
            <button
              key={amt}
              onClick={() => handleQuickAmount(amt)}
              className="px-3 py-1.5 rounded-full bg-surface border border-cream-dark text-xs font-medium text-espresso"
            >
              +{formatRupiahShort(amt)}
            </button>
          ))}
          <button
            onClick={() => setAmountInput('')}
            className="px-3 py-1.5 rounded-full text-xs font-medium text-espresso/50"
          >
            Reset
          </button>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="w-full bg-espresso text-cream rounded-card py-3 font-medium disabled:opacity-40"
        >
          {submitting ? 'Membuka Shift...' : 'Mulai Shift'}
        </button>
        <p className="text-[11px] text-espresso/50 text-center">
          Modal awal dipakai sebagai dasar hitung selisih kas saat shift ini nanti ditutup.
        </p>
      </div>
    </div>
  );
}
