'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { Operator } from '@/lib/types';

export default function OperatorFormModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: Operator | null;
  onClose: () => void;
  onSave: (data: { name: string; pin: string }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [pin, setPin] = useState(initial?.pin ?? '');

  const isValid = name.trim().length > 0 && /^\d{4}$/.test(pin);

  function handleSubmit() {
    if (!isValid) return;
    onSave({ name: name.trim(), pin });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-cream w-full sm:max-w-sm rounded-t-2xl sm:rounded-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg text-espresso">
            {initial ? 'Ubah Kasir' : 'Tambah Kasir'}
          </h2>
          <button onClick={onClose}>
            <X size={20} className="text-espresso/60" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-espresso/60">Nama Kasir</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Budi"
              className="w-full border border-cream-dark rounded-card px-4 py-2.5 bg-surface text-espresso mt-1 focus:outline-none focus:border-espresso"
            />
          </div>
          <div>
            <label className="text-xs text-espresso/60">PIN (4 digit)</label>
            <input
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="1234"
              className="w-full border border-cream-dark rounded-card px-4 py-2.5 bg-surface text-espresso mt-1 focus:outline-none focus:border-espresso tracking-widest"
            />
            <p className="text-[11px] text-espresso/50 mt-1">
              PIN cuma buat identifikasi shift, bukan keamanan data — pakai angka yang gampang diingat.
            </p>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className="w-full bg-espresso text-cream rounded-card py-3 font-medium disabled:opacity-40"
        >
          Simpan
        </button>
      </div>
    </div>
  );
}
