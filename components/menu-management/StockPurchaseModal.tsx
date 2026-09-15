'use client';

import { useMemo, useState } from 'react';
import { X, Search, Trash2, ShoppingBasket } from 'lucide-react';
import type { MenuItem, StockPurchaseLineItem } from '@/lib/types';
import { formatRupiah } from '@/lib/utils/format';

interface PurchaseDraft extends StockPurchaseLineItem {
  // Dipakai sebagai key React & untuk mencegah baris dobel untuk menu yang sama.
  key: string;
}

export default function StockPurchaseModal({
  menu,
  onClose,
  onSave,
}: {
  menu: MenuItem[];
  onClose: () => void;
  onSave: (data: { items: StockPurchaseLineItem[]; updateHpp: boolean }) => void;
}) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<PurchaseDraft[]>([]);
  const [updateHpp, setUpdateHpp] = useState(true);

  const filteredMenu = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return menu;
    return menu.filter(
      (m) => m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)
    );
  }, [menu, query]);

  const total = items.reduce((sum, i) => sum + i.totalCost, 0);
  const isValid = items.length > 0 && items.every((i) => i.quantity > 0 && i.totalCost > 0);

  function addItem(menuItem: MenuItem) {
    setItems((prev) => {
      if (prev.some((i) => i.menuItemId === menuItem.id)) return prev;
      return [...prev, { key: menuItem.id, menuItemId: menuItem.id, name: menuItem.name, quantity: 0, totalCost: 0 }];
    });
  }

  function updateLine(key: string, patch: Partial<PurchaseDraft>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function removeLine(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function handleSubmit() {
    if (!isValid) return;
    onSave({
      items: items.map(({ key, ...rest }) => rest),
      updateHpp,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-cream w-full sm:max-w-md rounded-t-2xl sm:rounded-card p-5 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg text-espresso flex items-center gap-2">
            <ShoppingBasket size={19} /> Belanja Stok
          </h2>
          <button onClick={onClose}>
            <X size={20} className="text-espresso/60" />
          </button>
        </div>
        <p className="text-xs text-espresso/50 -mt-2">
          Catat barang yang baru dibeli — stok otomatis bertambah dan tercatat sebagai
          pengeluaran. Barang yang belum ada di daftar menu, tambahkan dulu lewat &quot;+
          Tambah&quot; di halaman Menu.
        </p>

        <div>
          <div className="relative mb-2">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-espresso/40 pointer-events-none"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari menu untuk ditambah stoknya..."
              className="w-full bg-surface border border-cream-dark rounded-card pl-8 pr-8 py-2 text-sm text-espresso placeholder:text-espresso/40 focus:outline-none focus:border-crema"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-espresso/40 hover:text-espresso"
                aria-label="Hapus pencarian"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {filteredMenu.length === 0 ? (
            <p className="text-sm text-espresso/50 text-center py-4">
              Tidak ada menu yang cocok dengan &quot;{query}&quot;.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto pr-1">
              {filteredMenu.map((m) => {
                const added = items.some((i) => i.menuItemId === m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => addItem(m)}
                    disabled={added}
                    className="text-left bg-surface border border-cream-dark rounded-card px-3 py-2 text-sm disabled:opacity-40"
                  >
                    <p className="text-espresso font-medium truncate">{m.name}</p>
                    <p className="text-espresso/50 text-xs">Stok: {m.stock}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="space-y-2.5">
            {items.map((i) => {
              const unitCost = i.quantity > 0 ? i.totalCost / i.quantity : 0;
              return (
                <div key={i.key} className="bg-surface rounded-card p-3 border border-cream-dark space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-espresso truncate">{i.name}</span>
                    <button
                      onClick={() => removeLine(i.key)}
                      className="text-espresso/40 hover:text-brick shrink-0"
                      aria-label="Hapus baris"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-espresso/50">Jumlah masuk stok</label>
                      <input
                        inputMode="numeric"
                        value={i.quantity || ''}
                        onChange={(e) =>
                          updateLine(i.key, { quantity: Number(e.target.value.replace(/\D/g, '')) || 0 })
                        }
                        placeholder="30"
                        className="w-full border border-cream-dark rounded-card px-3 py-2 bg-cream text-sm text-espresso mt-0.5 focus:outline-none focus:border-espresso"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-espresso/50">Total harga beli</label>
                      <input
                        inputMode="numeric"
                        value={i.totalCost || ''}
                        onChange={(e) =>
                          updateLine(i.key, { totalCost: Number(e.target.value.replace(/\D/g, '')) || 0 })
                        }
                        placeholder="45000"
                        className="w-full border border-cream-dark rounded-card px-3 py-2 bg-cream text-sm text-espresso mt-0.5 focus:outline-none focus:border-espresso"
                      />
                    </div>
                  </div>
                  {i.quantity > 0 && i.totalCost > 0 && (
                    <p className="text-[11px] text-espresso/40">
                      ≈ {formatRupiah(unitCost)} / satuan
                    </p>
                  )}
                </div>
              );
            })}

            <label className="flex items-start gap-2 text-xs text-espresso/70 px-1">
              <input
                type="checkbox"
                checked={updateHpp}
                onChange={(e) => setUpdateHpp(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Perbarui HPP menu otomatis (rata-rata tertimbang dengan stok lama). Matikan kalau
                cuma mau tambah stok tanpa mengubah HPP.
              </span>
            </label>

            <div className="border-t border-cream-dark pt-2 flex justify-between font-semibold text-espresso">
              <span>Total Belanja</span>
              <span>{formatRupiah(total)}</span>
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className="w-full bg-espresso text-cream rounded-card py-3 font-medium disabled:opacity-40"
        >
          Simpan Belanja Stok
        </button>
      </div>
    </div>
  );
}
