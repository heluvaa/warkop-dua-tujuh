'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, X, ShoppingBasket, History, Tags, Lock } from 'lucide-react';
import type { MenuItem, StockPurchaseEntry, StockPurchaseLineItem } from '@/lib/types';
import { useIsPemilik } from '@/lib/context/OperatorSessionContext';
import {
  getAllMenu,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  seedMenuIfEmpty,
} from '@/lib/storage/menuService';
import { createStockPurchase, getRecentStockPurchases } from '@/lib/storage/stockPurchaseService';
import { getActiveOperator } from '@/lib/storage/operatorService';
import { formatRupiah, formatDateTime } from '@/lib/utils/format';
import MenuListRow from '@/components/menu-management/MenuListRow';
import MenuFormModal from '@/components/menu-management/MenuFormModal';
import StockPurchaseModal from '@/components/menu-management/StockPurchaseModal';
import CategoryManagerModal from '@/components/menu-management/CategoryManagerModal';

export default function MenuManagementPage() {
  // Kasir cuma boleh lihat daftar menu (baca-only) — tambah/ubah/hapus menu,
  // kelola kategori, dan belanja stok cuma untuk pemilik. Guard dipasang di
  // dua tempat: UI (tombol disembunyikan) dan handler (early return) supaya
  // tetap aman kalau ada jalan lain untuk memanggilnya.
  const isPemilik = useIsPemilik();
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showStockPurchase, setShowStockPurchase] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [recentPurchases, setRecentPurchases] = useState<StockPurchaseEntry[]>([]);

  const filteredMenu = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return menu;
    return menu.filter(
      (m) => m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)
    );
  }, [menu, query]);

  // Daftar kategori unik dari menu yang sudah ada, untuk opsi dropdown di
  // form tambah/ubah menu — biar tidak perlu mengetik ulang kategori yang
  // sudah pernah dipakai.
  const existingCategories = useMemo(() => {
    return Array.from(new Set(menu.map((m) => m.category))).sort((a, b) => a.localeCompare(b));
  }, [menu]);

  async function refresh() {
    setMenu(await getAllMenu());
  }

  async function refreshPurchases() {
    setRecentPurchases(await getRecentStockPurchases(5));
  }

  useEffect(() => {
    (async () => {
      await seedMenuIfEmpty();
      await refresh();
      await refreshPurchases();
    })();
  }, []);

  async function handleSave(data: { name: string; price: number; hpp: number; category: string; stock: number; imageUrl?: string; variants?: MenuItem['variants'] }) {
    if (!isPemilik) return;
    if (editing) {
      await updateMenuItem(editing.id, data);
    } else {
      await createMenuItem(data);
    }
    setShowForm(false);
    setEditing(null);
    await refresh();
  }

  async function handleDelete(id: string) {
    if (!isPemilik) return;
    await deleteMenuItem(id);
    setConfirmDeleteId(null);
    await refresh();
  }

  async function handleSaveStockPurchase(data: { items: StockPurchaseLineItem[]; updateHpp: boolean }) {
    if (!isPemilik) return;
    const session = await getActiveOperator();
    await createStockPurchase({ ...data, operatorName: session?.operatorName });
    setShowStockPurchase(false);
    await refresh();
    await refreshPurchases();
  }

  return (
    <div className="p-4 pb-24 md:pb-6">
      <div className="mb-4">
        <h1 className="font-display font-semibold text-xl text-espresso mb-2">Manajemen Menu & Stok</h1>
        {isPemilik ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowCategoryManager(true)}
              className="flex items-center gap-1.5 bg-surface border border-cream-dark text-espresso rounded-card px-3 py-2 text-sm font-medium"
            >
              <Tags size={16} /> Kategori
            </button>
            <button
              onClick={() => setShowStockPurchase(true)}
              className="flex items-center gap-1.5 bg-surface border border-cream-dark text-espresso rounded-card px-3 py-2 text-sm font-medium"
            >
              <ShoppingBasket size={16} /> Belanja Stok
            </button>
            <button
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
              className="flex items-center gap-1.5 bg-espresso text-cream rounded-card px-3.5 py-2 text-sm font-medium"
            >
              <Plus size={16} /> Tambah
            </button>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-espresso/50 text-sm">
            <Lock size={14} /> Cuma pemilik yang bisa ubah menu & stok. Kamu bisa lihat daftarnya saja.
          </p>
        )}
      </div>

      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-espresso/40 pointer-events-none"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama atau kategori menu..."
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

      {menu.length === 0 ? (
        <p className="text-sm text-espresso/50 text-center py-10">Belum ada menu. Tambahkan menu pertama.</p>
      ) : filteredMenu.length === 0 ? (
        <p className="text-sm text-espresso/50 text-center py-10">
          Tidak ada menu yang cocok dengan &quot;{query}&quot;.
        </p>
      ) : (
        <div className="space-y-2">
          {filteredMenu.map((item) => (
            <MenuListRow
              key={item.id}
              item={item}
              isPemilik={isPemilik}
              onEdit={() => {
                setEditing(item);
                setShowForm(true);
              }}
              onDelete={() => setConfirmDeleteId(item.id)}
            />
          ))}
        </div>
      )}

      {isPemilik && recentPurchases.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display font-semibold text-espresso mb-2 flex items-center gap-1.5 text-sm">
            <History size={15} /> Belanja Stok Terbaru
          </h2>
          <div className="space-y-2">
            {recentPurchases.map((p) => (
              <div key={p.id} className="bg-surface rounded-card p-3 border border-cream-dark">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-espresso leading-snug">
                    {p.items.map((i) => `${i.name} x${i.quantity}`).join(', ')}
                  </p>
                  <span className="font-semibold text-espresso whitespace-nowrap">
                    {formatRupiah(p.total)}
                  </span>
                </div>
                <p className="text-[11px] text-espresso/40 mt-1">
                  {formatDateTime(p.createdAt)}
                  {p.operatorName && ` · ${p.operatorName}`}
                  {!p.updateHpp && ' · HPP tidak diperbarui'}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {isPemilik && showForm && (
        <MenuFormModal
          initial={editing}
          existingCategories={existingCategories}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      )}

      {isPemilik && showStockPurchase && (
        <StockPurchaseModal
          menu={menu}
          onClose={() => setShowStockPurchase(false)}
          onSave={handleSaveStockPurchase}
        />
      )}

      {isPemilik && showCategoryManager && (
        <CategoryManagerModal
          menu={menu}
          onClose={() => setShowCategoryManager(false)}
          onChanged={refresh}
        />
      )}

      {isPemilik && confirmDeleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-cream rounded-card p-5 max-w-xs w-full space-y-4 text-center">
            <p className="text-espresso">Hapus menu ini? Tindakan tidak bisa dibatalkan.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 border border-cream-dark rounded-card py-2.5 text-espresso"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                className="flex-1 bg-brick text-cream rounded-card py-2.5"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
