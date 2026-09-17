'use client';

import { useEffect, useState } from 'react';
import { X, Minus, Plus, Trash2 } from 'lucide-react';
import type { CartItem, MenuItem, PendingOrder, SelectedVariant } from '@/lib/types';
import { formatRupiah } from '@/lib/utils/format';
import { getAllMenu, decrementStock } from '@/lib/storage/menuService';
import { addItemsToPendingOrder } from '@/lib/storage/pendingOrderService';
import {
  buildCartLineId,
  computeVariantExtra,
  formatSelectedVariantLabel,
  hasAnyVariantConfig,
} from '@/lib/utils/variant';
import MenuGrid from '@/components/pos/MenuGrid';
import VariantPickerModal from '@/components/pos/VariantPickerModal';

// Dialog untuk menambahkan item baru ke pesanan yang sudah ada di daftar
// Belum Bayar (mis. pelanggan nambah pesanan lagi sebelum bayar). Alurnya
// sengaja dibuat mirip keranjang Kasir (pilih menu -> atur qty -> konfirmasi)
// supaya kasir tidak perlu belajar pola baru, tapi lebih ringkas karena tidak
// perlu nama pelanggan/metode bayar — itu sudah ada di pesanan asalnya.
export default function AddItemsModal({
  order,
  onClose,
  onDone,
}: {
  order: PendingOrder;
  onClose: () => void;
  onDone: () => void;
}) {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [variantPickerItem, setVariantPickerItem] = useState<MenuItem | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => setMenu(await getAllMenu()))();
  }, []);

  function totalQtyForMenuItem(cartState: CartItem[], menuItemId: string): number {
    return cartState
      .filter((c) => c.menuItem.id === menuItemId)
      .reduce((sum, c) => sum + c.quantity, 0);
  }

  function addToCart(item: MenuItem, variant?: SelectedVariant) {
    const lineId = buildCartLineId(item.id, variant);
    setCart((prev) => {
      if (totalQtyForMenuItem(prev, item.id) >= item.stock) return prev;
      const existing = prev.find((c) => c.id === lineId);
      if (existing) {
        return prev.map((c) => (c.id === lineId ? { ...c, quantity: c.quantity + 1 } : c));
      }
      const unitPrice = item.price + computeVariantExtra(variant);
      return [...prev, { id: lineId, menuItem: item, quantity: 1, variant, unitPrice }];
    });
  }

  function handleAdd(item: MenuItem) {
    if (hasAnyVariantConfig(item.variants)) {
      setVariantPickerItem(item);
    } else {
      addToCart(item);
    }
  }

  function handleConfirmVariant(variant: SelectedVariant) {
    if (variantPickerItem) addToCart(variantPickerItem, variant);
    setVariantPickerItem(null);
  }

  function handleIncrement(lineId: string) {
    setCart((prev) => {
      const line = prev.find((c) => c.id === lineId);
      if (!line) return prev;
      if (totalQtyForMenuItem(prev, line.menuItem.id) >= line.menuItem.stock) return prev;
      return prev.map((c) => (c.id === lineId ? { ...c, quantity: c.quantity + 1 } : c));
    });
  }

  function handleDecrement(lineId: string) {
    setCart((prev) =>
      prev
        .map((c) => (c.id === lineId ? { ...c, quantity: c.quantity - 1 } : c))
        .filter((c) => c.quantity > 0)
    );
  }

  function handleRemove(lineId: string) {
    setCart((prev) => prev.filter((c) => c.id !== lineId));
  }

  const addTotal = cart.reduce((sum, c) => sum + c.unitPrice * c.quantity, 0);

  async function handleConfirm() {
    if (cart.length === 0 || saving) return;
    setSaving(true);
    const lineItems = cart.map((c) => ({
      menuItemId: c.menuItem.id,
      name: c.menuItem.name,
      price: c.unitPrice,
      hpp: c.menuItem.hpp ?? 0,
      quantity: c.quantity,
      note: c.note?.trim() || undefined,
      variantLabel: formatSelectedVariantLabel(c.variant),
    }));
    await addItemsToPendingOrder(order.id, lineItems);
    for (const c of cart) {
      await decrementStock(c.menuItem.id, c.quantity);
    }
    setSaving(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-cream rounded-t-card sm:rounded-card w-full sm:max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-cream-dark shrink-0">
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-espresso">Tambah Pesanan</h2>
            <p className="text-xs text-espresso/50 truncate">
              {order.customerName || 'Tanpa nama'} · sudah ada {formatRupiah(order.total)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-cream-dark text-espresso shrink-0"
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <MenuGrid menu={menu} onAdd={handleAdd} onToggleFavorite={() => {}} />
        </div>

        {cart.length > 0 && (
          <div className="border-t border-cream-dark px-4 py-3 space-y-2 max-h-44 overflow-y-auto shrink-0">
            {cart.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="text-espresso truncate">
                    {c.menuItem.name}
                    {formatSelectedVariantLabel(c.variant) && (
                      <span className="text-espresso/50"> · {formatSelectedVariantLabel(c.variant)}</span>
                    )}
                  </p>
                  <p className="text-xs text-espresso/50">{formatRupiah(c.unitPrice)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDecrement(c.id)}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-cream-dark text-espresso"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-4 text-center">{c.quantity}</span>
                  <button
                    onClick={() => handleIncrement(c.id)}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-cream-dark text-espresso"
                  >
                    <Plus size={12} />
                  </button>
                  <button
                    onClick={() => handleRemove(c.id)}
                    className="text-brick"
                    aria-label="Hapus"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-cream-dark px-4 py-3 flex items-center justify-between gap-3 shrink-0">
          <div>
            <p className="text-xs text-espresso/50">Tambahan</p>
            <p className="font-semibold text-espresso">{formatRupiah(addTotal)}</p>
          </div>
          <button
            onClick={handleConfirm}
            disabled={cart.length === 0 || saving}
            className="bg-espresso text-cream px-5 py-2.5 rounded-card font-medium disabled:opacity-40"
          >
            {saving ? 'Menyimpan...' : 'Tambahkan ke Pesanan'}
          </button>
        </div>
      </div>

      {variantPickerItem && (
        <VariantPickerModal
          item={variantPickerItem}
          onClose={() => setVariantPickerItem(null)}
          onConfirm={handleConfirmVariant}
        />
      )}
    </div>
  );
}
