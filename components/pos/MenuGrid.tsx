'use client';

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { MenuItem } from '@/lib/types';
import MenuCard from './MenuCard';

export default function MenuGrid({
  menu,
  onAdd,
  onToggleFavorite,
}: {
  menu: MenuItem[];
  onAdd: (item: MenuItem) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const [category, setCategory] = useState<string>('Semua');
  const [query, setQuery] = useState('');

  const categories = useMemo(
    () => ['Semua', ...Array.from(new Set(menu.map((m) => m.category)))],
    [menu]
  );

  const byCategory = category === 'Semua' ? menu : menu.filter((m) => m.category === category);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? byCategory.filter(
        (m) => m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)
      )
    : byCategory;

  // Pin menu favorit ke bagian paling atas grid (urutan lain tetap terjaga).
  const sorted = [...filtered].sort(
    (a, b) => Number(!!b.isFavorite) - Number(!!a.isFavorite)
  );

  return (
    <div>
      <div className="relative mb-3">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-espresso/40 pointer-events-none"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari menu..."
          className="w-full bg-surface border border-cream-dark rounded-card pl-9 pr-9 py-2.5 text-sm text-espresso placeholder:text-espresso/40 focus:outline-none focus:border-crema"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-espresso/40 hover:text-espresso"
            aria-label="Hapus pencarian"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-1 -mx-1 px-1">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm border transition-colors ${
              category === c
                ? 'bg-espresso text-cream border-espresso'
                : 'bg-surface text-espresso/70 border-cream-dark'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-espresso/50 py-10 text-center">
          {q ? `Tidak ada menu yang cocok dengan "${query}".` : 'Belum ada menu di kategori ini.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {sorted.map((item) => (
            <MenuCard key={item.id} item={item} onAdd={onAdd} onToggleFavorite={onToggleFavorite} />
          ))}
        </div>
      )}
    </div>
  );
}
