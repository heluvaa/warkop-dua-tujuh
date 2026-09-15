'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DownloadCloud,
  UploadCloud,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Loader2,
  Palette,
  Users,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Bell,
  Send,
  MessageCircle,
} from 'lucide-react';
import {
  downloadBackup,
  restoreBackup,
  BackupValidationError,
  getDaysSinceLastBackup,
} from '@/lib/storage/backupService';
import { getAllOperators, createOperator, updateOperator, deleteOperator, getOperatorRole } from '@/lib/storage/operatorService';
import { getSettings, updateSettings } from '@/lib/storage/settingsService';
import { BACKUP_REMINDER_DAYS, KASBON_OVERDUE_DAYS, EXPENSE_NOTIFY_THRESHOLD } from '@/lib/constants';
import { formatRupiah } from '@/lib/utils/format';
import type { Operator, OperatorRole } from '@/lib/types';
import ThemeToggle from '@/components/theme/ThemeToggle';
import OperatorFormModal from '@/components/pengaturan/OperatorFormModal';
import QrisSettingsSection from '@/components/pengaturan/QrisSettingsSection';
import { useIsPemilik } from '@/lib/context/OperatorSessionContext';

type RestoreState = 'idle' | 'confirming' | 'restoring' | 'success' | 'error';

export default function PengaturanPage() {
  const isPemilik = useIsPemilik();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [restoreState, setRestoreState] = useState<RestoreState>('idle');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [daysSinceBackup, setDaysSinceBackup] = useState<number | null | 'unknown'>('unknown');
  const [lowStockNotifyEnabled, setLowStockNotifyEnabled] = useState(true);
  const [kasbonOverdueNotifyEnabled, setKasbonOverdueNotifyEnabled] = useState(true);
  const [transactionNotifyEnabled, setTransactionNotifyEnabled] = useState(true);
  const [kasbonCreatedNotifyEnabled, setKasbonCreatedNotifyEnabled] = useState(true);
  const [kasbonPaidNotifyEnabled, setKasbonPaidNotifyEnabled] = useState(true);
  const [pendingOrderNotifyEnabled, setPendingOrderNotifyEnabled] = useState(true);
  const [voidNotifyEnabled, setVoidNotifyEnabled] = useState(true);
  const [expenseNotifyEnabled, setExpenseNotifyEnabled] = useState(true);
  const [shiftNotifyEnabled, setShiftNotifyEnabled] = useState(true);
  const [shiftCashNotifyEnabled, setShiftCashNotifyEnabled] = useState(true);
  const [telegramCommandsEnabled, setTelegramCommandsEnabled] = useState(true);
  const [telegramChannelEnabled, setTelegramChannelEnabled] = useState(true);
  const [whatsappChannelEnabled, setWhatsappChannelEnabled] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [waTestState, setWaTestState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [waTestError, setWaTestError] = useState<string | null>(null);

  const [operators, setOperators] = useState<Operator[]>([]);
  const [showOperatorForm, setShowOperatorForm] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);
  const [confirmDeleteOperatorId, setConfirmDeleteOperatorId] = useState<string | null>(null);

  async function refreshBackupStatus() {
    setDaysSinceBackup(await getDaysSinceLastBackup());
  }

  async function refreshOperators() {
    setOperators(await getAllOperators());
  }

  useEffect(() => {
    refreshBackupStatus();
    refreshOperators();
    (async () => {
      const settings = await getSettings();
      setLowStockNotifyEnabled(settings.lowStockNotifyEnabled);
      setKasbonOverdueNotifyEnabled(settings.kasbonOverdueNotifyEnabled);
      setTransactionNotifyEnabled(settings.transactionNotifyEnabled);
      setKasbonCreatedNotifyEnabled(settings.kasbonCreatedNotifyEnabled);
      setKasbonPaidNotifyEnabled(settings.kasbonPaidNotifyEnabled);
      setPendingOrderNotifyEnabled(settings.pendingOrderNotifyEnabled);
      setVoidNotifyEnabled(settings.voidNotifyEnabled);
      setExpenseNotifyEnabled(settings.expenseNotifyEnabled);
      setShiftNotifyEnabled(settings.shiftNotifyEnabled);
      setShiftCashNotifyEnabled(settings.shiftCashNotifyEnabled);
      setTelegramCommandsEnabled(settings.telegramCommandsEnabled);
      setTelegramChannelEnabled(settings.telegramChannelEnabled);
      setWhatsappChannelEnabled(settings.whatsappChannelEnabled);
    })();
  }, []);

  async function handleToggleTelegramChannel() {
    const next = !telegramChannelEnabled;
    setTelegramChannelEnabled(next); // optimistic
    await updateSettings({ telegramChannelEnabled: next });
  }

  async function handleToggleWhatsappChannel() {
    const next = !whatsappChannelEnabled;
    setWhatsappChannelEnabled(next); // optimistic
    await updateSettings({ whatsappChannelEnabled: next });
  }

  async function handleToggleLowStockNotify() {
    const next = !lowStockNotifyEnabled;
    setLowStockNotifyEnabled(next); // optimistic
    await updateSettings({ lowStockNotifyEnabled: next });
  }

  async function handleToggleKasbonOverdueNotify() {
    const next = !kasbonOverdueNotifyEnabled;
    setKasbonOverdueNotifyEnabled(next); // optimistic
    await updateSettings({ kasbonOverdueNotifyEnabled: next });
  }

  async function handleToggleTransactionNotify() {
    const next = !transactionNotifyEnabled;
    setTransactionNotifyEnabled(next); // optimistic
    await updateSettings({ transactionNotifyEnabled: next });
  }

  async function handleToggleKasbonCreatedNotify() {
    const next = !kasbonCreatedNotifyEnabled;
    setKasbonCreatedNotifyEnabled(next); // optimistic
    await updateSettings({ kasbonCreatedNotifyEnabled: next });
  }

  async function handleToggleKasbonPaidNotify() {
    const next = !kasbonPaidNotifyEnabled;
    setKasbonPaidNotifyEnabled(next); // optimistic
    await updateSettings({ kasbonPaidNotifyEnabled: next });
  }

  async function handleTogglePendingOrderNotify() {
    const next = !pendingOrderNotifyEnabled;
    setPendingOrderNotifyEnabled(next); // optimistic
    await updateSettings({ pendingOrderNotifyEnabled: next });
  }

  async function handleToggleVoidNotify() {
    const next = !voidNotifyEnabled;
    setVoidNotifyEnabled(next); // optimistic
    await updateSettings({ voidNotifyEnabled: next });
  }

  async function handleToggleExpenseNotify() {
    const next = !expenseNotifyEnabled;
    setExpenseNotifyEnabled(next); // optimistic
    await updateSettings({ expenseNotifyEnabled: next });
  }

  async function handleToggleShiftNotify() {
    const next = !shiftNotifyEnabled;
    setShiftNotifyEnabled(next); // optimistic
    await updateSettings({ shiftNotifyEnabled: next });
  }

  async function handleToggleShiftCashNotify() {
    const next = !shiftCashNotifyEnabled;
    setShiftCashNotifyEnabled(next); // optimistic
    await updateSettings({ shiftCashNotifyEnabled: next });
  }

  async function handleToggleTelegramCommands() {
    const next = !telegramCommandsEnabled;
    setTelegramCommandsEnabled(next); // optimistic
    await updateSettings({ telegramCommandsEnabled: next });
  }

  async function handleTestConnection() {
    setTestState('sending');
    setTestError(null);
    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:
            '🔔 <b>Tes Notifikasi</b>\nKalau pesan ini muncul di Telegram, koneksi bot Warkop Dua Tujuh sudah oke.',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Gagal mengirim pesan tes.');
      }
      setTestState('success');
    } catch (err) {
      setTestState('error');
      setTestError(err instanceof Error ? err.message : 'Gagal mengirim pesan tes.');
    }
  }

  async function handleTestWhatsapp() {
    setWaTestState('sending');
    setWaTestError(null);
    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:
            '🔔 *Tes Notifikasi*\nKalau pesan ini muncul di WhatsApp, koneksi Warkop Dua Tujuh sudah oke.',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Gagal mengirim pesan tes.');
      }
      setWaTestState('success');
    } catch (err) {
      setWaTestState('error');
      setWaTestError(err instanceof Error ? err.message : 'Gagal mengirim pesan tes.');
    }
  }

  const backupOverdue =
    daysSinceBackup === null || (typeof daysSinceBackup === 'number' && daysSinceBackup >= BACKUP_REMINDER_DAYS);

  async function handleExport() {
    setExporting(true);
    try {
      await downloadBackup();
      await refreshBackupStatus();
    } finally {
      setExporting(false);
    }
  }

  function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setRestoreState('confirming');
    setRestoreError(null);
  }

  function cancelRestore() {
    setPendingFile(null);
    setRestoreState('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function confirmRestore() {
    if (!pendingFile || !isPemilik) return;
    setRestoreState('restoring');
    try {
      await restoreBackup(pendingFile);
      setRestoreState('success');
      await refreshOperators();
    } catch (err) {
      setRestoreState('error');
      setRestoreError(
        err instanceof BackupValidationError
          ? err.message
          : 'Gagal memulihkan data. Pastikan file backup tidak rusak.'
      );
    } finally {
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSaveOperator(data: { name: string; pin: string; role: OperatorRole }) {
    if (!isPemilik) return;
    if (editingOperator) {
      await updateOperator(editingOperator.id, data);
    } else {
      await createOperator(data);
    }
    setShowOperatorForm(false);
    setEditingOperator(null);
    await refreshOperators();
  }

  async function handleDeleteOperator(id: string) {
    if (!isPemilik) return;
    await deleteOperator(id);
    setConfirmDeleteOperatorId(null);
    await refreshOperators();
  }

  const backupStatusText =
    daysSinceBackup === 'unknown'
      ? ''
      : daysSinceBackup === null
        ? 'Belum pernah backup sama sekali.'
        : daysSinceBackup === 0
          ? 'Terakhir backup: hari ini.'
          : `Terakhir backup: ${daysSinceBackup} hari lalu.`;

  return (
    <div className="p-4 pb-24 md:pb-6 max-w-2xl">
      <h1 className="font-display font-semibold text-xl text-espresso mb-1">Pengaturan</h1>
      <p className="text-sm text-espresso/60 mb-6">Backup, kasir, & tampilan warkop.</p>

      {/* Tampilan */}
      <section className="bg-surface rounded-card border border-cream-dark p-4 mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-espresso">
          <Palette size={18} />
          <div>
            <h2 className="font-display font-semibold">Tampilan</h2>
            <p className="text-sm text-espresso/60">Ganti mode terang/gelap.</p>
          </div>
        </div>
        <ThemeToggle className="flex items-center justify-center w-8 h-8 rounded-full bg-cream-dark text-espresso hover:opacity-80 transition-opacity" />
      </section>

      {/* Channel Notifikasi */}
      <section className="bg-surface rounded-card border border-cream-dark p-4 mb-4">
        <div className="flex items-center gap-2 text-espresso mb-1">
          <MessageCircle size={18} />
          <h2 className="font-display font-semibold">Channel Notifikasi</h2>
        </div>
        <p className="text-sm text-espresso/60 mb-3">
          Pilih ke mana semua notifikasi di bawah ini diteruskan. Bisa nyalakan keduanya
          sekaligus kalau mau notifikasi masuk ke Telegram &amp; WhatsApp bersamaan.
        </p>

        <div className="flex items-center justify-between gap-3 py-2 border-b border-cream-dark">
          <div>
            <p className="text-sm text-espresso font-medium">Telegram</p>
            <p className="text-xs text-espresso/60">Perlu TELEGRAM_BOT_TOKEN &amp; TELEGRAM_CHAT_ID di .env.local.</p>
          </div>
          <button
            onClick={handleToggleTelegramChannel}
            role="switch"
            aria-checked={telegramChannelEnabled}
            className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${
              telegramChannelEnabled ? 'bg-espresso' : 'bg-cream-dark'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-cream transition-transform ${
                telegramChannelEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 py-2">
          <div>
            <p className="text-sm text-espresso font-medium">WhatsApp</p>
            <p className="text-xs text-espresso/60">
              Perlu FONNTE_TOKEN (atau WHATSAPP_CLOUD_TOKEN) &amp; WHATSAPP_TARGET di .env.local.
            </p>
          </div>
          <button
            onClick={handleToggleWhatsappChannel}
            role="switch"
            aria-checked={whatsappChannelEnabled}
            className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${
              whatsappChannelEnabled ? 'bg-espresso' : 'bg-cream-dark'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-cream transition-transform ${
                whatsappChannelEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="pt-3 mt-1 border-t border-cream-dark flex flex-wrap gap-2">
          <button
            onClick={handleTestConnection}
            disabled={testState === 'sending'}
            className="flex items-center gap-1.5 bg-cream-dark text-espresso rounded-card px-3.5 py-2 text-sm font-medium disabled:opacity-40"
          >
            {testState === 'sending' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            Tes Koneksi Telegram
          </button>
          <button
            onClick={handleTestWhatsapp}
            disabled={waTestState === 'sending'}
            className="flex items-center gap-1.5 bg-cream-dark text-espresso rounded-card px-3.5 py-2 text-sm font-medium disabled:opacity-40"
          >
            {waTestState === 'sending' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <MessageCircle size={16} />
            )}
            Tes Koneksi WhatsApp
          </button>
        </div>
        {testState === 'success' && (
          <p className="flex items-center gap-1.5 text-sm text-sage mt-2">
            <CheckCircle2 size={16} /> Pesan tes Telegram berhasil dikirim, cek Telegram.
          </p>
        )}
        {testState === 'error' && (
          <p className="flex items-center gap-1.5 text-sm text-brick mt-2">
            <XCircle size={16} /> {testError}
          </p>
        )}
        {waTestState === 'success' && (
          <p className="flex items-center gap-1.5 text-sm text-sage mt-2">
            <CheckCircle2 size={16} /> Pesan tes WhatsApp berhasil dikirim, cek WhatsApp.
          </p>
        )}
        {waTestState === 'error' && (
          <p className="flex items-center gap-1.5 text-sm text-brick mt-2">
            <XCircle size={16} /> {waTestError}
          </p>
        )}
      </section>

      {/* Notifikasi Telegram */}
      <section className="bg-surface rounded-card border border-cream-dark p-4 mb-4">
        <div className="flex items-center gap-2 text-espresso mb-3">
          <Bell size={18} />
          <h2 className="font-display font-semibold">Jenis Notifikasi</h2>
        </div>

        <div className="flex items-center justify-between gap-3 py-2 border-b border-cream-dark">
          <div>
            <p className="text-sm text-espresso font-medium">Transaksi Kasir</p>
            <p className="text-xs text-espresso/60">
              Kirim pesan tiap transaksi di Kasir selesai dibayar.
            </p>
          </div>
          <button
            onClick={handleToggleTransactionNotify}
            role="switch"
            aria-checked={transactionNotifyEnabled}
            className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${
              transactionNotifyEnabled ? 'bg-espresso' : 'bg-cream-dark'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-cream transition-transform ${
                transactionNotifyEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 py-2 border-b border-cream-dark">
          <div>
            <p className="text-sm text-espresso font-medium">Pesanan Belum Bayar</p>
            <p className="text-xs text-espresso/60">
              Kirim pesan begitu ada pesanan baru disimpan sebagai &ldquo;Belum Bayar&rdquo; di Kasir.
            </p>
          </div>
          <button
            onClick={handleTogglePendingOrderNotify}
            role="switch"
            aria-checked={pendingOrderNotifyEnabled}
            className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${
              pendingOrderNotifyEnabled ? 'bg-espresso' : 'bg-cream-dark'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-cream transition-transform ${
                pendingOrderNotifyEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 py-2 border-b border-cream-dark">
          <div>
            <p className="text-sm text-espresso font-medium">Stok Menipis</p>
            <p className="text-xs text-espresso/60">
              Kirim pesan begitu stok menu turun ke ambang batas menipis.
            </p>
          </div>
          <button
            onClick={handleToggleLowStockNotify}
            role="switch"
            aria-checked={lowStockNotifyEnabled}
            className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${
              lowStockNotifyEnabled ? 'bg-espresso' : 'bg-cream-dark'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-cream transition-transform ${
                lowStockNotifyEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 py-2 border-b border-cream-dark">
          <div>
            <p className="text-sm text-espresso font-medium">Kasbon Jatuh Tempo</p>
            <p className="text-xs text-espresso/60">
              Kirim pesan begitu kasbon belum lunas lebih dari {KASBON_OVERDUE_DAYS} hari.
            </p>
          </div>
          <button
            onClick={handleToggleKasbonOverdueNotify}
            role="switch"
            aria-checked={kasbonOverdueNotifyEnabled}
            className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${
              kasbonOverdueNotifyEnabled ? 'bg-espresso' : 'bg-cream-dark'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-cream transition-transform ${
                kasbonOverdueNotifyEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 py-2 border-b border-cream-dark">
          <div>
            <p className="text-sm text-espresso font-medium">Kasbon Baru</p>
            <p className="text-xs text-espresso/60">
              Kirim pesan begitu ada kasbon baru dicatat di halaman Kasbon.
            </p>
          </div>
          <button
            onClick={handleToggleKasbonCreatedNotify}
            role="switch"
            aria-checked={kasbonCreatedNotifyEnabled}
            className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${
              kasbonCreatedNotifyEnabled ? 'bg-espresso' : 'bg-cream-dark'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-cream transition-transform ${
                kasbonCreatedNotifyEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 py-2 border-b border-cream-dark">
          <div>
            <p className="text-sm text-espresso font-medium">Kasbon Lunas</p>
            <p className="text-xs text-espresso/60">Kirim pesan begitu pelanggan melunasi kasbonnya.</p>
          </div>
          <button
            onClick={handleToggleKasbonPaidNotify}
            role="switch"
            aria-checked={kasbonPaidNotifyEnabled}
            className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${
              kasbonPaidNotifyEnabled ? 'bg-espresso' : 'bg-cream-dark'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-cream transition-transform ${
                kasbonPaidNotifyEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 py-2 border-b border-cream-dark">
          <div>
            <p className="text-sm text-espresso font-medium">Transaksi Dibatalkan</p>
            <p className="text-xs text-espresso/60">
              Kirim pesan begitu ada transaksi yang di-void — penanda keamanan sederhana.
            </p>
          </div>
          <button
            onClick={handleToggleVoidNotify}
            role="switch"
            aria-checked={voidNotifyEnabled}
            className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${
              voidNotifyEnabled ? 'bg-espresso' : 'bg-cream-dark'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-cream transition-transform ${
                voidNotifyEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 py-2 border-b border-cream-dark">
          <div>
            <p className="text-sm text-espresso font-medium">Pengeluaran Besar</p>
            <p className="text-xs text-espresso/60">
              Kirim pesan untuk pengeluaran ≥ {formatRupiah(EXPENSE_NOTIFY_THRESHOLD)}.
            </p>
          </div>
          <button
            onClick={handleToggleExpenseNotify}
            role="switch"
            aria-checked={expenseNotifyEnabled}
            className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${
              expenseNotifyEnabled ? 'bg-espresso' : 'bg-cream-dark'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-cream transition-transform ${
                expenseNotifyEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 py-2 border-b border-cream-dark">
          <div>
            <p className="text-sm text-espresso font-medium">Buka/Tutup Shift</p>
            <p className="text-xs text-espresso/60">
              Kirim pesan begitu kasir pilih nama & PIN, atau tekan &quot;Ganti Kasir&quot;.
            </p>
          </div>
          <button
            onClick={handleToggleShiftNotify}
            role="switch"
            aria-checked={shiftNotifyEnabled}
            className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${
              shiftNotifyEnabled ? 'bg-espresso' : 'bg-cream-dark'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-cream transition-transform ${
                shiftNotifyEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 py-2 border-b border-cream-dark">
          <div>
            <p className="text-sm text-espresso font-medium">Buka/Tutup Shift Kas</p>
            <p className="text-xs text-espresso/60">
              Kirim pesan berisi modal awal saat shift dibuka, dan kas sistem/fisik/selisih saat
              shift ditutup.
            </p>
          </div>
          <button
            onClick={handleToggleShiftCashNotify}
            role="switch"
            aria-checked={shiftCashNotifyEnabled}
            className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${
              shiftCashNotifyEnabled ? 'bg-espresso' : 'bg-cream-dark'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-cream transition-transform ${
                shiftCashNotifyEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 py-2">
          <div>
            <p className="text-sm text-espresso font-medium">Perintah Bot (/omzet, /stok, /kasbon)</p>
            <p className="text-xs text-espresso/60">
              Bot bisa dikirimi perintah dari Telegram untuk balas data langsung — cuma jalan
              selama aplikasi kasir ini terbuka di salah satu perangkat.
            </p>
          </div>
          <button
            onClick={handleToggleTelegramCommands}
            role="switch"
            aria-checked={telegramCommandsEnabled}
            className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${
              telegramCommandsEnabled ? 'bg-espresso' : 'bg-cream-dark'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-cream transition-transform ${
                telegramCommandsEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </section>

      <QrisSettingsSection isPemilik={isPemilik} />

      {/* Kasir & Shift */}
      <section className="bg-surface rounded-card border border-cream-dark p-4 mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 text-espresso">
            <Users size={18} />
            <h2 className="font-display font-semibold">Kasir & Shift</h2>
          </div>
          {isPemilik && (
            <button
              onClick={() => {
                setEditingOperator(null);
                setShowOperatorForm(true);
              }}
              className="flex items-center gap-1 text-sm font-medium text-espresso bg-cream-dark rounded-full px-3 py-1.5"
            >
              <Plus size={14} /> Tambah
            </button>
          )}
        </div>
        <p className="text-sm text-espresso/60 mb-3">
          Kasir pilih namanya & masukkan PIN saat mulai jualan di halaman Kasir, supaya tercatat
          siapa yang jaga tiap shift. Ini bukan sistem login yang aman, cuma penanda shift.
          {!isPemilik && ' Cuma pemilik yang bisa tambah/ubah/hapus akun kasir.'}
        </p>

        {operators.length === 0 ? (
          <p className="text-sm text-espresso/50 text-center py-4">Belum ada akun kasir.</p>
        ) : (
          <div className="space-y-2">
            {operators.map((op) => (
              <div
                key={op.id}
                className="flex items-center gap-3 bg-cream rounded-card p-2.5 border border-cream-dark"
              >
                <span className="flex-1 min-w-0 text-sm font-medium text-espresso truncate">
                  {op.name}
                  <span className="ml-1.5 text-[10px] font-medium text-espresso/50 uppercase tracking-wide">
                    {getOperatorRole(op) === 'pemilik' ? 'Pemilik' : 'Kasir'}
                  </span>
                </span>
                <span className="text-xs text-espresso/40 tracking-widest shrink-0">
                  PIN {'•'.repeat(op.pin.length)}
                </span>
                {isPemilik && (
                  <>
                    <button
                      onClick={() => {
                        setEditingOperator(op);
                        setShowOperatorForm(true);
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-cream-dark text-espresso"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteOperatorId(op.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-brick/10 text-brick"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Backup / Export */}
      <section className="bg-surface rounded-card border border-cream-dark p-4 mb-4">
        <div className="flex items-center gap-2 text-espresso mb-1.5">
          <DownloadCloud size={18} />
          <h2 className="font-display font-semibold">Backup Data</h2>
        </div>
        <p className="text-sm text-espresso/60 mb-3">
          Unduh seluruh data (menu, transaksi, kasbon, pengeluaran, akun kasir) sebagai satu file
          JSON. Data hanya tersimpan di perangkat/browser ini, jadi sebaiknya backup rutin —
          terutama sebelum ganti HP/laptop atau membersihkan cache browser.
        </p>

        {backupOverdue && (
          <div className="flex items-start gap-2 bg-brick/10 border border-brick/30 rounded-card px-3.5 py-2.5 mb-3">
            <AlertTriangle size={16} className="text-brick mt-0.5 shrink-0" />
            <p className="text-sm text-brick">
              {daysSinceBackup === null
                ? 'Belum pernah backup sama sekali.'
                : `Sudah ${daysSinceBackup} hari sejak backup terakhir.`}{' '}
              Yuk backup sekarang biar data gak hilang kalau ada apa-apa.
            </p>
          </div>
        )}
        {!backupOverdue && backupStatusText && (
          <p className="text-xs text-espresso/50 mb-3">{backupStatusText}</p>
        )}

        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 bg-espresso text-cream rounded-card px-3.5 py-2 text-sm font-medium disabled:opacity-40"
        >
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <DownloadCloud size={16} />}
          Unduh Backup
        </button>
      </section>

      {/* Restore / Import */}
      <section className="bg-surface rounded-card border border-cream-dark p-4">
        <div className="flex items-center gap-2 text-espresso mb-1.5">
          <UploadCloud size={18} />
          <h2 className="font-display font-semibold">Pulihkan Data</h2>
        </div>
        <p className="text-sm text-espresso/60 mb-3">
          Pilih file backup (.json) untuk memulihkan data. Semua data yang ada saat ini di
          perangkat ini akan <span className="font-semibold text-brick">ditimpa</span> oleh isi file backup.
        </p>
        {!isPemilik ? (
          <p className="text-sm text-espresso/50 bg-cream rounded-card px-3.5 py-2.5 border border-cream-dark">
            Cuma pemilik yang bisa memulihkan/menimpa data.
          </p>
        ) : (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleFilePicked}
              className="hidden"
              id="restore-file-input"
            />
            <label
              htmlFor="restore-file-input"
              className="inline-flex items-center gap-1.5 bg-surface border border-cream-dark text-espresso rounded-card px-3.5 py-2 text-sm font-medium cursor-pointer"
            >
              <UploadCloud size={16} /> Pilih File Backup
            </label>
          </>
        )}

        {restoreState === 'success' && (
          <p className="flex items-center gap-1.5 text-sm text-sage mt-3">
            <CheckCircle2 size={16} /> Data berhasil dipulihkan. Muat ulang halaman lain untuk melihat perubahan.
          </p>
        )}
        {restoreState === 'error' && (
          <p className="flex items-center gap-1.5 text-sm text-brick mt-3">
            <XCircle size={16} /> {restoreError}
          </p>
        )}
      </section>

      {/* Modal konfirmasi restore */}
      {restoreState === 'confirming' && pendingFile && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-cream rounded-card p-5 max-w-xs w-full space-y-4 text-center">
            <ShieldAlert size={28} className="mx-auto text-brick" />
            <div>
              <p className="text-espresso font-medium mb-1">Timpa semua data saat ini?</p>
              <p className="text-sm text-espresso/60">
                File <span className="font-medium text-espresso">{pendingFile.name}</span> akan
                menggantikan seluruh data menu, transaksi, kasbon, dan pengeluaran yang ada
                sekarang. Tindakan ini tidak bisa dibatalkan.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={cancelRestore}
                className="flex-1 border border-cream-dark rounded-card py-2.5 text-espresso"
              >
                Batal
              </button>
              <button
                onClick={confirmRestore}
                disabled={restoreState !== 'confirming'}
                className="flex-1 bg-brick text-cream rounded-card py-2.5 flex items-center justify-center gap-1.5"
              >
                Timpa Data
              </button>
            </div>
          </div>
        </div>
      )}

      {restoreState === 'restoring' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-cream rounded-card p-5 max-w-xs w-full text-center flex flex-col items-center gap-2">
            <Loader2 size={24} className="animate-spin text-espresso" />
            <p className="text-sm text-espresso/70">Memulihkan data...</p>
          </div>
        </div>
      )}

      {showOperatorForm && (
        <OperatorFormModal
          initial={editingOperator}
          onClose={() => {
            setShowOperatorForm(false);
            setEditingOperator(null);
          }}
          onSave={handleSaveOperator}
        />
      )}

      {confirmDeleteOperatorId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-cream rounded-card p-5 max-w-xs w-full space-y-4 text-center">
            <p className="text-espresso">Hapus akun kasir ini? Tindakan tidak bisa dibatalkan.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteOperatorId(null)}
                className="flex-1 border border-cream-dark rounded-card py-2.5 text-espresso"
              >
                Batal
              </button>
              <button
                onClick={() => handleDeleteOperator(confirmDeleteOperatorId)}
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
