'use client';

import { useState } from 'react';
import { X, Pencil, Trash2, Check, Loader2 } from 'lucide-react';
import type { MenuItem } from '@/lib/types';
import { renameCategory } from '@/lib/storage/menuService';

// Kategori bukan entitas tersendiri, cuma teks bebas di tiap MenuItem (lihat
// catatan di menuService.ts). Jadi "edit" dan "hapus" di sini sama-sama
// dikerjakan lewat renameCategory — hapus = pindahkan semua menunya ke
// kategori lain yang dipilih.
export default function CategoryManagerModal({
  menu,
  onClose,
  onChanged,
}: {
  menu: MenuItem[];
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const categories = Array.from(new Set(menu.map((m) => m.category))).sort((a, b) =>
    a.localeCompare(b)
  );
  const countOf = (c: string) => menu.filter((m) => m.category === c).length;

  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startRename(c: string) {
    setError(null);
    setDeleting(null);
    setRenaming(c);
    setRenameValue(c);
  }

  function startDelete(c: string) {
    setError(null);
    setRenaming(null);
    setDeleting(c);
    setMoveTarget(categories.find((other) => other !== c) ?? '');
  }

  async function confirmRename(from: string) {
    const to = renameValue.trim();
    if (!to || saving) return;
    // Nama baru boleh sama dengan kategori lain yang sudah ada (otomatis
    // digabung), tapi kalau ternyata sama persis dengan `from` ya berarti
    // tidak ada perubahan — cukup tutup mode edit tanpa nulis apa-apa.
    if (to === from) {
      setRenaming(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await renameCategory(from, to);
      setRenaming(null);
      await onChanged();
    } catch {
      setError('Gagal menyimpan, coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(from: string) {
    if (!moveTarget || saving) return;
    setSaving(true);
    setError(null);
    try {
      await renameCategory(from, moveTarget);
      setDeleting(null);
      await onChanged();
    } catch {
      setError('Gagal menghapus, coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-cream rounded-card p-5 max-w-sm w-full max-h-[85vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-lg text-espresso">Kelola Kategori</h3>
          <button onClick={onClose} className="text-espresso/50" aria-label="Tutup">
            <X size={20} />
          </button>
        </div>

        {categories.length === 0 ? (
          <p className="text-sm text-espresso/50 py-4 text-center">Belum ada kategori.</p>
        ) : (
          <div className="space-y-2">
            {categories.map((c) => (
              <div key={c} className="bg-surface rounded-card border border-cream-dark p-3">
                {renaming === c ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="flex-1 min-w-0 border border-cream-dark rounded-card px-3 py-2 bg-cream text-espresso text-sm focus:outline-none focus:border-espresso"
                    />
                    <button
                      onClick={() => confirmRename(c)}
                      disabled={saving || !renameValue.trim()}
                      className="shrink-0 w-9 h-9 rounded-full bg-espresso text-cream flex items-center justify-center disabled:opacity-40"
                      aria-label="Simpan nama kategori"
                    >
                      {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                    </button>
                    <button
                      onClick={() => setRenaming(null)}
                      disabled={saving}
                      className="shrink-0 text-xs text-espresso/60 px-2"
                    >
                      Batal
                    </button>
                  </div>
                ) : deleting === c ? (
                  <div className="space-y-2">
                    <p className="text-xs text-espresso/70">
                      {countOf(c)} menu di kategori &ldquo;{c}&rdquo; akan dipindah ke:
                    </p>
                    {categories.length <= 1 ? (
                      <p className="text-xs text-brick">
                        Ini satu-satunya kategori — buat kategori lain dulu lewat form tambah/ubah
                        menu sebelum bisa menghapus ini.
                      </p>
                    ) : (
                      <select
                        value={moveTarget}
                        onChange={(e) => setMoveTarget(e.target.value)}
                        className="w-full border border-cream-dark rounded-card px-3 py-2 bg-cream text-espresso text-sm focus:outline-none focus:border-espresso"
                      >
                        {categories
                          .filter((other) => other !== c)
                          .map((other) => (
                            <option key={other} value={other}>
                              {other}
                            </option>
                          ))}
                      </select>
                    )}
                    <div className="flex gap-2 pt-0.5">
                      <button
                        onClick={() => setDeleting(null)}
                        disabled={saving}
                        className="flex-1 border border-cream-dark rounded-card py-2 text-sm text-espresso"
                      >
                        Batal
                      </button>
                      <button
                        onClick={() => confirmDelete(c)}
                        disabled={saving || categories.length <= 1}
                        className="flex-1 bg-brick text-cream rounded-card py-2 text-sm disabled:opacity-40 flex items-center justify-center gap-1.5"
                      >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                        Hapus & Pindahkan
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-espresso truncate">{c}</p>
                      <p className="text-[11px] text-espresso/50">{countOf(c)} menu</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startRename(c)}
                        className="w-8 h-8 rounded-full bg-cream flex items-center justify-center text-espresso/60"
                        aria-label={`Ubah nama kategori ${c}`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => startDelete(c)}
                        className="w-8 h-8 rounded-full bg-cream flex items-center justify-center text-brick/70"
                        aria-label={`Hapus kategori ${c}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-xs text-brick text-center">{error}</p>}
      </div>
    </div>
  );
}
