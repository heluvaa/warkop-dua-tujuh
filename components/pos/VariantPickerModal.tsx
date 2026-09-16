'use client';

import { useState } from 'react';
import { X, Check } from 'lucide-react';
import type { MenuItem, MenuVariantOption, MenuToppingOption, SelectedVariant } from '@/lib/types';
import { formatRupiah } from '@/lib/utils/format';
import { computeVariantExtra } from '@/lib/utils/variant';

// Dialog pilihan varian yang muncul saat kasir menambahkan menu yang punya
// konfigurasi varian (ukuran/rasa/panas-dingin/topping) ke keranjang. Semua
// pilihan di sini bersifat opsional untuk KASIR isi — ukuran, rasa & pilihan
// panas/dingin sudah di-default ke opsi pertama supaya kasir bisa langsung
// tekan "Tambah ke Keranjang" tanpa harus memilih apa-apa kalau memang tidak
// perlu; topping defaultnya tidak ada yang dicentang.
export default function VariantPickerModal({
  item,
  onClose,
  onConfirm,
}: {
  item: MenuItem;
  onClose: () => void;
  onConfirm: (variant: SelectedVariant) => void;
}) {
  const sizes = item.variants?.sizes ?? [];
  const flavors = item.variants?.flavors ?? [];
  const hotColdOptions = item.variants?.hotCold ?? [];
  const toppings = item.variants?.toppings ?? [];

  const [selectedSize, setSelectedSize] = useState<MenuVariantOption | undefined>(sizes[0]);
  const [selectedFlavor, setSelectedFlavor] = useState<MenuVariantOption | undefined>(flavors[0]);
  const [selectedHotCold, setSelectedHotCold] = useState<MenuVariantOption | undefined>(
    hotColdOptions[0]
  );
  const [selectedToppingIds, setSelectedToppingIds] = useState<string[]>([]);

  const selectedToppings: MenuToppingOption[] = toppings.filter((t) =>
    selectedToppingIds.includes(t.id)
  );

  const variant: SelectedVariant = {
    size: selectedSize ? { name: selectedSize.name, priceDelta: selectedSize.priceDelta } : undefined,
    flavor: selectedFlavor
      ? { name: selectedFlavor.name, priceDelta: selectedFlavor.priceDelta }
      : undefined,
    hotCold: selectedHotCold
      ? { name: selectedHotCold.name, priceDelta: selectedHotCold.priceDelta }
      : undefined,
    toppings: selectedToppings.map((t) => ({ name: t.name, price: t.price })),
  };

  const unitPrice = item.price + computeVariantExtra(variant);

  function toggleTopping(id: string) {
    setSelectedToppingIds((prev) =>
      prev.includes(id) ? prev.filter((tid) => tid !== id) : [...prev, id]
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-cream w-full sm:max-w-sm rounded-t-2xl sm:rounded-card p-5 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-lg text-espresso truncate">{item.name}</h2>
            <p className="text-xs text-espresso/50">Pilih varian (opsional)</p>
          </div>
          <button onClick={onClose} aria-label="Tutup">
            <X size={20} className="text-espresso/60" />
          </button>
        </div>

        {sizes.length > 0 && (
          <div>
            <p className="text-xs text-espresso/60 mb-1.5">Ukuran</p>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSize(s)}
                  className={`px-3.5 py-2 rounded-card border text-sm ${
                    selectedSize?.id === s.id
                      ? 'bg-espresso text-cream border-espresso'
                      : 'bg-surface text-espresso border-cream-dark'
                  }`}
                >
                  {s.name}
                  {s.priceDelta !== 0 && (
                    <span className="ml-1 opacity-70">
                      ({s.priceDelta > 0 ? '+' : ''}
                      {formatRupiah(s.priceDelta)})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {flavors.length > 0 && (
          <div>
            <p className="text-xs text-espresso/60 mb-1.5">Rasa</p>
            <div className="flex flex-wrap gap-2">
              {flavors.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFlavor(f)}
                  className={`px-3.5 py-2 rounded-card border text-sm ${
                    selectedFlavor?.id === f.id
                      ? 'bg-espresso text-cream border-espresso'
                      : 'bg-surface text-espresso border-cream-dark'
                  }`}
                >
                  {f.name}
                  {f.priceDelta !== 0 && (
                    <span className="ml-1 opacity-70">
                      ({f.priceDelta > 0 ? '+' : ''}
                      {formatRupiah(f.priceDelta)})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {hotColdOptions.length > 0 && (
          <div>
            <p className="text-xs text-espresso/60 mb-1.5">Panas/Dingin</p>
            <div className="flex flex-wrap gap-2">
              {hotColdOptions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedHotCold(s)}
                  className={`px-3.5 py-2 rounded-card border text-sm ${
                    selectedHotCold?.id === s.id
                      ? 'bg-espresso text-cream border-espresso'
                      : 'bg-surface text-espresso border-cream-dark'
                  }`}
                >
                  {s.name}
                  {s.priceDelta !== 0 && (
                    <span className="ml-1 opacity-70">
                      ({s.priceDelta > 0 ? '+' : ''}
                      {formatRupiah(s.priceDelta)})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {toppings.length > 0 && (
          <div>
            <p className="text-xs text-espresso/60 mb-1.5">Topping (boleh pilih lebih dari satu)</p>
            <div className="space-y-1.5">
              {toppings.map((t) => {
                const checked = selectedToppingIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTopping(t.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-card border text-sm ${
                      checked
                        ? 'bg-sage/10 border-sage text-espresso'
                        : 'bg-surface border-cream-dark text-espresso'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`w-4 h-4 rounded flex items-center justify-center border ${
                          checked ? 'bg-sage border-sage text-cream' : 'border-espresso/30'
                        }`}
                      >
                        {checked && <Check size={11} />}
                      </span>
                      {t.name}
                    </span>
                    <span className="text-espresso/60">+{formatRupiah(t.price)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between rounded-card bg-surface border border-cream-dark px-4 py-3">
          <span className="text-sm text-espresso/60">Harga satuan</span>
          <span className="font-semibold text-espresso">{formatRupiah(unitPrice)}</span>
        </div>

        <button
          onClick={() => onConfirm(variant)}
          className="w-full bg-espresso text-cream rounded-card py-3 font-medium active:scale-[0.99] transition-transform"
        >
          Tambah ke Keranjang
        </button>
      </div>
    </div>
  );
}
