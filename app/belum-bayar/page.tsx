'use client';

import { useEffect, useState } from 'react';
import type { PendingOrder, CheckoutMethod, SplitPaymentDetail } from '@/lib/types';
import {
  getAllPendingOrders,
  markPendingOrderPaid,
  movePendingOrderToKasbon,
  deletePendingOrder,
  settlePendingOrderSplit,
  updatePendingOrderCustomerName,
} from '@/lib/storage/pendingOrderService';
import { incrementStock } from '@/lib/storage/menuService';
import { formatRupiah } from '@/lib/utils/format';
import PendingOrderListItem from '@/components/belum-bayar/PendingOrderListItem';
import PaymentModal from '@/components/pos/PaymentModal';
import ReceiptModal, { type ReceiptLineItem } from '@/components/pos/ReceiptModal';
import KasbonNameModal from '@/components/belum-bayar/KasbonNameModal';
import AddItemsModal from '@/components/belum-bayar/AddItemsModal';
import EditNameModal from '@/components/belum-bayar/EditNameModal';

interface ReceiptData {
  items: ReceiptLineItem[];
  total: number;
  method: CheckoutMethod;
  cashReceived?: number;
  splitDetail?: SplitPaymentDetail;
  change?: number;
  customerName?: string;
  operatorName?: string;
  createdAt?: string;
}

export default function BelumBayarPage() {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [kasbonForId, setKasbonForId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [addingForId, setAddingForId] = useState<string | null>(null);
  const [editingNameForId, setEditingNameForId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  async function refresh() {
    const all = await getAllPendingOrders();
    setOrders(
      [...all].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    );
  }

  useEffect(() => {
    refresh();
  }, []);

  const total = orders.reduce((sum, o) => sum + o.total, 0);

  async function handleConfirmPaid(
    method: CheckoutMethod,
    payload?: { cashReceived?: number; splitDetail?: SplitPaymentDetail; kasbonCustomerName?: string }
  ) {
    if (!payingId) return;
    const order = orders.find((o) => o.id === payingId);
    if (method === 'split') {
      await settlePendingOrderSplit(payingId, payload!.splitDetail!, payload?.kasbonCustomerName);
    } else {
      await markPendingOrderPaid(payingId, method as 'cash' | 'qris', payload?.cashReceived);
    }
    setPayingId(null);

    // Tampilkan struk (sama seperti checkout di Kasir) begitu pesanan Belum
    // Bayar ini ditandai lunas — ReceiptModal otomatis kirim foto struknya
    // ke Telegram kalau notifikasi transaksi aktif. Diambil dari data
    // `order` yang masih ada di state SEBELUM refresh, karena setelah lunas
    // pesanan ini sudah hilang dari daftar Belum Bayar.
    if (order) {
      const cashReceived = payload?.cashReceived;
      setReceipt({
        items: order.items.map((i, idx) => ({
          id: `${i.menuItemId || 'item'}-${idx}`,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.price,
          variantLabel: i.variantLabel,
          note: i.note,
        })),
        total: order.total,
        method,
        cashReceived,
        splitDetail: payload?.splitDetail,
        change: cashReceived !== undefined ? cashReceived - order.total : undefined,
        customerName: order.customerName,
        operatorName: order.operatorName,
        createdAt: new Date().toISOString(),
      });
    }

    await refresh();
  }

  async function handleConfirmKasbon(name: string) {
    if (!kasbonForId) return;
    await movePendingOrderToKasbon(kasbonForId, name);
    setKasbonForId(null);
    await refresh();
  }

  async function handleConfirmEditName(name: string) {
    if (!editingNameForId) return;
    await updatePendingOrderCustomerName(editingNameForId, name);
    setEditingNameForId(null);
    await refresh();
  }

  async function handleDelete(id: string) {
    const entry = orders.find((o) => o.id === id);
    if (entry) {
      // Batalkan = pesanannya tidak jadi, jadi stok yang tadi terpotong
      // dikembalikan (beda dengan "Jadikan Kasbon" yang memang sudah
      // dibuat/diantar, cuma belum dibayar).
      for (const item of entry.items) {
        if (item.menuItemId) await incrementStock(item.menuItemId, item.quantity);
      }
    }
    await deletePendingOrder(id);
    setConfirmDeleteId(null);
    await refresh();
  }

  const payingOrder = orders.find((o) => o.id === payingId);
  const kasbonOrder = orders.find((o) => o.id === kasbonForId);
  const deletingOrder = orders.find((o) => o.id === confirmDeleteId);
  const addingOrder = orders.find((o) => o.id === addingForId);
  const editingNameOrder = orders.find((o) => o.id === editingNameForId);

  return (
    <div className="p-4 pb-24 md:pb-6">
      <h1 className="font-display font-semibold text-xl text-espresso mb-1">Belum Bayar</h1>
      <p className="text-sm text-espresso/60 mb-4">
        Total belum dibayar: <span className="font-semibold text-brick">{formatRupiah(total)}</span>
      </p>

      {orders.length === 0 ? (
        <p className="text-sm text-espresso/50 text-center py-10">
          Tidak ada pesanan yang belum dibayar. Pesanan "Belum Bayar" dari Kasir akan muncul di sini.
        </p>
      ) : (
        <div className="space-y-2.5">
          {orders.map((order) => (
            <PendingOrderListItem
              key={order.id}
              order={order}
              onMarkPaid={() => setPayingId(order.id)}
              onMoveToKasbon={() => setKasbonForId(order.id)}
              onDelete={() => setConfirmDeleteId(order.id)}
              onAddMore={() => setAddingForId(order.id)}
              onEditName={() => setEditingNameForId(order.id)}
            />
          ))}
        </div>
      )}

      {payingOrder && (
        <PaymentModal
          total={payingOrder.total}
          allowUnpaid={false}
          defaultCustomerName={payingOrder.customerName ?? ''}
          onClose={() => setPayingId(null)}
          onConfirm={handleConfirmPaid}
        />
      )}

      {receipt && <ReceiptModal {...receipt} onClose={() => setReceipt(null)} />}

      {addingOrder && (
        <AddItemsModal
          order={addingOrder}
          onClose={() => setAddingForId(null)}
          onDone={async () => {
            setAddingForId(null);
            await refresh();
          }}
        />
      )}

      {editingNameOrder && (
        <EditNameModal
          defaultName={editingNameOrder.customerName ?? ''}
          onClose={() => setEditingNameForId(null)}
          onConfirm={handleConfirmEditName}
        />
      )}

      {kasbonOrder && (
        <KasbonNameModal
          defaultName={kasbonOrder.customerName ?? ''}
          onClose={() => setKasbonForId(null)}
          onConfirm={handleConfirmKasbon}
        />
      )}

      {deletingOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-cream rounded-card p-5 max-w-xs w-full space-y-4 text-center">
            <p className="text-espresso">
              Batalkan pesanan {deletingOrder.customerName || 'ini'}? Stok yang terpakai akan
              dikembalikan.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 border border-cream-dark rounded-card py-2.5 text-espresso"
              >
                Tidak
              </button>
              <button
                onClick={() => handleDelete(deletingOrder.id)}
                className="flex-1 bg-brick text-cream rounded-card py-2.5"
              >
                Batalkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
