'use client';

import { useEffect, useState } from 'react';
import { Wallet, CheckCircle2, TrendingUp, TrendingDown, Clock, Trash2, AlertTriangle, Loader2, Pencil } from 'lucide-react';
import type { ShiftEntry } from '@/lib/types';
import { getShiftHistory, clearAllShifts, updateShiftModal } from '@/lib/storage/shiftService';
import { formatRupiah, formatDateTime } from '@/lib/utils/format';
import { useIsPemilik, useOperatorSession } from '@/lib/context/OperatorSessionContext';

// Riwayat shift laci kas (buka dengan modal awal, tutup dengan hitung fisik
// & selisih) — lihat lib/storage/shiftService.ts. Dipisah jadi komponen
// sendiri (bukan ditulis langsung di app/laporan/page.tsx yang sudah besar)
// karena datanya per-shift, bukan per-tanggal-yang-dipilih seperti bagian
// lain di halaman itu.
export default function ShiftHistorySection() {
  const isPemilik = useIsPemilik();
  const [shifts, setShifts] = useState<ShiftEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    setLoading(true);
    return getShiftHistory()
      .then(setShifts)
      .finally(() => setLoading(false));
  }

  // Reset khusus riwayat shift (beda dari "Reset Semua Data" di halaman
  // Laporan yang sekalian menghapus transaksi, pengeluaran, dll) — dipakai
  // kalau pemilik cuma mau bersihkan catatan buka/tutup laci kas tanpa
  // menyentuh data penjualan. Hanya pemilik yang boleh, sama seperti aksi
  // hapus data lain di halaman ini.
  async function handleResetShifts() {
    if (!isPemilik || resetting) return;
    setResetting(true);
    try {
      await clearAllShifts();
      setConfirmReset(false);
      await refresh();
    } finally {
      setResetting(false);
    }
  }

  if (loading) return null;
  if (shifts.length === 0) return null;

  const visible = expanded ? shifts : shifts.slice(0, 5);
  const hasActiveShift = shifts.some((s) => s.status === 'open');

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="font-display font-semibold text-espresso flex items-center gap-1.5">
          <Wallet size={17} /> Riwayat Shift
        </h2>
        {isPemilik && (
          <button
            onClick={() => setConfirmReset(true)}
            className="flex items-center gap-1 text-xs font-medium text-brick"
          >
            <Trash2 size={13} /> Reset
          </button>
        )}
      </div>
      <div className="space-y-2">
        {visible.map((shift) => (
          <ShiftRow key={shift.id} shift={shift} isPemilik={isPemilik} onEdited={refresh} />
        ))}
      </div>
      {shifts.length > 5 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-sm font-medium text-espresso underline underline-offset-2"
        >
          {expanded ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${shifts.length})`}
        </button>
      )}

      {confirmReset && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-cream rounded-card p-5 max-w-xs w-full space-y-4">
            <div className="flex items-center gap-2 text-brick">
              <AlertTriangle size={20} />
              <h3 className="font-display font-semibold text-lg">Reset Riwayat Shift</h3>
            </div>
            <p className="text-sm text-espresso/70">
              Ini akan menghapus SELURUH riwayat buka/tutup shift ({shifts.length} shift) dan tidak
              bisa dibatalkan.
              {hasActiveShift &&
                ' Ada shift yang sedang berjalan sekarang — shift itu juga akan ikut terhapus, jadi status kas akan kembali "belum dibuka".'}
            </p>
            <p className="text-xs text-espresso/50">
              Data transaksi, pengeluaran, dan lainnya di Laporan tidak ikut terhapus.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmReset(false)}
                disabled={resetting}
                className="flex-1 border border-cream-dark rounded-card py-2.5 text-espresso disabled:opacity-40"
              >
                Batal
              </button>
              <button
                onClick={handleResetShifts}
                disabled={resetting}
                className="flex-1 bg-brick text-cream rounded-card py-2.5 disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {resetting ? <Loader2 size={16} className="animate-spin" /> : null}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ShiftRow({
  shift,
  isPemilik,
  onEdited,
}: {
  shift: ShiftEntry;
  isPemilik: boolean;
  onEdited: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (shift.status === 'open') {
    return (
      <div className="bg-surface rounded-card border border-cream-dark p-3.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-espresso flex items-center gap-1.5">
            <Clock size={13} className="text-caramel shrink-0" />
            Sedang berjalan — {shift.operatorName}
          </p>
          <p className="text-xs text-espresso/50 mt-0.5">
            Dibuka {formatDateTime(shift.openedAt)} · Modal {formatRupiah(shift.modalAwal)}
          </p>
          {/* Jejak audit: kelihatan kalau modal awal shift ini pernah
              dikoreksi pemilik dari nilai aslinya. */}
          {shift.modalAwalEditedAt && (
            <p className="text-[11px] text-espresso/40 mt-0.5">
              Dikoreksi dari {formatRupiah(shift.modalAwalOriginal ?? 0)} oleh{' '}
              {shift.modalAwalEditedByOperatorName} · {formatDateTime(shift.modalAwalEditedAt)}
            </p>
          )}
        </div>
        {/* Cuma pemilik yang boleh koreksi modal awal — kasir yang salah
            ketik modalnya sendiri harus minta pemilik yang benerin, supaya
            ada kontrol siapa yang boleh ubah angka kas. */}
        {isPemilik && (
          <button
            onClick={() => setEditing(true)}
            className="shrink-0 w-8 h-8 rounded-full bg-cream flex items-center justify-center text-espresso/60"
            aria-label="Koreksi modal awal"
          >
            <Pencil size={14} />
          </button>
        )}
        {editing && (
          <EditModalAwalDialog
            shift={shift}
            isPemilik={isPemilik}
            onClose={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              onEdited();
            }}
          />
        )}
      </div>
    );
  }

  const selisih = shift.selisih ?? 0;

  return (
    <div className="bg-surface rounded-card border border-cream-dark p-3.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-medium text-espresso truncate">
            {shift.operatorName}
            {shift.closedByOperatorName && shift.closedByOperatorName !== shift.operatorName
              ? ` → ditutup ${shift.closedByOperatorName}`
              : ''}
          </p>
          <p className="text-xs text-espresso/50 mt-0.5">
            {formatDateTime(shift.openedAt)} — {shift.closedAt ? formatDateTime(shift.closedAt) : '-'}
          </p>
        </div>
        <div
          className={`flex items-center gap-1.5 text-sm font-semibold shrink-0 ${
            selisih === 0 ? 'text-sage' : selisih > 0 ? 'text-caramel' : 'text-brick'
          }`}
        >
          {selisih === 0 ? (
            <CheckCircle2 size={15} />
          ) : selisih > 0 ? (
            <TrendingUp size={15} />
          ) : (
            <TrendingDown size={15} />
          )}
          {selisih === 0 ? 'Pas' : formatRupiah(Math.abs(selisih))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-cream-dark text-xs">
        <div>
          <p className="text-espresso/50">Modal Awal</p>
          <p className="font-medium text-espresso">{formatRupiah(shift.modalAwal)}</p>
        </div>
        <div>
          <p className="text-espresso/50">Kas Sistem</p>
          <p className="font-medium text-espresso">{formatRupiah(shift.systemCash ?? 0)}</p>
        </div>
        <div>
          <p className="text-espresso/50">Kas Fisik</p>
          <p className="font-medium text-espresso">{formatRupiah(shift.physicalCash ?? 0)}</p>
        </div>
      </div>

      {shift.note && (
        <p className="text-xs text-espresso/60 mt-2.5 pt-2.5 border-t border-cream-dark italic">
          &ldquo;{shift.note}&rdquo;
        </p>
      )}
    </div>
  );
}

// Dialog kecil khusus pemilik untuk koreksi modal awal shift yang masih
// 'open' — dipisah dari ShiftRow supaya ShiftRow sendiri tetap ringkas.
function EditModalAwalDialog({
  shift,
  isPemilik,
  onClose,
  onSaved,
}: {
  shift: ShiftEntry;
  isPemilik: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { operatorName } = useOperatorSession();
  const [amountInput, setAmountInput] = useState(String(shift.modalAwal));
  const [saving, setSaving] = useState(false);
  const modalAwal = Number(amountInput) || 0;

  async function handleSave() {
    // Tombol pembuka dialog ini sudah disembunyikan dari kasir (lihat
    // ShiftRow), tapi dijaga sekali lagi di sini supaya tidak bisa dipanggil
    // lewat jalan lain selain klik tombol yang memang khusus pemilik.
    if (!isPemilik || saving) return;
    setSaving(true);
    try {
      await updateShiftModal({
        shiftId: shift.id,
        modalAwal,
        editedByOperatorName: operatorName,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-cream rounded-card p-5 max-w-xs w-full space-y-4">
        <div>
          <h3 className="font-display font-semibold text-lg text-espresso">Koreksi Modal Awal</h3>
          <p className="text-xs text-espresso/60 mt-1">
            Shift {shift.operatorName} — dibuka {formatDateTime(shift.openedAt)}. Perubahan ini ikut
            memengaruhi perhitungan selisih kas saat shift ini nanti ditutup.
          </p>
        </div>
        <div>
          <label className="text-xs text-espresso/60">Modal Awal</label>
          <input
            inputMode="numeric"
            autoFocus
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value.replace(/\D/g, ''))}
            className="w-full border border-cream-dark rounded-card px-4 py-3 bg-surface text-espresso mt-1 text-lg font-semibold focus:outline-none focus:border-espresso"
          />
          <p className="text-xs text-espresso/50 mt-1">{formatRupiah(modalAwal)}</p>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 border border-cream-dark rounded-card py-2.5 text-espresso disabled:opacity-40"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-espresso text-cream rounded-card py-2.5 disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
