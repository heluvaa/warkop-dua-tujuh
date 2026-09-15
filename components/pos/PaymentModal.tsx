'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Banknote, QrCode, NotebookPen, Divide } from 'lucide-react';
import type { CheckoutMethod, SplitPaymentDetail } from '@/lib/types';
import { formatRupiah } from '@/lib/utils/format';
import { getSettings } from '@/lib/storage/settingsService';
import { buildDynamicQrisPayload } from '@/lib/utils/qris';

export default function PaymentModal({
  total,
  onClose,
  onConfirm,
  // Set false untuk sembunyikan opsi "Belum Bayar" — dipakai saat modal ini
  // dibuka dari halaman Belum Bayar sendiri (mau menandai lunas, jadi cuma
  // Cash/QRIS/Split yang masuk akal, tidak mungkin "belum bayar" lagi).
  allowUnpaid = true,
  // Nama pelanggan yang sudah diisi di Kasir/pesanan ini (kalau ada) —
  // dipakai sebagai isian awal nama kasbon kalau kasir memilih Split dan
  // sebagian nominalnya jadi utang, supaya tidak perlu ketik ulang.
  defaultCustomerName = '',
}: {
  total: number;
  onClose: () => void;
  onConfirm: (
    method: CheckoutMethod,
    payload?: { cashReceived?: number; splitDetail?: SplitPaymentDetail; kasbonCustomerName?: string }
  ) => void | Promise<void>;
  allowUnpaid?: boolean;
  defaultCustomerName?: string;
}) {
  const [method, setMethod] = useState<CheckoutMethod>('cash');
  const [cashInput, setCashInput] = useState('');
  // Cegah tombol konfirmasi kepencet dua kali dengan cepat (mis. koneksi
  // lambat jadi kasir kira belum kepencet) — begitu ditekan sekali,
  // dikunci sampai onConfirm selesai diproses oleh pemanggil.
  const [submitting, setSubmitting] = useState(false);
  // Dipakai supaya tidak setState setelah modal ini di-unmount pemanggil
  // (kasus normal: pembayaran berhasil, modal langsung ditutup) — kalau
  // tidak dicek, React akan memperingatkan "set state setelah unmount".
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // --- State khusus mode Split ---------------------------------------
  const [splitCashInput, setSplitCashInput] = useState('');
  const [splitQrisInput, setSplitQrisInput] = useState('');
  const [splitKasbonInput, setSplitKasbonInput] = useState('');
  const [kasbonCustomerName, setKasbonCustomerName] = useState(defaultCustomerName);

  // Kode QRIS statis warkop (diatur pemilik di Pengaturan) — kalau ada,
  // dipakai untuk generate kode QRIS DINAMIS dengan nominal tagihan sudah
  // otomatis terisi, supaya pelanggan tinggal scan tanpa kasir perlu ketik
  // manual nominal di aplikasi/mesin QRIS terpisah. Kalau belum diatur,
  // alur lama (konfirmasi manual) tetap dipakai apa adanya.
  const [qrisStaticCode, setQrisStaticCode] = useState<string | undefined>();
  const [qrisMerchantName, setQrisMerchantName] = useState<string | undefined>();
  useEffect(() => {
    (async () => {
      const settings = await getSettings();
      setQrisStaticCode(settings.qrisStaticCode);
      setQrisMerchantName(settings.qrisMerchantName);
    })();
  }, []);

  // Kalau kode QRIS-nya ternyata rusak/berubah format sejak divalidasi saat
  // disimpan, gagal diam-diam ke null (bukan lempar error ke UI) — kasir
  // tetap bisa lanjut lewat alur QRIS manual seperti biasa.
  function tryBuildQris(amount: number): string | null {
    if (!qrisStaticCode || amount <= 0) return null;
    try {
      return buildDynamicQrisPayload(qrisStaticCode, amount);
    } catch {
      return null;
    }
  }
  const qrisDynamicPayload = useMemo(() => tryBuildQris(total), [qrisStaticCode, total]);

  const cashReceived = Number(cashInput) || 0;
  const change = useMemo(() => Math.max(0, cashReceived - total), [cashReceived, total]);
  const isValid = method !== 'cash' || cashReceived >= total;

  const quickAmounts = [5000, 10000, 20000, 50000, 100000];

  function handleQuickAmount(amt: number) {
    // Ditambahkan ke nominal yang sudah ada, bukan diganti — supaya kasir
    // bisa tap beberapa pecahan uang sekaligus (mis. 50rb + 20rb) sesuai
    // uang fisik yang diterima dari pelanggan.
    setCashInput((prev) => String((Number(prev) || 0) + amt));
  }

  const splitCash = Number(splitCashInput) || 0;
  const splitQris = Number(splitQrisInput) || 0;
  const splitKasbon = Number(splitKasbonInput) || 0;
  const splitQrisDynamicPayload = useMemo(() => tryBuildQris(splitQris), [qrisStaticCode, splitQris]);
  const splitAllocated = splitCash + splitQris + splitKasbon;
  // Sisa yang belum dialokasikan ke salah satu dari 3 kolom — kalau masih
  // ada sisa (positif), tombol konfirmasi dikunci sampai semuanya terbagi
  // habis pas dengan total tagihan.
  const splitRemaining = total - splitAllocated;
  const splitKasbonNameOk = splitKasbon <= 0 || kasbonCustomerName.trim().length > 0;
  const isSplitValid =
    splitAllocated > 0 && splitRemaining === 0 && splitCash >= 0 && splitQris >= 0 && splitKasbon >= 0 && splitKasbonNameOk;

  // Isi sisa yang belum teralokasi langsung ke kolom Kasbon — jalan pintas
  // paling umum di warkop: kasir ketik nominal cash yang diterima, lalu tap
  // ini supaya sisanya otomatis tercatat sebagai utang, tanpa hitung manual.
  function handleFillRemainingToKasbon() {
    if (splitRemaining <= 0) return;
    setSplitKasbonInput(String(splitKasbon + splitRemaining));
  }

  function makeDigitsHandler(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setter(e.target.value.replace(/\D/g, ''));
  }

  async function handleConfirmClick() {
    if (submitting) return; // sudah diproses, abaikan tap kedua
    setSubmitting(true);
    try {
      if (method === 'split') {
        await onConfirm(method, {
          splitDetail: { cash: splitCash, qris: splitQris, kasbon: splitKasbon },
          kasbonCustomerName: splitKasbon > 0 ? kasbonCustomerName.trim() : undefined,
        });
      } else {
        await onConfirm(method, { cashReceived: method === 'cash' ? cashReceived : undefined });
      }
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }

  const confirmDisabled = submitting || (method === 'split' ? !isSplitValid : !isValid);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-cream w-full sm:max-w-sm rounded-t-2xl sm:rounded-card p-5 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg text-espresso">Pembayaran</h2>
          <button onClick={onClose} disabled={submitting}>
            <X size={20} className="text-espresso/60" />
          </button>
        </div>

        <div className="bg-surface rounded-card p-4 text-center">
          <p className="text-xs text-espresso/50">Total Tagihan</p>
          <p className="text-2xl font-display font-semibold text-espresso">{formatRupiah(total)}</p>
        </div>

        <div className={`grid gap-2 ${allowUnpaid ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <button
            onClick={() => setMethod('cash')}
            className={`flex flex-col items-center gap-1.5 py-3 rounded-card border ${
              method === 'cash' ? 'border-espresso bg-surface' : 'border-cream-dark bg-surface/50 text-espresso/50'
            }`}
          >
            <Banknote size={20} />
            <span className="text-sm">Cash</span>
          </button>
          <button
            onClick={() => setMethod('qris')}
            className={`flex flex-col items-center gap-1.5 py-3 rounded-card border ${
              method === 'qris' ? 'border-espresso bg-surface' : 'border-cream-dark bg-surface/50 text-espresso/50'
            }`}
          >
            <QrCode size={20} />
            <span className="text-sm">QRIS</span>
          </button>
          <button
            onClick={() => setMethod('split')}
            className={`flex flex-col items-center gap-1.5 py-3 rounded-card border ${
              method === 'split' ? 'border-espresso bg-surface' : 'border-cream-dark bg-surface/50 text-espresso/50'
            }`}
          >
            <Divide size={20} />
            <span className="text-sm">Split</span>
          </button>
          {allowUnpaid && (
            <button
              onClick={() => setMethod('belum_bayar')}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-card border ${
                method === 'belum_bayar'
                  ? 'border-espresso bg-surface'
                  : 'border-cream-dark bg-surface/50 text-espresso/50'
              }`}
            >
              <NotebookPen size={20} />
              <span className="text-sm">Belum Bayar</span>
            </button>
          )}
        </div>

        {method === 'cash' && (
          <div className="space-y-2">
            <input
              inputMode="numeric"
              placeholder="Nominal diterima"
              value={cashInput ? Number(cashInput).toLocaleString('id-ID') : ''}
              onChange={(e) => setCashInput(e.target.value.replace(/\D/g, ''))}
              className="w-full border border-cream-dark rounded-card px-4 py-3 text-espresso bg-surface focus:outline-none focus:border-espresso"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-2 flex-wrap">
                {quickAmounts.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => handleQuickAmount(amt)}
                    className="text-xs px-3 py-1.5 rounded-full bg-surface border border-cream-dark text-espresso/70"
                  >
                    {formatRupiah(amt)}
                  </button>
                ))}
              </div>
              {cashInput && (
                <button
                  onClick={() => setCashInput('')}
                  className="text-xs px-2.5 py-1.5 rounded-full text-espresso/50 hover:text-espresso shrink-0"
                >
                  Reset
                </button>
              )}
            </div>
            <div className="flex items-center justify-between text-sm px-1">
              <span className="text-espresso/60">Kembalian</span>
              <span className="font-semibold text-sage">{formatRupiah(change)}</span>
            </div>
          </div>
        )}

        {method === 'qris' && (
          <div className="py-1">
            {qrisDynamicPayload ? (
              <div className="flex flex-col items-center gap-2 bg-surface border border-cream-dark rounded-card p-4">
                <QRCodeSVG value={qrisDynamicPayload} size={200} fgColor="#3C2415" />
                <p className="text-lg font-display font-semibold text-espresso">{formatRupiah(total)}</p>
                {qrisMerchantName && <p className="text-xs text-espresso/50">{qrisMerchantName}</p>}
                <p className="text-xs text-espresso/50 text-center">
                  Pelanggan tinggal scan — nominal sudah otomatis terisi. Tekan konfirmasi di bawah
                  setelah pembayaran masuk.
                </p>
              </div>
            ) : (
              <p className="text-sm text-espresso/60 text-center py-2">
                Konfirmasi setelah pembayaran QRIS diterima di mesin/aplikasi QRIS Anda.
                {!qrisStaticCode && (
                  <span className="block text-xs text-espresso/40 mt-1">
                    Tip: atur kode QRIS warkop di Pengaturan supaya kode QR dengan nominal otomatis
                    muncul di sini.
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        {method === 'split' && (
          <div className="space-y-3">
            <p className="text-xs text-espresso/50 text-center">
              Bagi tagihan ini ke beberapa metode — mis. sebagian cash, sebagian QRIS, atau
              sisanya jadi kasbon dulu.
            </p>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Banknote size={16} className="text-espresso/50 shrink-0" />
                <input
                  inputMode="numeric"
                  placeholder="Cash"
                  value={splitCashInput ? splitCash.toLocaleString('id-ID') : ''}
                  onChange={makeDigitsHandler(setSplitCashInput)}
                  className="w-full border border-cream-dark rounded-card px-3 py-2.5 text-espresso bg-surface focus:outline-none focus:border-espresso"
                />
              </div>
              <div className="flex items-center gap-2">
                <QrCode size={16} className="text-espresso/50 shrink-0" />
                <input
                  inputMode="numeric"
                  placeholder="QRIS"
                  value={splitQrisInput ? splitQris.toLocaleString('id-ID') : ''}
                  onChange={makeDigitsHandler(setSplitQrisInput)}
                  className="w-full border border-cream-dark rounded-card px-3 py-2.5 text-espresso bg-surface focus:outline-none focus:border-espresso"
                />
              </div>
              {splitQrisDynamicPayload && (
                <div className="flex flex-col items-center gap-1.5 bg-surface border border-cream-dark rounded-card p-3">
                  <QRCodeSVG value={splitQrisDynamicPayload} size={150} fgColor="#3C2415" />
                  <p className="text-sm font-medium text-espresso">{formatRupiah(splitQris)}</p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <NotebookPen size={16} className="text-brick shrink-0" />
                <input
                  inputMode="numeric"
                  placeholder="Kasbon (sisa belum dibayar)"
                  value={splitKasbonInput ? splitKasbon.toLocaleString('id-ID') : ''}
                  onChange={makeDigitsHandler(setSplitKasbonInput)}
                  className="w-full border border-cream-dark rounded-card px-3 py-2.5 text-espresso bg-surface focus:outline-none focus:border-espresso"
                />
              </div>
            </div>

            {splitRemaining !== 0 && (
              <button
                onClick={handleFillRemainingToKasbon}
                disabled={splitRemaining <= 0}
                className="w-full text-xs px-3 py-2 rounded-card bg-surface border border-cream-dark text-espresso/70 disabled:opacity-40"
              >
                Isi sisa {formatRupiah(Math.max(splitRemaining, 0))} ke Kasbon
              </button>
            )}

            <div className="flex items-center justify-between text-sm px-1">
              <span className="text-espresso/60">Sisa belum dialokasikan</span>
              <span className={`font-semibold ${splitRemaining === 0 ? 'text-sage' : 'text-brick'}`}>
                {formatRupiah(splitRemaining)}
              </span>
            </div>

            {splitKasbon > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-cream-dark">
                <label className="text-xs text-espresso/60">
                  Nama pelanggan (untuk dicatat di Buku Kasbon)
                </label>
                <input
                  type="text"
                  placeholder="Nama pelanggan"
                  value={kasbonCustomerName}
                  onChange={(e) => setKasbonCustomerName(e.target.value)}
                  className="w-full border border-cream-dark rounded-card px-3 py-2.5 text-espresso bg-surface focus:outline-none focus:border-espresso"
                />
              </div>
            )}
          </div>
        )}

        {method === 'belum_bayar' && (
          <p className="text-sm text-espresso/60 text-center py-2">
            Pesanan disimpan dulu tanpa dibayar sekarang. Nanti bisa ditandai
            &ldquo;Sudah Dibayar&rdquo; atau dipindah ke Kasbon dari halaman Belum Bayar.
          </p>
        )}

        <button
          onClick={handleConfirmClick}
          disabled={confirmDisabled}
          className="w-full bg-espresso text-cream rounded-card py-3 font-medium disabled:opacity-40"
        >
          {submitting
            ? 'Memproses...'
            : method === 'belum_bayar'
              ? 'Simpan Pesanan (Belum Bayar)'
              : 'Konfirmasi Pembayaran'}
        </button>
      </div>
    </div>
  );
}
