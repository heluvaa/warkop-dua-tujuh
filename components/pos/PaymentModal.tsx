'use client';

import { useMemo, useState } from 'react';
import { X, Banknote, QrCode } from 'lucide-react';
import type { PaymentMethod } from '@/lib/types';
import { formatRupiah } from '@/lib/utils/format';

export default function PaymentModal({
  total,
  onClose,
  onConfirm,
}: {
  total: number;
  onClose: () => void;
  onConfirm: (method: PaymentMethod, cashReceived?: number) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [cashInput, setCashInput] = useState('');

  const cashReceived = Number(cashInput) || 0;
  const change = useMemo(() => Math.max(0, cashReceived - total), [cashReceived, total]);
  const isValid = method === 'qris' || cashReceived >= total;

  const quickAmounts = [5000, 10000, 20000, 50000, 100000];

  function handleQuickAmount(amt: number) {
    // Ditambahkan ke nominal yang sudah ada, bukan diganti — supaya kasir
    // bisa tap beberapa pecahan uang sekaligus (mis. 50rb + 20rb) sesuai
    // uang fisik yang diterima dari pelanggan.
    setCashInput((prev) => String((Number(prev) || 0) + amt));
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-cream w-full sm:max-w-sm rounded-t-2xl sm:rounded-card p-5 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg text-espresso">Pembayaran</h2>
          <button onClick={onClose}>
            <X size={20} className="text-espresso/60" />
          </button>
        </div>

        <div className="bg-surface rounded-card p-4 text-center">
          <p className="text-xs text-espresso/50">Total Tagihan</p>
          <p className="text-2xl font-display font-semibold text-espresso">{formatRupiah(total)}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMethod('cash')}
            className={`flex flex-col items-center gap-1.5 py-3 rounded-card border ${
              method === 'cash' ? 'border-espresso bg-surface' : 'border-cream-dark bg-surface/50 text-espresso/50'
            }`}
          >
            <Banknote size={20} />
            <span className="text-sm">Cash</span>
          </button>
          <button
            onClick={() => setMethod('qris')}
            className={`flex flex-col items-center gap-1.5 py-3 rounded-card border ${
              method === 'qris' ? 'border-espresso bg-surface' : 'border-cream-dark bg-surface/50 text-espresso/50'
            }`}
          >
            <QrCode size={20} />
            <span className="text-sm">QRIS</span>
          </button>
        </div>

        {method === 'cash' && (
          <div className="space-y-2">
            <input
              inputMode="numeric"
              placeholder="Nominal diterima"
              value={cashInput ? Number(cashInput).toLocaleString('id-ID') : ''}
              onChange={(e) => setCashInput(e.target.value.replace(/\D/g, ''))}
              className="w-full border border-cream-dark rounded-card px-4 py-3 text-espresso bg-surface focus:outline-none focus:border-espresso"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-2 flex-wrap">
                {quickAmounts.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => handleQuickAmount(amt)}
                    className="text-xs px-3 py-1.5 rounded-full bg-surface border border-cream-dark text-espresso/70"
                  >
                    {formatRupiah(amt)}
                  </button>
                ))}
              </div>
              {cashInput && (
                <button
                  onClick={() => setCashInput('')}
                  className="text-xs px-2.5 py-1.5 rounded-full text-espresso/50 hover:text-espresso shrink-0"
                >
                  Reset
                </button>
              )}
            </div>
            <div className="flex items-center justify-between text-sm px-1">
              <span className="text-espresso/60">Kembalian</span>
              <span className="font-semibold text-sage">{formatRupiah(change)}</span>
            </div>
          </div>
        )}

        {method === 'qris' && (
          <p className="text-sm text-espresso/60 text-center py-2">
            Konfirmasi setelah pembayaran QRIS diterima di mesin/aplikasi QRIS Anda.
          </p>
        )}

        <button
          onClick={() => onConfirm(method, method === 'cash' ? cashReceived : undefined)}
          disabled={!isValid}
          className="w-full bg-espresso text-cream rounded-card py-3 font-medium disabled:opacity-40"
        >
          Konfirmasi Pembayaran
        </button>
      </div>
    </div>
  );
}
