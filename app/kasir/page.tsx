'use client';

import { useEffect, useState } from 'react';
import { ChevronUp, X } from 'lucide-react';
import type { CartItem, MenuItem, CheckoutMethod, SplitPaymentDetail, SelectedVariant } from '@/lib/types';
import { formatRupiah } from '@/lib/utils/format';
import { getAllMenu, decrementStock, seedMenuIfEmpty, toggleFavorite } from '@/lib/storage/menuService';
import { createTransaction, updateTransaction } from '@/lib/storage/transactionService';
import { createPendingOrder } from '@/lib/storage/pendingOrderService';
import { createKasbon } from '@/lib/storage/kasbonService';
import { getActiveOperator } from '@/lib/storage/operatorService';
import {
  buildCartLineId,
  computeVariantExtra,
  formatSelectedVariantLabel,
  hasAnyVariantConfig,
} from '@/lib/utils/variant';
import MenuGrid from '@/components/pos/MenuGrid';
import Cart from '@/components/pos/Cart';
import PaymentModal from '@/components/pos/PaymentModal';
import ReceiptModal from '@/components/pos/ReceiptModal';
import VariantPickerModal from '@/components/pos/VariantPickerModal';

interface ReceiptData {
  items: CartItem[];
  total: number;
  method: CheckoutMethod;
  cashReceived?: number;
  splitDetail?: SplitPaymentDetail;
  change?: number;
  customerName?: string;
  operatorName?: string;
  createdAt?: string;
}

export default function KasirPage() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [activeOperatorName, setActiveOperatorName] = useState<string | null>(null);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  // Menu yang sedang dipilih variannya (ukuran/level gula-es/topping) lewat
  // VariantPickerModal — hanya terisi untuk menu yang punya konfigurasi
  // varian (lihat handleAdd). Menu tanpa varian langsung masuk keranjang
  // tanpa lewat state ini sama sekali.
  const [variantPickerItem, setVariantPickerItem] = useState<MenuItem | null>(null);

  useEffect(() => {
    (async () => {
      await seedMenuIfEmpty();
      setMenu(await getAllMenu());
      // Sesi kasir sudah dijamin ada oleh AuthGate di layout — di sini
      // cuma perlu tahu namanya untuk dicatat di setiap transaksi.
      const session = await getActiveOperator();
      setActiveOperatorName(session?.operatorName ?? null);
    })();
  }, []);

  const total = cart.reduce((sum, c) => sum + c.unitPrice * c.quantity, 0);

  // Reset nama pelanggan begitu keranjang kosong (baik karena checkout
  // selesai maupun semua item dihapus manual) supaya tidak kebawa ke
  // pesanan pelanggan berikutnya.
  useEffect(() => {
    if (cart.length === 0) setCustomerName('');
  }, [cart.length]);

  // Total quantity menu yang sama di keranjang, DIJUMLAHKAN LINTAS baris
  // varian — mis. 1 Kopi Susu Regular + 2 Kopi Susu Large tetap dibatasi
  // oleh stok "Kopi Susu" yang sama (stok tersimpan per menu, bukan per
  // varian).
  function totalQtyForMenuItem(cartState: CartItem[], menuItemId: string): number {
    return cartState
      .filter((c) => c.menuItem.id === menuItemId)
      .reduce((sum, c) => sum + c.quantity, 0);
  }

  // Menambahkan menu ke keranjang dengan varian yang sudah dipilih (atau
  // tanpa varian sama sekali kalau menunya memang tidak punya konfigurasi
  // varian). Baris dengan menu + pilihan varian yang PERSIS SAMA digabung
  // (quantity bertambah); kombinasi berbeda jadi baris baru.
  function addToCart(item: MenuItem, variant?: SelectedVariant) {
    const lineId = buildCartLineId(item.id, variant);
    setCart((prev) => {
      if (totalQtyForMenuItem(prev, item.id) >= item.stock) return prev; // tidak bisa lebihi stok
      const existing = prev.find((c) => c.id === lineId);
      if (existing) {
        return prev.map((c) => (c.id === lineId ? { ...c, quantity: c.quantity + 1 } : c));
      }
      const unitPrice = item.price + computeVariantExtra(variant);
      return [...prev, { id: lineId, menuItem: item, quantity: 1, variant, unitPrice }];
    });
  }

  // Dipanggil saat kasir tap kartu menu di grid — kalau menunya punya
  // konfigurasi varian, buka dialog pilihan dulu; kalau tidak, langsung
  // masuk keranjang seperti biasa (perilaku sama seperti sebelum fitur
  // varian ada).
  function handleAdd(item: MenuItem) {
    if (hasAnyVariantConfig(item.variants)) {
      setVariantPickerItem(item);
    } else {
      addToCart(item);
    }
  }

  function handleConfirmVariant(variant: SelectedVariant) {
    if (variantPickerItem) addToCart(variantPickerItem, variant);
    setVariantPickerItem(null);
  }

  function handleIncrement(lineId: string) {
    setCart((prev) => {
      const line = prev.find((c) => c.id === lineId);
      if (!line) return prev;
      if (totalQtyForMenuItem(prev, line.menuItem.id) >= line.menuItem.stock) return prev;
      return prev.map((c) => (c.id === lineId ? { ...c, quantity: c.quantity + 1 } : c));
    });
  }

  function handleDecrement(lineId: string) {
    setCart((prev) =>
      prev
        .map((c) => (c.id === lineId ? { ...c, quantity: c.quantity - 1 } : c))
        .filter((c) => c.quantity > 0)
    );
  }

  function handleRemove(lineId: string) {
    setCart((prev) => prev.filter((c) => c.id !== lineId));
  }

  async function handleToggleFavorite(id: string) {
    await toggleFavorite(id);
    setMenu(await getAllMenu());
  }

  function handleNoteChange(lineId: string, note: string) {
    setCart((prev) => prev.map((c) => (c.id === lineId ? { ...c, note } : c)));
  }

  async function handleConfirmPayment(
    method: CheckoutMethod,
    payload?: { cashReceived?: number; splitDetail?: SplitPaymentDetail; kasbonCustomerName?: string }
  ) {
    const trimmedCustomerName = customerName.trim() || undefined;
    const cashReceived = payload?.cashReceived;
    const lineItems = cart.map((c) => ({
      menuItemId: c.menuItem.id,
      name: c.menuItem.name,
      // unitPrice sudah termasuk tambahan ukuran/level gula-es/topping.
      price: c.unitPrice,
      // Snapshot HPP saat ini supaya laporan margin transaksi ini tidak
      // ikut berubah kalau HPP menu diedit belakangan.
      hpp: c.menuItem.hpp ?? 0,
      quantity: c.quantity,
      note: c.note?.trim() || undefined,
      variantLabel: formatSelectedVariantLabel(c.variant),
    }));

    if (method === 'belum_bayar') {
      // Belum dibayar sama sekali saat ini — disimpan dulu ke daftar
      // "Belum Bayar", nanti ditandai lunas atau dipindah ke Kasbon dari
      // sana. Stok tetap dipotong sekarang karena pesanannya sudah dibuat.
      await createPendingOrder({
        items: lineItems,
        total,
        customerName: trimmedCustomerName,
        operatorName: activeOperatorName ?? undefined,
      });
    } else if (method === 'split') {
      // Split pembayaran: bagian cash/QRIS (kalau ada) langsung dicatat
      // sebagai pemasukan sekarang; bagian kasbon (kalau ada) langsung
      // dicatat sebagai utang baru atas nama pelanggan — mis. "separo dulu
      // ya, sisanya besok" tidak perlu lewat halaman Belum Bayar dulu.
      const split = payload!.splitDetail!;
      const collected = split.cash + split.qris;
      let trxId: string | undefined;
      if (collected > 0) {
        const trx = await createTransaction({
          items: lineItems,
          total: collected,
          paymentMethod: 'split',
          splitDetail: split,
          source: 'pos',
          operatorName: activeOperatorName ?? undefined,
          customerName: trimmedCustomerName,
        });
        trxId = trx.id;
      }
      if (split.kasbon > 0) {
        const kasbonName = (payload?.kasbonCustomerName || trimmedCustomerName || '').trim();
        const kasbon = await createKasbon({
          customerName: kasbonName,
          items: lineItems.map((i) => ({
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            variantLabel: i.variantLabel,
          })),
          total: split.kasbon,
          originTransactionId: trxId,
        });
        if (trxId) await updateTransaction(trxId, { linkedKasbonId: kasbon.id });
      }
    } else {
      await createTransaction({
        items: lineItems,
        total,
        paymentMethod: method,
        cashReceived,
        change: cashReceived !== undefined ? cashReceived - total : undefined,
        source: 'pos',
        operatorName: activeOperatorName ?? undefined,
        customerName: trimmedCustomerName,
      });
    }

    for (const c of cart) {
      await decrementStock(c.menuItem.id, c.quantity);
    }

    setReceipt({
      items: cart,
      total,
      method,
      cashReceived,
      splitDetail: payload?.splitDetail,
      change: cashReceived !== undefined ? cashReceived - total : undefined,
      customerName: trimmedCustomerName,
      operatorName: activeOperatorName ?? undefined,
      createdAt: new Date().toISOString(),
    });
    setShowPayment(false);
    setCartSheetOpen(false);
    setMenu(await getAllMenu());
    setCart([]);
  }

  return (
    <div className="flex flex-col lg:flex-row lg:h-screen">
      <div
        className={`flex-1 overflow-y-auto p-4 lg:pb-4 ${
          cart.length > 0 ? 'pb-40' : 'pb-24'
        }`}
      >
        <h1 className="font-display font-semibold text-xl text-espresso mb-4">Kasir</h1>

        <MenuGrid menu={menu} onAdd={handleAdd} onToggleFavorite={handleToggleFavorite} />
      </div>

      {/* Desktop: keranjang selalu tampil sebagai panel samping, ruang
          layarnya memang cukup lega untuk itu. */}
      <div className="hidden lg:flex lg:w-80 lg:shrink-0 border-l border-cream-dark bg-cream lg:h-full">
        <Cart
          cart={cart}
          customerName={customerName}
          onCustomerNameChange={setCustomerName}
          onIncrement={handleIncrement}
          onDecrement={handleDecrement}
          onRemove={handleRemove}
          onNoteChange={handleNoteChange}
          onCheckout={() => cart.length > 0 && setShowPayment(true)}
        />
      </div>

      {/* HP: kalau keranjang kosong, tidak usah tampilkan apa-apa supaya
          layar menu tidak kehilangan ruang. Begitu ada isi, tampilkan bar
          ringkas di atas nav bawah; disentuh untuk membuka detail
          keranjang sebagai bottom sheet. */}
      {cart.length > 0 && !cartSheetOpen && (
        <button
          onClick={() => setCartSheetOpen(true)}
          className="lg:hidden fixed bottom-16 left-0 right-0 z-30 bg-espresso text-cream flex items-center justify-between px-4 py-3 shadow-[0_-2px_10px_rgba(0,0,0,0.12)]"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <span className="bg-cream text-espresso rounded-full min-w-[22px] h-[22px] px-1 flex items-center justify-center text-xs font-semibold">
              {cart.reduce((sum, c) => sum + c.quantity, 0)}
            </span>
            Lihat Pesanan
            <ChevronUp size={15} />
          </span>
          <span className="font-semibold">{formatRupiah(total)}</span>
        </button>
      )}

      {cartSheetOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setCartSheetOpen(false)}
          />
          <div className="relative bg-cream rounded-t-2xl mb-16 max-h-[75vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-center pt-2.5 shrink-0">
              <span className="w-10 h-1.5 bg-cream-dark rounded-full" />
            </div>
            <button
              onClick={() => setCartSheetOpen(false)}
              className="absolute right-3 top-3 text-espresso/50 hover:text-espresso"
              aria-label="Tutup keranjang"
            >
              <X size={20} />
            </button>
            <div className="flex-1 min-h-0">
              <Cart
                cart={cart}
                customerName={customerName}
                onCustomerNameChange={setCustomerName}
                onIncrement={handleIncrement}
                onDecrement={handleDecrement}
                onRemove={handleRemove}
                onNoteChange={handleNoteChange}
                onCheckout={() => cart.length > 0 && setShowPayment(true)}
              />
            </div>
          </div>
        </div>
      )}

      {showPayment && (
        <PaymentModal
          total={total}
          defaultCustomerName={customerName}
          onClose={() => setShowPayment(false)}
          onConfirm={handleConfirmPayment}
        />
      )}

      {receipt && <ReceiptModal {...receipt} onClose={() => setReceipt(null)} />}

      {variantPickerItem && (
        <VariantPickerModal
          item={variantPickerItem}
          onClose={() => setVariantPickerItem(null)}
          onConfirm={handleConfirmVariant}
        />
      )}
    </div>
  );
}
