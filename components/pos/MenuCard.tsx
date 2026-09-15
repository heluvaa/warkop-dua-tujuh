'use client';

import type { MenuItem } from '@/lib/types';
import { formatRupiah } from '@/lib/utils/format';
import { LOW_STOCK_THRESHOLD } from '@/lib/constants';
import { Plus, Star } from 'lucide-react';

export default function MenuCard({
  item,
  onAdd,
  onToggleFavorite,
}: {
  item: MenuItem;
  onAdd: (item: MenuItem) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const outOfStock = item.stock <= 0;
  const lowStock = !outOfStock && item.stock <= LOW_STOCK_THRESHOLD;

  return (
    <div
      role="button"
      tabIndex={outOfStock ? -1 : 0}
      onClick={() => !outOfStock && onAdd(item)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !outOfStock) {
          e.preventDefault();
          onAdd(item);
        }
      }}
      aria-disabled={outOfStock}
      className={`text-left bg-surface rounded-card p-4 shadow-sm border transition-all ${
        outOfStock
          ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-espresso-light/30'
          : 'cursor-pointer border-cream-dark hover:border-crema hover:shadow-md active:scale-[0.98]'
      }`}
    >
      {item.imageUrl && (
        <div className="w-full aspect-square rounded-card overflow-hidden mb-2 bg-cream-dark/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display font-semibold text-espresso leading-snug">{item.name}</h3>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(item.id);
            }}
            className={`p-0.5 -m-0.5 ${item.isFavorite ? 'text-caramel' : 'text-espresso/25 hover:text-espresso/50'}`}
            aria-label={item.isFavorite ? 'Hapus dari favorit' : 'Jadikan favorit'}
          >
            <Star size={14} fill={item.isFavorite ? 'currentColor' : 'none'} />
          </button>
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              outOfStock ? 'bg-gray-300 dark:bg-espresso-light/40' : lowStock ? 'bg-brick' : 'bg-sage'
            }`}
          />
        </div>
      </div>
      <p className="text-xs text-espresso/60 mt-1">{item.category}</p>
      <div className="flex items-center justify-between mt-3">
        <span className="font-semibold text-espresso">{formatRupiah(item.price)}</span>
        <span
          className={`flex items-center justify-center w-7 h-7 rounded-full ${
            outOfStock ? 'bg-gray-200 text-gray-400 dark:bg-espresso-light/20 dark:text-espresso/30' : 'bg-espresso text-cream'
          }`}
        >
          <Plus size={14} />
        </span>
      </div>
      {lowStock && <p className="text-[11px] text-brick mt-1.5">Sisa {item.stock}</p>}
      {outOfStock && <p className="text-[11px] text-gray-400 dark:text-espresso/40 mt-1.5">Stok habis</p>}
    </div>
  );
}
