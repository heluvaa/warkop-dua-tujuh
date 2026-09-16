'use client';

import { useEffect, useState } from 'react';
import { History, LogIn, LogOut, Trash2, Loader2 } from 'lucide-react';
import { getLoginLogs, clearLoginLogs } from '@/lib/storage/operatorService';
import { formatDateTime } from '@/lib/utils/format';
import type { LoginLogEntry } from '@/lib/types';

// Berapa baris yang ditampilkan di layar Pengaturan — riwayat lengkapnya
// tetap tersimpan (sampai MAX_LOGIN_LOG_ENTRIES di operatorService.ts),
// ini cuma batas tampilan supaya halaman tidak kepanjangan.
const VISIBLE_COUNT = 30;

/**
 * Riwayat login/logout kasir — audit trail siapa buka/tutup akses
 * aplikasi dan kapan. Hanya pemilik yang boleh lihat & menghapusnya,
 * sama seperti bagian Kasir & Shift lainnya.
 */
export default function LoginLogSection({ isPemilik }: { isPemilik: boolean }) {
  const [logs, setLogs] = useState<LoginLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function refresh() {
    setLogs(await getLoginLogs(VISIBLE_COUNT));
  }

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, []);

  if (!isPemilik) return null;

  async function handleClear() {
    setClearing(true);
    try {
      await clearLoginLogs();
      setConfirmClear(false);
      await refresh();
    } finally {
      setClearing(false);
    }
  }

  return (
    <section className="bg-surface rounded-card border border-cream-dark p-4 mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 text-espresso">
          <History size={18} />
          <h2 className="font-display font-semibold">Log Login</h2>
        </div>
        {logs.length > 0 && (
          <button
            onClick={() => setConfirmClear(true)}
            className="flex items-center gap-1 text-sm font-medium text-brick bg-brick/10 rounded-full px-3 py-1.5"
          >
            <Trash2 size={13} /> Hapus
          </button>
        )}
      </div>
      <p className="text-sm text-espresso/60 mb-3">
        Riwayat kasir masuk (pilih nama & PIN) dan keluar dari aplikasi ini. Cuma pemilik yang
        bisa lihat & menghapus riwayat ini.
      </p>

      {loading ? (
        <p className="text-sm text-espresso/50 text-center py-4">Memuat...</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-espresso/50 text-center py-4">Belum ada riwayat login.</p>
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-center gap-3 bg-cream rounded-card px-3 py-2 border border-cream-dark"
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                  log.action === 'login' ? 'bg-sage/20 text-sage' : 'bg-brick/10 text-brick'
                }`}
              >
                {log.action === 'login' ? <LogIn size={13} /> : <LogOut size={13} />}
              </span>
              <span className="flex-1 min-w-0 text-sm text-espresso truncate">
                <span className="font-medium">{log.operatorName}</span>{' '}
                {log.action === 'login' ? 'masuk' : 'keluar'}
              </span>
              <span className="text-xs text-espresso/50 shrink-0">{formatDateTime(log.at)}</span>
            </div>
          ))}
        </div>
      )}

      {confirmClear && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-cream rounded-card p-5 max-w-xs w-full space-y-4 text-center">
            <p className="text-espresso">Hapus semua riwayat login? Tindakan tidak bisa dibatalkan.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmClear(false)}
                disabled={clearing}
                className="flex-1 border border-cream-dark rounded-card py-2.5 text-espresso disabled:opacity-40"
              >
                Batal
              </button>
              <button
                onClick={handleClear}
                disabled={clearing}
                className="flex-1 bg-brick text-cream rounded-card py-2.5 flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {clearing ? <Loader2 size={16} className="animate-spin" /> : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
