'use client';

import { useState } from 'react';
import { X, Minus, Plus, Trash2 } from 'lucide-react';
import type { PendingOrder, TransactionLineItem } from '@/lib/types';
import { formatRupiah, formatItemLabel } from '@/lib/utils/format';
import { decrementStock, incrementStock, getMenuById } from '@/lib/storage/menuService';
import { updatePendingOrderItems } from '@/lib/storage/pendingOrderService';

// Dialog untuk MENGOREKSI item yang sudah ada di satu pesanan Belum Bayar —
// beda dengan AddItemsModal yang menambah baris baru. Dipakai kalau kasir
// salah input dari awal (mis. qty kebanyakan, atau menunya salah pencet):
// tiap baris bisa dikurangi/ditambah qty-nya atau dihapus sama sekali di
// sini. Stok disesuaikan sesuai selisih qty per baris begitu disimpan, sama
// seperti pola penyesuaian stok di halaman Belum Bayar (dilakukan di
// pemanggil, bukan di service).
export default function EditItemsModal({
  order,
  onClose,
  onDone,
}: {
  order: PendingOrder;
  onClose: () => void;
  onDone: () => void;
}) {
  const [items, setItems] = useState<TransactionLineItem[]>(() =>
    order.items.map((i) => ({ ...i }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const hasChanges =
    items.length !== order.items.length ||
    items.some((i, idx) => i.quantity !== order.items[idx]?.quantity);

  function handleIncrement(idx: number) {
    setError(null);
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, quantity: it.quantity + 1 } : it)));
  }

  function handleDecrement(idx: number) {
    setError(null);
    setItems((prev) =>
      prev
        .map((it, i) => (i === idx ? { ...it, quantity: it.quantity - 1 } : it))
        .filter((it) => it.quantity > 0)
    );
  }

  function handleRemove(idx: number) {
    setError(null);
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (saving || !hasChanges) return;
    if (items.length === 0) {
      setError('Minimal harus ada 1 item. Kalau mau batalkan semuanya, pakai tombol Batalkan Pesanan.');
      return;
    }

    setSaving(true);

    // Sesuaikan stok berdasarkan selisih qty tiap baris asal (dicocokkan
    // lewat menuItemId + variantLabel + note supaya baris yang persis sama
    // tetap terdeteksi meski urutannya berubah karena ada yang dihapus).
    for (const original of order.items) {
      if (!original.menuItemId) continue;
      const stillThere = items.find(
        (i) =>
          i.menuItemId === original.menuItemId &&
          i.variantLabel === original.variantLabel &&
          i.note === original.note
      );
      const newQty = stillThere?.quantity ?? 0;
      const delta = newQty - original.quantity;
      if (delta > 0) {
        const menuItem = await getMenuById(original.menuItemId);
        if (menuItem && menuItem.stock < delta) {
          setError(`Stok ${original.name} tidak cukup untuk ditambah.`);
          setSaving(false);
          return;
        }
        await decrementStock(original.menuItemId, delta);
      } else if (delta < 0) {
        await incrementStock(original.menuItemId, -delta);
      }
    }

    await updatePendingOrderItems(order.id, items);
    setSaving(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-cream rounded-t-card sm:rounded-card w-full sm:max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-cream-dark shrink-0">
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-espresso">Ubah Item</h2>
            <p className="text-xs text-espresso/50 truncate">
              {order.customerName || 'Tanpa nama'} · benerin kalau ada yang salah pesan
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

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {items.length === 0 ? (
            <p className="text-sm text-espresso/50 text-center py-6">
              Semua item dihapus. Simpan tidak bisa dilakukan — batalkan pesanan lewat halaman
              utama kalau memang sudah tidak jadi.
            </p>
          ) : (
            items.map((i, idx) => (
              <div
                key={`${i.menuItemId}-${idx}`}
                className="flex items-center justify-between gap-2 bg-surface border border-cream-dark rounded-card px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm text-espresso truncate">{formatItemLabel(i.name, i.variantLabel)}</p>
                  <p className="text-xs text-espresso/50">
                    {formatRupiah(i.price)}
                    {i.note && <span className="italic"> — &ldquo;{i.note}&rdquo;</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDecrement(idx)}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-cream-dark text-espresso"
                    aria-label="Kurangi"
                  >
                    <Minus size={13} />
                  </button>
                  <span className="w-5 text-center text-sm">{i.quantity}</span>
                  <button
                    onClick={() => handleIncrement(idx)}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-cream-dark text-espresso"
                    aria-label="Tambah"
                  >
                    <Plus size={13} />
                  </button>
                  <button
                    onClick={() => handleRemove(idx)}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-brick/10 text-brick"
                    aria-label="Hapus item ini"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}

          {error && <p className="text-xs text-brick text-center">{error}</p>}
        </div>

        <div className="border-t border-cream-dark px-4 py-3 flex items-center justify-between gap-3 shrink-0">
          <div>
            <p className="text-xs text-espresso/50">Total baru</p>
            <p className="font-semibold text-espresso">{formatRupiah(total)}</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges || items.length === 0}
            className="bg-espresso text-cream px-5 py-2.5 rounded-card font-medium disabled:opacity-40"
          >
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </div>
  );
}
