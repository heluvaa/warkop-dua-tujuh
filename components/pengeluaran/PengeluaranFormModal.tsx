'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { PengeluaranEntry } from '@/lib/types';

export default function PengeluaranFormModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: PengeluaranEntry | null;
  onClose: () => void;
  onSave: (data: { name: string; amount: number }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');

  const isValid = name.trim().length > 0 && Number(amount) > 0;
  const isEditing = Boolean(initial);

  function handleSubmit() {
    if (!isValid) return;
    onSave({ name: name.trim(), amount: Number(amount) });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-cream w-full sm:max-w-sm rounded-t-2xl sm:rounded-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg text-espresso">
            {isEditing ? 'Edit Pengeluaran' : 'Catat Pengeluaran'}
          </h2>
          <button onClick={onClose}>
            <X size={20} className="text-espresso/60" />
          </button>
        </div>

        <div>
          <label className="text-xs text-espresso/60">Nama Pengeluaran</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Beli es batu"
            className="w-full border border-cream-dark rounded-card px-4 py-2.5 bg-surface text-espresso mt-1 focus:outline-none focus:border-espresso"
          />
        </div>

        <div>
          <label className="text-xs text-espresso/60">Nominal</label>
          <input
            inputMode="numeric"
            value={amount ? Number(amount).toLocaleString('id-ID') : ''}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
            placeholder="20000"
            className="w-full border border-cream-dark rounded-card px-4 py-2.5 bg-surface text-espresso mt-1 focus:outline-none focus:border-espresso"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className="w-full bg-espresso text-cream rounded-card py-3 font-medium disabled:opacity-40"
        >
          {isEditing ? 'Simpan Perubahan' : 'Simpan'}
        </button>
      </div>
    </div>
  );
}
