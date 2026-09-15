'use client';

import { useEffect, useState } from 'react';
import { X, ShoppingBag, BookUser } from 'lucide-react';
import type { CustomerDetail } from '@/lib/storage/customerService';
import { getCustomerDetail } from '@/lib/storage/customerService';
import { formatRupiah, formatDateTime, paymentMethodLabel, formatItemLabel } from '@/lib/utils/format';

export default function CustomerDetailModal({
  customerKey,
  onClose,
}: {
  customerKey: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'belanja' | 'kasbon'>('belanja');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setDetail(await getCustomerDetail(customerKey));
      setLoading(false);
    })();
  }, [customerKey]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-cream w-full sm:max-w-md rounded-t-2xl sm:rounded-card p-5 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg text-espresso truncate pr-2">
            {detail?.name ?? '...'}
          </h2>
          <button onClick={onClose} aria-label="Tutup">
            <X size={20} className="text-espresso/60" />
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-espresso/50 text-center py-8">Memuat...</p>
        ) : !detail ? (
          <p className="text-sm text-espresso/50 text-center py-8">Data pelanggan tidak ditemukan.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-surface rounded-card p-3.5">
                <p className="text-xs text-espresso/50">Total Belanja</p>
                <p className="font-display font-semibold text-espresso">
                  {formatRupiah(detail.totalBelanja)}
                </p>
                <p className="text-[11px] text-espresso/50 mt-0.5">{detail.transactionCount} transaksi</p>
              </div>
              <div className="bg-surface rounded-card p-3.5">
                <p className="text-xs text-espresso/50">Kasbon Belum Lunas</p>
                <p
                  className={`font-display font-semibold ${
                    detail.totalKasbonBelumLunas > 0 ? 'text-brick' : 'text-espresso'
                  }`}
                >
                  {formatRupiah(detail.totalKasbonBelumLunas)}
                </p>
                <p className="text-[11px] text-espresso/50 mt-0.5">
                  {detail.kasbonBelumLunasCount} catatan
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setTab('belanja')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-card text-sm border ${
                  tab === 'belanja'
                    ? 'bg-espresso text-cream border-espresso'
                    : 'bg-surface text-espresso/70 border-cream-dark'
                }`}
              >
                <ShoppingBag size={14} /> Belanja ({detail.transactions.length})
              </button>
              <button
                onClick={() => setTab('kasbon')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-card text-sm border ${
                  tab === 'kasbon'
                    ? 'bg-espresso text-cream border-espresso'
                    : 'bg-surface text-espresso/70 border-cream-dark'
                }`}
              >
                <BookUser size={14} /> Kasbon ({detail.kasbon.length})
              </button>
            </div>

            {tab === 'belanja' &&
              (detail.transactions.length === 0 ? (
                <p className="text-sm text-espresso/50 text-center py-8">
                  Belum ada riwayat belanja langsung di Kasir.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {detail.transactions.map((t) => (
                    <div key={t.id} className="bg-surface rounded-card p-3.5 border border-cream-dark">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-espresso/50">{formatDateTime(t.createdAt)}</p>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-cream-dark text-espresso/70 shrink-0">
                          {paymentMethodLabel(t.paymentMethod)}
                        </span>
                      </div>
                      <div className="mt-1.5 space-y-0.5">
                        {t.items.map((i, idx) => (
                          <p key={idx} className="text-xs text-espresso/60">
                            {formatItemLabel(i.name, i.variantLabel)} x{i.quantity}
                          </p>
                        ))}
                      </div>
                      <p className="font-semibold text-espresso mt-2">{formatRupiah(t.total)}</p>
                    </div>
                  ))}
                </div>
              ))}

            {tab === 'kasbon' &&
              (detail.kasbon.length === 0 ? (
                <p className="text-sm text-espresso/50 text-center py-8">
                  Belum ada catatan kasbon untuk pelanggan ini.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {detail.kasbon.map((k) => (
                    <div key={k.id} className="bg-surface rounded-card p-3.5 border border-cream-dark">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-espresso/50">{formatDateTime(k.createdAt)}</p>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                            k.status === 'lunas' ? 'bg-sage/15 text-sage' : 'bg-brick/10 text-brick'
                          }`}
                        >
                          {k.status === 'lunas' ? 'Lunas' : 'Belum Lunas'}
                        </span>
                      </div>
                      <div className="mt-1.5 space-y-0.5">
                        {k.items.map((i, idx) => (
                          <p key={idx} className="text-xs text-espresso/60">
                            {formatItemLabel(i.name, i.variantLabel)} x{i.quantity}
                          </p>
                        ))}
                      </div>
                      <p className="font-semibold text-espresso mt-2">{formatRupiah(k.total)}</p>
                    </div>
                  ))}
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
}
