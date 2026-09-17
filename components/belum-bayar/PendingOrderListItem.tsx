'use client';

import type { PendingOrder } from '@/lib/types';
import { formatRupiah, formatDateTime, formatItemLabel } from '@/lib/utils/format';
import { Clock3, Trash2, HandCoins, Plus, Pencil, ListTodo } from 'lucide-react';

export default function PendingOrderListItem({
  order,
  onMarkPaid,
  onMoveToKasbon,
  onDelete,
  onAddMore,
  onEditName,
  onEditItems,
}: {
  order: PendingOrder;
  onMarkPaid: () => void;
  onMoveToKasbon: () => void;
  onDelete: () => void;
  onAddMore: () => void;
  onEditName: () => void;
  onEditItems: () => void;
}) {
  // Tombol "Ubah Item" (buat hapus/kurangi baris yang salah pesan) baru
  // ditawarkan begitu ada lebih dari 1 item — kalau cuma 1 item, koreksi
  // paling gampang ya langsung Batalkan Pesanan saja lewat tombol Trash2.
  const canEditItems = order.items.length > 1;
  return (
    <div className="bg-surface rounded-card p-4 border border-cream-dark">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <button
            onClick={onEditName}
            className="flex items-center gap-1 min-w-0 group"
            aria-label="Ubah nama pelanggan"
          >
            <p className="font-medium text-espresso truncate">{order.customerName || 'Tanpa nama'}</p>
            <Pencil size={11} className="text-espresso/30 shrink-0 group-hover:text-espresso/60" />
          </button>
          <p className="text-xs text-espresso/50 flex items-center gap-1">
            <Clock3 size={11} className="shrink-0" />
            <span className="truncate">
              {formatDateTime(order.createdAt)}
              {order.operatorName && ` · ${order.operatorName}`}
            </span>
          </p>
        </div>
        <span className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-brick/10 text-brick shrink-0">
          Belum Bayar
        </span>
      </div>

      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          {order.items.map((i, idx) => (
            <p key={idx} className="text-xs text-espresso/60">
              {formatItemLabel(i.name, i.variantLabel)} x{i.quantity}
              {i.note && <span className="italic"> — &ldquo;{i.note}&rdquo;</span>}
            </p>
          ))}
        </div>
        {canEditItems && (
          <button
            onClick={onEditItems}
            className="flex items-center gap-1 text-[11px] text-espresso/50 shrink-0 underline decoration-dotted underline-offset-2"
            aria-label="Ubah item, hapus atau kurangi kalau ada yang salah"
          >
            <ListTodo size={11} /> Ubah item
          </button>
        )}
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-espresso">{formatRupiah(order.total)}</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onDelete}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-brick/10 text-brick shrink-0"
              aria-label="Batalkan pesanan"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={onAddMore}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-cream-dark text-espresso shrink-0"
              aria-label="Tambah pesanan"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onMoveToKasbon}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm bg-cream-dark text-espresso py-2 rounded-card"
          >
            <HandCoins size={14} /> Kasbon
          </button>
          <button
            onClick={onMarkPaid}
            className="flex-1 text-sm font-medium bg-espresso text-cream py-2 rounded-card"
          >
            Sudah Bayar
          </button>
        </div>
      </div>
    </div>
  );
}
