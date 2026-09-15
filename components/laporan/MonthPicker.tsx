'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { lastMonthKeys } from '@/lib/utils/date';

function labelFor(monthKey: string): string {
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(
    new Date(`${monthKey}-01T00:00:00`)
  );
}

// Pengganti <input type="month"> bawaan browser — dibuat sendiri supaya
// label bulan+tahun selalu tampil penuh (tidak terpotong) dan gaya visualnya
// konsisten di semua perangkat, alih-alih mengikuti tampilan native OS.
export default function MonthPicker({
  value,
  onChange,
  monthsBack = 12,
}: {
  value: string;
  onChange: (monthKey: string) => void;
  monthsBack?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const options = lastMonthKeys(monthsBack);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-surface border border-crema rounded-full pl-4 pr-3 py-1.5 text-sm text-espresso whitespace-nowrap"
      >
        <span className="capitalize">{labelFor(value)}</span>
        <ChevronDown size={15} className={`text-espresso/50 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-48 max-h-64 overflow-y-auto bg-cream border border-cream-dark rounded-card shadow-lg z-20 py-1">
          {options.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              className={`w-full text-left px-3.5 py-2 text-sm capitalize ${
                key === value ? 'bg-espresso text-cream font-medium' : 'text-espresso hover:bg-cream-dark'
              }`}
            >
              {labelFor(key)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
