'use client';

import { formatRupiah, formatRupiahShort } from '@/lib/utils/format';

export interface TrendBucket {
  label: string;
  total: number;
}

export default function SalesTrendChart({ buckets }: { buckets: TrendBucket[] }) {
  const maxTotal = Math.max(...buckets.map((b) => b.total), 1);
  const grandTotal = buckets.reduce((sum, b) => sum + b.total, 0);

  return (
    <div>
      <p className="text-sm text-espresso/60 mb-4">
        Total periode ini: <span className="font-semibold text-espresso">{formatRupiah(grandTotal)}</span>
      </p>
      <div className="flex items-end gap-2 h-40">
        {buckets.map((b, idx) => {
          const heightPct = maxTotal > 0 ? Math.max((b.total / maxTotal) * 100, b.total > 0 ? 4 : 0) : 0;
          return (
            <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full gap-1 min-w-0">
              <span className="text-[10px] text-espresso/60 whitespace-nowrap">
                {b.total > 0 ? formatRupiahShort(b.total) : ''}
              </span>
              <div className="w-full h-full flex items-end">
                <div
                  className={`w-full rounded-t-md transition-all ${b.total > 0 ? 'bg-caramel' : 'bg-cream-dark'}`}
                  style={{ height: `${heightPct}%`, minHeight: b.total > 0 ? 3 : 0 }}
                  title={`${b.label}: ${formatRupiah(b.total)}`}
                />
              </div>
              <span className="text-[10px] text-espresso/50 mt-1 text-center leading-tight break-words">
                {b.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
