'use client';

import { useEffect, useState } from 'react';
import { Plus, AlertTriangle, Search, X } from 'lucide-react';
import type { KasbonEntry } from '@/lib/types';
import {
  getAllKasbon,
  createKasbon,
  updateKasbon,
  deleteKasbon,
  lunasiKasbon,
  checkOverdueKasbonNotifications,
} from '@/lib/storage/kasbonService';
import { formatRupiah } from '@/lib/utils/format';
import { daysSince } from '@/lib/utils/date';
import { KASBON_OVERDUE_DAYS } from '@/lib/constants';
import KasbonListItem from '@/components/kasbon/KasbonListItem';
import KasbonFormModal from '@/components/kasbon/KasbonFormModal';

type Filter = 'belum_lunas' | 'jatuh_tempo' | 'lunas' | 'semua';

export default function KasbonPage() {
  const [entries, setEntries] = useState<KasbonEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<KasbonEntry | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('belum_lunas');
  const [query, setQuery] = useState('');

  async function refresh() {
    setEntries(await getAllKasbon());
    await checkOverdueKasbonNotifications();
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSave(data: {
    customerName: string;
    items: { name: string; price: number; quantity: number }[];
    total: number;
  }) {
    if (editing) {
      await updateKasbon(editing.id, data);
    } else {
      await createKasbon(data);
    }
    setShowForm(false);
    setEditing(null);
    await refresh();
  }

  async function handleLunasi(id: string) {
    await lunasiKasbon(id);
    await refresh();
  }

  async function handleDelete(id: string) {
    await deleteKasbon(id);
    setConfirmDeleteId(null);
    await refresh();
  }

  const q = query.trim().toLowerCase();
  const filtered = entries
    .filter((e) => {
      if (filter === 'semua') return true;
      if (filter === 'jatuh_tempo') return e.status === 'belum_lunas' && daysSince(e.createdAt) >= KASBON_OVERDUE_DAYS;
      return e.status === filter;
    })
    .filter((e) => !q || e.customerName.toLowerCase().includes(q))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const belumLunasEntries = entries.filter((e) => e.status === 'belum_lunas');
  const totalBelumLunas = belumLunasEntries.reduce((sum, e) => sum + e.total, 0);
  const jatuhTempoEntries = belumLunasEntries.filter((e) => daysSince(e.createdAt) >= KASBON_OVERDUE_DAYS);

  const filters: { key: Filter; label: string }[] = [
    { key: 'belum_lunas', label: 'Belum Lunas' },
    { key: 'jatuh_tempo', label: `Jatuh Tempo (${jatuhTempoEntries.length})` },
    { key: 'lunas', label: 'Lunas' },
    { key: 'semua', label: 'Semua' },
  ];

  return (
    <div className="p-4 pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display font-semibold text-xl text-espresso">Buku Kasbon</h1>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="flex items-center gap-1.5 bg-espresso text-cream rounded-card px-3.5 py-2 text-sm font-medium"
        >
          <Plus size={16} /> Catat
        </button>
      </div>
      <p className="text-sm text-espresso/60 mb-4">
        Total belum lunas: <span className="font-semibold text-brick">{formatRupiah(totalBelumLunas)}</span>
      </p>

      {jatuhTempoEntries.length > 0 && (
        <div className="flex items-start gap-2 bg-brick/10 border border-brick/30 rounded-card px-3.5 py-2.5 mb-4">
          <AlertTriangle size={16} className="text-brick mt-0.5 shrink-0" />
          <p className="text-sm text-brick">
            <span className="font-semibold">{jatuhTempoEntries.length} kasbon</span> sudah belum
            lunas lebih dari {KASBON_OVERDUE_DAYS} hari. Yuk ditagih sebelum kelupaan.
          </p>
        </div>
      )}

      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar -mx-1 px-1">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm border whitespace-nowrap ${
              filter === f.key
                ? 'bg-espresso text-cream border-espresso'
                : 'bg-surface text-espresso/70 border-cream-dark'
            }`}
          >
            {f.label}
          </button>
        ))}
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
          placeholder="Cari nama pelanggan..."
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

      {filtered.length === 0 ? (
        <p className="text-sm text-espresso/50 text-center py-10">
          {q ? `Tidak ada pelanggan yang cocok dengan "${query}".` : 'Tidak ada catatan kasbon.'}
        </p>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((entry) => (
            <KasbonListItem
              key={entry.id}
              entry={entry}
              onLunasi={() => handleLunasi(entry.id)}
              onEdit={() => {
                setEditing(entry);
                setShowForm(true);
              }}
              onDelete={() => setConfirmDeleteId(entry.id)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <KasbonFormModal
          initial={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-cream rounded-card p-5 max-w-xs w-full space-y-4 text-center">
            <p className="text-espresso">
              Hapus kasbon ini? Tindakan tidak bisa dibatalkan.
              {entries.find((e) => e.id === confirmDeleteId)?.status === 'lunas' && (
                <>
                  {' '}
                  Transaksi pemasukan yang tercatat di Laporan untuk kasbon ini juga akan dibatalkan
                  (void).
                </>
              )}
            </p>
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
