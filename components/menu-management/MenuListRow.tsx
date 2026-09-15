'use client';

import type { MenuItem } from '@/lib/types';
import { formatRupiah } from '@/lib/utils/format';
import { LOW_STOCK_THRESHOLD } from '@/lib/constants';
import { Pencil, Trash2 } from 'lucide-react';

export default function MenuListRow({
  item,
  onEdit,
  onDelete,
}: {
  item: MenuItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const lowStock = item.stock <= LOW_STOCK_THRESHOLD;
  const hasHpp = !!item.hpp && item.hpp > 0;
  const margin = item.price - (item.hpp ?? 0);
  const marginPercent = item.price > 0 ? (margin / item.price) * 100 : 0;

  return (
    <div className="flex items-center gap-3 bg-surface rounded-card p-3 border border-cream-dark">
      <div className="w-11 h-11 rounded-card bg-cream-dark/60 overflow-hidden shrink-0 flex items-center justify-center">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-[9px] text-espresso/30">Foto</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-espresso truncate">{item.name}</p>
        <p className="text-xs text-espresso/50">
          {item.category} · {formatRupiah(item.price)}
        </p>
        {hasHpp ? (
          <p className={`text-[11px] mt-0.5 ${margin < 0 ? 'text-brick' : 'text-sage'}`}>
            Untung {formatRupiah(margin)} ({marginPercent.toFixed(0)}%)
          </p>
        ) : (
          <p className="text-[11px] mt-0.5 text-espresso/30">HPP belum diisi</p>
        )}
      </div>
      <div className="text-right">
        <p className={`text-sm font-semibold ${lowStock ? 'text-brick' : 'text-espresso'}`}>{item.stock}</p>
        <p className="text-[10px] text-espresso/40">stok</p>
      </div>
      <div className="flex items-center gap-1.5 pl-1">
        <button
          onClick={onEdit}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-cream-dark text-espresso"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onDelete}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-brick/10 text-brick"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
