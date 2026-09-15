'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Check } from 'lucide-react';
import type { CartItem, PaymentMethod } from '@/lib/types';
import { formatRupiah } from '@/lib/utils/format';
import { GOOGLE_REVIEW_URL } from '@/lib/constants';

export default function ReceiptModal({
  items,
  total,
  method,
  cashReceived,
  change,
  onClose,
}: {
  items: CartItem[];
  total: number;
  method: PaymentMethod;
  cashReceived?: number;
  change?: number;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-cream w-full sm:max-w-sm rounded-t-2xl sm:rounded-card p-6 space-y-4 text-center max-h-[92vh] overflow-y-auto">
        <div className="w-12 h-12 rounded-full bg-sage/15 text-sage flex items-center justify-center mx-auto">
          <Check size={24} />
        </div>
        <h2 className="font-display font-semibold text-lg text-espresso">Pesanan Selesai</h2>

        <div className="bg-surface rounded-card p-4 text-left space-y-1.5">
          {items.map(({ menuItem, quantity, note }) => (
            <div key={menuItem.id} className="flex justify-between text-sm text-espresso/80 gap-2">
              <span className="min-w-0">
                {menuItem.name} x{quantity}
                {note && <span className="block text-xs text-espresso/50 italic truncate">&ldquo;{note}&rdquo;</span>}
              </span>
              <span className="shrink-0">{formatRupiah(menuItem.price * quantity)}</span>
            </div>
          ))}
          <div className="border-t border-cream-dark mt-2 pt-2 flex justify-between font-semibold text-espresso">
            <span>Total</span>
            <span>{formatRupiah(total)}</span>
          </div>
          <div className="flex justify-between text-xs text-espresso/50">
            <span>Metode</span>
            <span>{method === 'cash' ? 'Cash' : 'QRIS'}</span>
          </div>
          {method === 'cash' && (
            <div className="flex justify-between text-xs text-espresso/50">
              <span>Kembalian</span>
              <span>{formatRupiah(change || 0)}</span>
            </div>
          )}
        </div>

        <div className="pt-2">
          <p className="text-sm text-espresso/70 mb-3">Suka kopinya? Bantu kasih ulasan ya 🙏</p>
          <div className="flex justify-center bg-white p-3 rounded-card w-fit mx-auto">
            <QRCodeSVG value={GOOGLE_REVIEW_URL} size={140} fgColor="#3C2415" />
          </div>
        </div>

        <button onClick={onClose} className="w-full bg-espresso text-cream rounded-card py-3 font-medium">
          Pesanan Baru
        </button>
      </div>
    </div>
  );
}
