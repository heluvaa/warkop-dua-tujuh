'use client';

import { useEffect, useRef, useState } from 'react';
import { QrCode, Upload, Trash2, CheckCircle2, XCircle, Loader2, Lock } from 'lucide-react';
import { getSettings, updateSettings } from '@/lib/storage/settingsService';
import {
  validateStaticQris,
  decodeQrisFromImageFile,
  isBarcodeDetectionSupported,
  cleanRawCode,
  type QrisValidationResult,
} from '@/lib/utils/qris';

export default function QrisSettingsSection({ isPemilik }: { isPemilik: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savedCode, setSavedCode] = useState<string | undefined>();
  const [savedMerchantName, setSavedMerchantName] = useState<string | undefined>();
  const [editing, setEditing] = useState(false);
  const [draftCode, setDraftCode] = useState('');
  const [validation, setValidation] = useState<QrisValidationResult | null>(null);
  const [decoding, setDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    (async () => {
      const settings = await getSettings();
      setSavedCode(settings.qrisStaticCode);
      setSavedMerchantName(settings.qrisMerchantName);
    })();
  }, []);

  function handleStartEdit() {
    setDraftCode('');
    setValidation(null);
    setDecodeError(null);
    setEditing(true);
  }

  function handleCancelEdit() {
    setEditing(false);
    setDraftCode('');
    setValidation(null);
    setDecodeError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleDraftChange(value: string) {
    setDraftCode(value);
    setDecodeError(null);
    setValidation(value.trim() ? validateStaticQris(value) : null);
  }

  async function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDecoding(true);
    setDecodeError(null);
    try {
      const rawValue = await decodeQrisFromImageFile(file);
      handleDraftChange(rawValue);
    } catch (err) {
      setDecodeError(err instanceof Error ? err.message : 'Gagal membaca kode QR dari gambar.');
    } finally {
      setDecoding(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSave() {
    if (!validation || !validation.valid || saving) return;
    setSaving(true);
    try {
      const cleaned = cleanRawCode(draftCode);
      await updateSettings({
        qrisStaticCode: cleaned,
        qrisMerchantName: validation.info.merchantName,
      });
      setSavedCode(cleaned);
      setSavedMerchantName(validation.info.merchantName);
      setEditing(false);
      setDraftCode('');
      setValidation(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    await updateSettings({ qrisStaticCode: undefined, qrisMerchantName: undefined });
    setSavedCode(undefined);
    setSavedMerchantName(undefined);
    setConfirmRemove(false);
  }

  return (
    <section className="bg-surface rounded-card border border-cream-dark p-4 mb-4">
      <div className="flex items-center gap-2 text-espresso mb-1.5">
        <QrCode size={18} />
        <h2 className="font-display font-semibold">QRIS Pembayaran</h2>
      </div>
      <p className="text-sm text-espresso/60 mb-3">
        Simpan kode QRIS warkop sekali di sini, supaya kode QR yang muncul saat kasir pilih metode
        QRIS di halaman Kasir sudah otomatis terisi nominal tagihan — pelanggan tinggal scan, tanpa
        kasir perlu ketik manual nominal di aplikasi/mesin QRIS.
      </p>

      {!isPemilik ? (
        <p className="flex items-center gap-1.5 text-sm text-espresso/50 bg-cream rounded-card px-3.5 py-2.5 border border-cream-dark">
          <Lock size={14} className="shrink-0" />
          {savedCode
            ? `Kode QRIS sudah diatur${savedMerchantName ? ` (${savedMerchantName})` : ''}. Hanya pemilik yang bisa mengubahnya.`
            : 'Belum ada kode QRIS diatur. Hanya pemilik yang bisa mengaturnya.'}
        </p>
      ) : !editing ? (
        savedCode ? (
          <div className="flex items-center gap-3 bg-cream rounded-card p-3 border border-cream-dark">
            <div className="w-9 h-9 rounded-full bg-sage/15 text-sage flex items-center justify-center shrink-0">
              <CheckCircle2 size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-espresso truncate">
                {savedMerchantName || 'Kode QRIS tersimpan'}
              </p>
              <p className="text-xs text-espresso/50">Aktif dipakai di Kasir saat metode QRIS dipilih.</p>
            </div>
            <button
              onClick={handleStartEdit}
              className="text-xs px-3 py-1.5 rounded-full bg-surface border border-cream-dark text-espresso/70 shrink-0"
            >
              Ganti
            </button>
            <button
              onClick={() => setConfirmRemove(true)}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-brick/10 text-brick shrink-0"
              aria-label="Hapus kode QRIS"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={handleStartEdit}
            className="flex items-center gap-1.5 bg-espresso text-cream rounded-card px-3.5 py-2 text-sm font-medium"
          >
            <QrCode size={16} /> Atur Kode QRIS
          </button>
        )
      ) : (
        <div className="space-y-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFilePicked}
            className="hidden"
            id="qris-file-input"
          />
          <label
            htmlFor="qris-file-input"
            className="inline-flex items-center gap-1.5 bg-surface border border-cream-dark text-espresso rounded-card px-3.5 py-2 text-sm font-medium cursor-pointer"
          >
            {decoding ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {decoding ? 'Membaca kode QR...' : 'Unggah Foto Kode QRIS'}
          </label>
          {!isBarcodeDetectionSupported() && (
            <p className="text-xs text-espresso/40">
              Browser ini belum bisa membaca gambar QR otomatis — salin teks kodenya secara manual
              di bawah (bisa dapat dari aplikasi scan QR apa saja, atau dashboard penyelenggara QRIS Anda).
            </p>
          )}
          {decodeError && (
            <p className="flex items-center gap-1.5 text-sm text-brick">
              <XCircle size={14} className="shrink-0" /> {decodeError}
            </p>
          )}

          <textarea
            value={draftCode}
            onChange={(e) => handleDraftChange(e.target.value)}
            placeholder="Atau tempel teks kode QRIS di sini (diawali 000201...)"
            rows={3}
            className="w-full border border-cream-dark rounded-card px-3 py-2.5 text-xs text-espresso bg-cream focus:outline-none focus:border-espresso font-mono"
          />

          {validation && (
            <p
              className={`flex items-start gap-1.5 text-sm ${validation.valid ? 'text-sage' : 'text-brick'}`}
            >
              {validation.valid ? (
                <>
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                  <span>
                    Kode valid{validation.info.merchantName ? ` — ${validation.info.merchantName}` : ''}
                    {validation.info.merchantCity ? `, ${validation.info.merchantCity}` : ''}.
                  </span>
                </>
              ) : (
                <>
                  <XCircle size={15} className="shrink-0 mt-0.5" /> <span>{validation.error}</span>
                </>
              )}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCancelEdit}
              disabled={saving}
              className="flex-1 border border-cream-dark rounded-card py-2.5 text-espresso text-sm disabled:opacity-40"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !validation?.valid}
              className="flex-1 bg-espresso text-cream rounded-card py-2.5 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              Simpan
            </button>
          </div>
        </div>
      )}

      {confirmRemove && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-cream rounded-card p-5 max-w-xs w-full space-y-4 text-center">
            <p className="text-espresso">
              Hapus kode QRIS yang tersimpan? Kasir akan kembali ke alur QRIS manual (tanpa kode
              nominal otomatis) sampai kode baru diatur lagi.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmRemove(false)}
                className="flex-1 border border-cream-dark rounded-card py-2.5 text-espresso"
              >
                Batal
              </button>
              <button onClick={handleRemove} className="flex-1 bg-brick text-cream rounded-card py-2.5">
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
