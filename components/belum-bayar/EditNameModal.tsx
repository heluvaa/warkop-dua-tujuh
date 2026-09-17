'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

// Dialog ubah nama pelanggan untuk pesanan Belum Bayar yang sudah ada —
// dipakai baik untuk mengganti nama otomatis "Pelanggan N" maupun mengoreksi
// nama yang salah ketik, tanpa perlu batalkan & buat ulang pesanannya.
export default function EditNameModal({
  defaultName,
  onClose,
  onConfirm,
}: {
  defaultName?: string;
  onClose: () => void;
  onConfirm: (name: string) => void | Promise<void>;
}) {
  const [name, setName] = useState(defaultName ?? '');
  const trimmed = name.trim();
  const [submitting, setSubmitting] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function handleConfirmClick() {
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(trimmed);
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-cream w-full sm:max-w-sm rounded-t-2xl sm:rounded-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg text-espresso">Ubah Nama Pelanggan</h2>
          <button onClick={onClose} disabled={submitting}>
            <X size={20} className="text-espresso/60" />
          </button>
        </div>
        <div>
          <label className="text-xs text-espresso/60 mb-1 block">Nama Pelanggan</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama pelanggan"
            maxLength={40}
            disabled={submitting}
            className="w-full border border-cream-dark rounded-card px-4 py-3 text-espresso bg-surface focus:outline-none focus:border-espresso disabled:opacity-60"
          />
        </div>
        <button
          onClick={handleConfirmClick}
          disabled={!trimmed || submitting}
          className="w-full bg-espresso text-cream rounded-card py-3 font-medium disabled:opacity-40"
        >
          {submitting ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </div>
  );
}
