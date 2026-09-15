'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Plus, Minus, Search } from 'lucide-react';
import type { KasbonEntry, MenuItem } from '@/lib/types';
import { getAllMenu } from '@/lib/storage/menuService';
import { formatRupiah } from '@/lib/utils/format';

interface KasbonItemDraft {
  name: string;
  price: number;
  quantity: number;
}

export default function KasbonFormModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: KasbonEntry | null;
  onClose: () => void;
  onSave: (data: { customerName: string; items: KasbonItemDraft[]; total: number }) => void;
}) {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [customerName, setCustomerName] = useState(initial?.customerName ?? '');
  const [items, setItems] = useState<KasbonItemDraft[]>(initial?.items ?? []);
  const [menuQuery, setMenuQuery] = useState('');

  const isEditing = Boolean(initial);

  useEffect(() => {
    (async () => setMenu(await getAllMenu()))();
  }, []);

  const filteredMenu = useMemo(() => {
    const q = menuQuery.trim().toLowerCase();
    if (!q) return menu;
    return menu.filter(
      (m) => m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)
    );
  }, [menu, menuQuery]);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const isValid = customerName.trim().length > 0 && items.length > 0;

  function addItem(menuItem: MenuItem) {
    setItems((prev) => {
      const existing = prev.find((i) => i.name === menuItem.name);
      if (existing) {
        return prev.map((i) => (i.name === menuItem.name ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { name: menuItem.name, price: menuItem.price, quantity: 1 }];
    });
  }

  function incItem(name: string) {
    setItems((prev) => prev.map((i) => (i.name === name ? { ...i, quantity: i.quantity + 1 } : i)));
  }

  function decItem(name: string) {
    setItems((prev) =>
      prev.map((i) => (i.name === name ? { ...i, quantity: i.quantity - 1 } : i)).filter((i) => i.quantity > 0)
    );
  }

  function handleSubmit() {
    if (!isValid) return;
    onSave({ customerName: customerName.trim(), items, total });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-cream w-full sm:max-w-md rounded-t-2xl sm:rounded-card p-5 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg text-espresso">
            {isEditing ? 'Edit Kasbon' : 'Kasbon Baru'}
          </h2>
          <button onClick={onClose}>
            <X size={20} className="text-espresso/60" />
          </button>
        </div>

        <div>
          <label className="text-xs text-espresso/60">Nama Pelanggan</label>
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Contoh: Pak Budi"
            className="w-full border border-cream-dark rounded-card px-4 py-2.5 bg-surface text-espresso mt-1 focus:outline-none focus:border-espresso"
          />
        </div>

        <div>
          <p className="text-xs text-espresso/60 mb-1.5">Pilih Pesanan</p>
          <div className="relative mb-2">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-espresso/40 pointer-events-none"
            />
            <input
              type="text"
              value={menuQuery}
              onChange={(e) => setMenuQuery(e.target.value)}
              placeholder="Cari menu..."
              className="w-full bg-surface border border-cream-dark rounded-card pl-8 pr-8 py-2 text-sm text-espresso placeholder:text-espresso/40 focus:outline-none focus:border-crema"
            />
            {menuQuery && (
              <button
                onClick={() => setMenuQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-espresso/40 hover:text-espresso"
                aria-label="Hapus pencarian"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {filteredMenu.length === 0 ? (
            <p className="text-sm text-espresso/50 text-center py-4">
              Tidak ada menu yang cocok dengan &quot;{menuQuery}&quot;.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
              {filteredMenu.map((m) => (
                <button
                  key={m.id}
                  onClick={() => addItem(m)}
                  className="text-left bg-surface border border-cream-dark rounded-card px-3 py-2 text-sm"
                >
                  <p className="text-espresso font-medium truncate">{m.name}</p>
                  <p className="text-espresso/50 text-xs">{formatRupiah(m.price)}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="bg-surface rounded-card p-3 space-y-2">
            {items.map((i) => (
              <div key={i.name} className="flex items-center justify-between text-sm">
                <span className="text-espresso">{i.name}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => decItem(i.name)}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-cream-dark text-espresso"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-4 text-center">{i.quantity}</span>
                  <button
                    onClick={() => incItem(i.name)}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-cream-dark text-espresso"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            ))}
            <div className="border-t border-cream-dark pt-2 flex justify-between font-semibold text-espresso">
              <span>Total</span>
              <span>{formatRupiah(total)}</span>
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className="w-full bg-espresso text-cream rounded-card py-3 font-medium disabled:opacity-40"
        >
          {isEditing ? 'Simpan Perubahan' : 'Simpan Kasbon'}
        </button>
      </div>
    </div>
  );
}
