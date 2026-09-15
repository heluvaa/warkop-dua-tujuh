'use client';

import { useEffect, useState } from 'react';
import { Plus, Receipt, Pencil, Trash2 } from 'lucide-react';
import type { PengeluaranEntry } from '@/lib/types';
import {
  getAllPengeluaran,
  createPengeluaran,
  updatePengeluaran,
  deletePengeluaran,
} from '@/lib/storage/pengeluaranService';
import { getActiveOperator } from '@/lib/storage/operatorService';
import { formatRupiah, formatDateTime } from '@/lib/utils/format';
import PengeluaranFormModal from '@/components/pengeluaran/PengeluaranFormModal';

export default function PengeluaranPage() {
  const [entries, setEntries] = useState<PengeluaranEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PengeluaranEntry | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function refresh() {
    setEntries(await getAllPengeluaran());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSave(data: { name: string; amount: number }) {
    if (editing) {
      await updatePengeluaran(editing.id, data);
    } else {
      const session = await getActiveOperator();
      await createPengeluaran({ ...data, operatorName: session?.operatorName });
    }
    setShowForm(false);
    setEditing(null);
    await refresh();
  }

  async function handleDelete(id: string) {
    await deletePengeluaran(id);
    setConfirmDeleteId(null);
    await refresh();
  }

  const today = new Date().toDateString();
  const todayEntries = entries
    .filter((e) => new Date(e.createdAt).toDateString() === today)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const totalToday = todayEntries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="p-4 pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display font-semibold text-xl text-espresso">Pengeluaran Harian</h1>
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
        Total pengeluaran hari ini: <span className="font-semibold text-brick">{formatRupiah(totalToday)}</span>
      </p>

      {todayEntries.length === 0 ? (
        <p className="text-sm text-espresso/50 text-center py-10">Belum ada pengeluaran tercatat hari ini.</p>
      ) : (
        <div className="space-y-2">
          {todayEntries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 bg-surface rounded-card p-3 border border-cream-dark">
              <div className="w-9 h-9 rounded-full bg-brick/10 text-brick flex items-center justify-center shrink-0">
                <Receipt size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-espresso truncate">{entry.name}</p>
                <p className="text-xs text-espresso/50">
                  {formatDateTime(entry.createdAt)}
                  {entry.operatorName && ` · ${entry.operatorName}`}
                </p>
              </div>
              <span className="font-semibold text-espresso">{formatRupiah(entry.amount)}</span>
              <div className="flex items-center gap-1.5 pl-1">
                <button
                  onClick={() => {
                    setEditing(entry);
                    setShowForm(true);
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-cream-dark text-espresso"
                  aria-label="Edit pengeluaran"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setConfirmDeleteId(entry.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-brick/10 text-brick"
                  aria-label="Hapus pengeluaran"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <PengeluaranFormModal
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
            <p className="text-espresso">Hapus pengeluaran ini? Tindakan tidak bisa dibatalkan.</p>
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
