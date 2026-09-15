'use client';

import { useEffect, useState } from 'react';
import { UserRound, ChevronUp, X } from 'lucide-react';
import type { CartItem, MenuItem, PaymentMethod } from '@/lib/types';
import { formatRupiah } from '@/lib/utils/format';
import { getAllMenu, decrementStock, seedMenuIfEmpty, toggleFavorite } from '@/lib/storage/menuService';
import { createTransaction } from '@/lib/storage/transactionService';
import { getActiveOperator } from '@/lib/storage/operatorService';
import MenuGrid from '@/components/pos/MenuGrid';
import Cart from '@/components/pos/Cart';
import PaymentModal from '@/components/pos/PaymentModal';
import ReceiptModal from '@/components/pos/ReceiptModal';

interface ReceiptData {
  items: CartItem[];
  total: number;
  method: PaymentMethod;
  cashReceived?: number;
  change?: number;
}

export default function KasirPage() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [activeOperatorName, setActiveOperatorName] = useState<string | null>(null);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);

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

  const total = cart.reduce((sum, c) => sum + c.menuItem.price * c.quantity, 0);

  function handleAdd(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItem.id === item.id);
      if (existing) {
        if (existing.quantity >= item.stock) return prev; // tidak bisa lebihi stok
        return prev.map((c) =>
          c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { menuItem: item, quantity: 1 }];
    });
  }

  function handleIncrement(id: string) {
    setCart((prev) =>
      prev.map((c) => {
        if (c.menuItem.id !== id) return c;
        if (c.quantity >= c.menuItem.stock) return c;
        return { ...c, quantity: c.quantity + 1 };
      })
    );
  }

  function handleDecrement(id: string) {
    setCart((prev) =>
      prev
        .map((c) => (c.menuItem.id === id ? { ...c, quantity: c.quantity - 1 } : c))
        .filter((c) => c.quantity > 0)
    );
  }

  function handleRemove(id: string) {
    setCart((prev) => prev.filter((c) => c.menuItem.id !== id));
  }

  async function handleToggleFavorite(id: string) {
    await toggleFavorite(id);
    setMenu(await getAllMenu());
  }

  function handleNoteChange(id: string, note: string) {
    setCart((prev) => prev.map((c) => (c.menuItem.id === id ? { ...c, note } : c)));
  }

  async function handleConfirmPayment(method: PaymentMethod, cashReceived?: number) {
    await createTransaction({
      items: cart.map((c) => ({
        menuItemId: c.menuItem.id,
        name: c.menuItem.name,
        price: c.menuItem.price,
        // Snapshot HPP saat ini supaya laporan margin transaksi ini tidak
        // ikut berubah kalau HPP menu diedit belakangan.
        hpp: c.menuItem.hpp ?? 0,
        quantity: c.quantity,
        note: c.note?.trim() || undefined,
      })),
      total,
      paymentMethod: method,
      cashReceived,
      change: cashReceived !== undefined ? cashReceived - total : undefined,
      source: 'pos',
      operatorName: activeOperatorName ?? undefined,
    });

    for (const c of cart) {
      await decrementStock(c.menuItem.id, c.quantity);
    }

    setReceipt({
      items: cart,
      total,
      method,
      cashReceived,
      change: cashReceived !== undefined ? cashReceived - total : undefined,
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
        <div className="flex items-center justify-between mb-4 gap-2">
          <h1 className="font-display font-semibold text-xl text-espresso">Kasir</h1>
          {activeOperatorName && (
            <span
              className="flex items-center gap-1.5 bg-surface border border-cream-dark rounded-full pl-1 pr-3 py-1 text-xs text-espresso/70"
              title="Kasir jaga"
            >
              <span className="w-6 h-6 rounded-full bg-espresso text-cream flex items-center justify-center">
                <UserRound size={12} />
              </span>
              <span className="font-medium text-espresso">{activeOperatorName}</span>
            </span>
          )}
        </div>

        <MenuGrid menu={menu} onAdd={handleAdd} onToggleFavorite={handleToggleFavorite} />
      </div>

      {/* Desktop: keranjang selalu tampil sebagai panel samping, ruang
          layarnya memang cukup lega untuk itu. */}
      <div className="hidden lg:flex lg:w-80 lg:shrink-0 border-l border-cream-dark bg-cream lg:h-full">
        <Cart
          cart={cart}
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
          onClose={() => setShowPayment(false)}
          onConfirm={handleConfirmPayment}
        />
      )}

      {receipt && <ReceiptModal {...receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
