'use client';

import { useState } from 'react';
import type { CartItem } from '@/lib/types';
import { formatRupiah } from '@/lib/utils/format';
import { Minus, Plus, Trash2, MessageSquarePlus, User } from 'lucide-react';

export default function Cart({
  cart,
  customerName,
  onCustomerNameChange,
  onIncrement,
  onDecrement,
  onRemove,
  onNoteChange,
  onCheckout,
}: {
  cart: CartItem[];
  customerName: string;
  onCustomerNameChange: (value: string) => void;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
  onNoteChange: (id: string, note: string) => void;
  onCheckout: () => void;
}) {
  const total = cart.reduce((sum, c) => sum + c.menuItem.price * c.quantity, 0);
  // Melacak item mana yang sedang menampilkan input catatan, supaya tidak
  // semua item langsung terbuka kolomnya sekaligus.
  const [openNoteFor, setOpenNoteFor] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full">
      <h2 className="font-display font-semibold text-espresso text-lg px-4 pt-4">Pesanan</h2>

      {cart.length > 0 && (
        <div className="px-4 pt-3">
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-espresso/40 pointer-events-none" />
            <input
              type="text"
              value={customerName}
              onChange={(e) => onCustomerNameChange(e.target.value)}
              placeholder="Nama pelanggan (opsional)"
              maxLength={40}
              className="w-full text-sm bg-surface border border-cream-dark rounded-card pl-8 pr-3 py-2 text-espresso placeholder:text-espresso/40 outline-none focus:border-espresso"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {cart.length === 0 ? (
          <p className="text-sm text-espresso/50 text-center py-8">Keranjang masih kosong.</p>
        ) : (
          cart.map(({ menuItem, quantity, note }) => (
            <div key={menuItem.id} className="space-y-1.5">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-espresso truncate">{menuItem.name}</p>
                  <p className="text-xs text-espresso/50">{formatRupiah(menuItem.price)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onDecrement(menuItem.id)}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-cream-dark text-espresso"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="text-sm w-4 text-center">{quantity}</span>
                  <button
                    onClick={() => onIncrement(menuItem.id)}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-cream-dark text-espresso"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <button onClick={() => onRemove(menuItem.id)} className="text-brick/70 hover:text-brick">
                  <Trash2 size={15} />
                </button>
              </div>

              {openNoteFor === menuItem.id ? (
                <input
                  autoFocus
                  type="text"
                  value={note ?? ''}
                  onChange={(e) => onNoteChange(menuItem.id, e.target.value)}
                  onBlur={() => setOpenNoteFor(null)}
                  placeholder="Catatan, mis. less ice, pedas..."
                  maxLength={80}
                  className="w-full text-xs bg-cream border border-cream-dark rounded-md px-2.5 py-1.5 text-espresso outline-none focus:border-espresso"
                />
              ) : note ? (
                <button
                  onClick={() => setOpenNoteFor(menuItem.id)}
                  className="text-xs text-espresso/60 italic text-left truncate max-w-full"
                >
                  &ldquo;{note}&rdquo;
                </button>
              ) : (
                <button
                  onClick={() => setOpenNoteFor(menuItem.id)}
                  className="flex items-center gap-1 text-[11px] text-espresso/40 hover:text-espresso/70"
                >
                  <MessageSquarePlus size={12} /> Tambah catatan
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="border-t border-cream-dark px-4 py-4 space-y-3">
        <div className="flex items-center justify-between font-semibold text-espresso">
          <span>Total</span>
          <span>{formatRupiah(total)}</span>
        </div>
        <button
          onClick={onCheckout}
          disabled={cart.length === 0}
          className="w-full bg-espresso text-cream rounded-card py-3 font-medium disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] transition-transform"
        >
          Selesaikan Pesanan
        </button>
      </div>
    </div>
  );
}
