'use client';

import { useState } from 'react';
import { Coffee, Delete, UserRound } from 'lucide-react';
import type { Operator } from '@/lib/types';

const PIN_LENGTH = 4;

export default function OperatorGate({
  operators,
  onUnlock,
  onCreateFirstOperator,
}: {
  operators: Operator[];
  onUnlock: (operator: Operator) => void;
  // Kalau disediakan, dipakai untuk bikin akun kasir PERTAMA langsung dari
  // layar ini saat belum ada operator sama sekali — supaya tidak
  // ke-lock total (Pengaturan, tempat biasanya nambah kasir, sekarang ikut
  // terkunci di balik gate ini juga).
  onCreateFirstOperator?: (data: { name: string; pin: string }) => void | Promise<void>;
}) {
  const [selected, setSelected] = useState<Operator | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');

  function pickOperator(op: Operator) {
    setSelected(op);
    setPin('');
    setError('');
  }

  function pressDigit(d: string) {
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + d;
    setPin(next);
    setError('');
    if (next.length === PIN_LENGTH && selected) {
      if (next === selected.pin) {
        onUnlock(selected);
      } else {
        setError('PIN salah, coba lagi.');
        setTimeout(() => setPin(''), 400);
      }
    }
  }

  if (operators.length === 0) {
    if (!onCreateFirstOperator) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
          <Coffee size={32} className="text-espresso/40 mb-3" />
          <p className="text-espresso font-medium mb-1">Belum ada akun kasir</p>
          <p className="text-sm text-espresso/60 max-w-xs">
            Tambahkan kasir dulu di halaman Pengaturan &rarr; Kasir & Shift supaya bisa mulai jualan.
          </p>
        </div>
      );
    }

    const isNewValid = newName.trim().length > 0 && /^\d{4}$/.test(newPin);

    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 w-full">
        <Coffee size={28} className="text-caramel mb-3" />
        <h1 className="font-display font-semibold text-lg text-espresso mb-1">Selamat datang!</h1>
        <p className="text-sm text-espresso/60 mb-6 text-center max-w-xs">
          Belum ada akun kasir. Bikin akun kasir pertama dulu untuk mulai pakai aplikasi ini.
        </p>
        <div className="w-full max-w-xs space-y-3">
          <div>
            <label className="text-xs text-espresso/60">Nama Kasir</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Budi"
              className="w-full border border-cream-dark rounded-card px-4 py-2.5 bg-surface text-espresso mt-1 focus:outline-none focus:border-espresso"
            />
          </div>
          <div>
            <label className="text-xs text-espresso/60">PIN (4 digit)</label>
            <input
              inputMode="numeric"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="1234"
              className="w-full border border-cream-dark rounded-card px-4 py-2.5 bg-surface text-espresso mt-1 focus:outline-none focus:border-espresso tracking-widest"
            />
          </div>
          <button
            onClick={() => isNewValid && onCreateFirstOperator({ name: newName.trim(), pin: newPin })}
            disabled={!isNewValid}
            className="w-full bg-espresso text-cream rounded-card py-3 font-medium disabled:opacity-40"
          >
            Buat & Masuk
          </button>
          <p className="text-[11px] text-espresso/50 text-center">
            PIN cuma buat identifikasi shift, bukan keamanan data — pakai angka yang gampang diingat. Kasir lain bisa ditambahkan nanti di halaman Pengaturan.
          </p>
        </div>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
        <Coffee size={28} className="text-caramel mb-3" />
        <h1 className="font-display font-semibold text-lg text-espresso mb-1">Siapa yang jaga sekarang?</h1>
        <p className="text-sm text-espresso/60 mb-6 text-center">Pilih nama kamu untuk mulai shift kasir.</p>
        <div className="w-full max-w-xs space-y-2">
          {operators.map((op) => (
            <button
              key={op.id}
              onClick={() => pickOperator(op)}
              className="w-full flex items-center gap-3 bg-surface border border-cream-dark rounded-card px-4 py-3 text-left hover:border-crema transition-colors"
            >
              <span className="w-9 h-9 rounded-full bg-espresso text-cream flex items-center justify-center shrink-0">
                <UserRound size={16} />
              </span>
              <span className="font-medium text-espresso">{op.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
      <span className="w-12 h-12 rounded-full bg-espresso text-cream flex items-center justify-center mb-3">
        <UserRound size={20} />
      </span>
      <h1 className="font-display font-semibold text-lg text-espresso mb-1">{selected.name}</h1>
      <p className="text-sm text-espresso/60 mb-5">Masukkan PIN 4 digit</p>

      <div className="flex gap-3 mb-2">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span
            key={i}
            className={`w-3.5 h-3.5 rounded-full border-2 ${
              i < pin.length ? 'bg-espresso border-espresso' : 'border-cream-dark'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-brick h-4 mb-3">{error}</p>

      <div className="grid grid-cols-3 gap-3 w-full max-w-[240px]">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            onClick={() => pressDigit(d)}
            className="aspect-square rounded-full bg-surface border border-cream-dark text-espresso font-display font-semibold text-lg active:scale-95 transition-transform"
          >
            {d}
          </button>
        ))}
        <button
          onClick={() => pickOperator(selected)}
          className="aspect-square rounded-full text-espresso/50 text-xs font-medium"
        >
          Batal
        </button>
        <button
          onClick={() => pressDigit('0')}
          className="aspect-square rounded-full bg-surface border border-cream-dark text-espresso font-display font-semibold text-lg active:scale-95 transition-transform"
        >
          0
        </button>
        <button
          onClick={() => setPin((p) => p.slice(0, -1))}
          className="aspect-square rounded-full text-espresso/50 flex items-center justify-center"
          aria-label="Hapus"
        >
          <Delete size={18} />
        </button>
      </div>
    </div>
  );
}
