'use client';

import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, NotebookPen, Share2, Send, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { CheckoutMethod, PaymentMethod, SplitPaymentDetail } from '@/lib/types';
import { formatRupiah, paymentMethodLabel } from '@/lib/utils/format';
import { GOOGLE_REVIEW_URL } from '@/lib/constants';
import { renderReceiptToCanvas, canvasToBlob, type ReceiptCanvasItem } from '@/lib/utils/receiptCanvas';
import { sendTelegramPhoto } from '@/lib/telegram';
import { getSettings } from '@/lib/storage/settingsService';

// Satu baris item struk — sengaja lebih ringkas dari CartItem (cuma butuh
// nama/qty/harga/varian/catatan yang sudah jadi teks, bukan referensi penuh
// ke MenuItem) supaya ReceiptModal bisa dipakai baik dari keranjang Kasir
// (yang punya objek MenuItem lengkap) maupun dari pesanan Belum Bayar yang
// baru dilunasi (yang cuma punya snapshot TransactionLineItem, tanpa
// MenuItem-nya lagi).
export interface ReceiptLineItem extends ReceiptCanvasItem {
  id: string;
}

export default function ReceiptModal({
  items,
  total,
  method,
  cashReceived,
  change,
  splitDetail,
  customerName,
  operatorName,
  createdAt,
  onClose,
}: {
  items: ReceiptLineItem[];
  total: number;
  method: CheckoutMethod;
  cashReceived?: number;
  change?: number;
  splitDetail?: SplitPaymentDetail;
  customerName?: string;
  operatorName?: string;
  createdAt?: string;
  onClose: () => void;
}) {
  const belumBayar = method === 'belum_bayar';
  const isSplit = method === 'split';

  const receiptCanvasRef = useRef<HTMLCanvasElement>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [sendPhotoState, setSendPhotoState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [sendPhotoError, setSendPhotoError] = useState<string | null>(null);
  // Penjaga supaya foto struk otomatis cuma terkirim SEKALI per modal
  // (bukan setiap re-render, dan bukan dua kali kalau efek mount sempat
  // terpanggil dua kali di React Strict Mode saat development).
  const autoSendAttemptedRef = useRef(false);

  // Caption lengkap (item, total, metode, rincian bayar) untuk transaksi yang
  // SUDAH dibayar — menggantikan pesan teks "Transaksi Baru" yang dulu
  // dikirim terpisah dari lib/storage/transactionService.ts, supaya
  // pemilik warung cukup dapat SATU pesan Telegram per transaksi: foto
  // struk dengan caption ini, bukan dua pesan yang isinya tumpang tindih
  // (lihat juga guard { telegram: false } di transactionService.ts).
  function buildTelegramCaption(): string {
    const itemLines = items
      .map(({ name, quantity, note, variantLabel }) => {
        return `- ${name}${variantLabel ? ` (${variantLabel})` : ''} x${quantity}${
          note ? ` (${note})` : ''
        }`;
      })
      .join('\n');
    const paymentMethod = method as PaymentMethod; // dijamin bukan 'belum_bayar' oleh pemanggil
    const metode = paymentMethodLabel(paymentMethod);
    const bayarLines =
      paymentMethod === 'cash' && cashReceived !== undefined
        ? `\nBayar: ${formatRupiah(cashReceived)}\nKembali: ${formatRupiah(change ?? 0)}`
        : paymentMethod === 'split' && splitDetail
          ? `\nCash: ${formatRupiah(splitDetail.cash)} · QRIS: ${formatRupiah(splitDetail.qris)}` +
            (splitDetail.kasbon > 0 ? `\nSisa Kasbon: ${formatRupiah(splitDetail.kasbon)}` : '')
          : '';
    return (
      `🧾 <b>Transaksi Baru</b>${operatorName ? ` — ${operatorName}` : ''}\n` +
      (customerName ? `Atas nama: ${customerName}\n` : '') +
      `${itemLines}\n` +
      `Total: ${formatRupiah(total)} (${metode})` +
      bayarLines
    );
  }

  async function sendReceiptPhoto(): Promise<boolean> {
    if (!receiptCanvasRef.current) return false;
    setSendPhotoState('sending');
    setSendPhotoError(null);
    try {
      const blob = await canvasToBlob(receiptCanvasRef.current);
      if (!blob) throw new Error('Gagal membuat gambar struk.');
      const caption = belumBayar
        ? `🧾 <b>Struk${customerName ? ` — ${customerName}` : ''}</b>\n` +
          `Total: ${formatRupiah(total)}\nStatus: Belum Dibayar`
        : buildTelegramCaption();
      const ok = await sendTelegramPhoto(blob, caption);
      if (!ok) throw new Error('Telegram menolak pengiriman gambar struk.');
      setSendPhotoState('success');
      return true;
    } catch (err) {
      setSendPhotoState('error');
      setSendPhotoError(err instanceof Error ? err.message : 'Gagal mengirim gambar struk.');
      return false;
    }
  }

  // Gambar struk sekali saat modal dibuka — data transaksi sudah final di
  // titik ini jadi tidak perlu digambar ulang. Dipakai untuk preview (foto
  // kecil di dalam modal) sekaligus sumber gambar yang dikirim ke Telegram.
  useEffect(() => {
    if (!receiptCanvasRef.current) return;
    renderReceiptToCanvas(receiptCanvasRef.current, {
      items,
      total,
      method,
      cashReceived,
      change,
      splitDetail,
      customerName,
      operatorName,
      createdAt,
    });
    setReceiptPreviewUrl(receiptCanvasRef.current.toDataURL('image/png'));

    // Auto-kirim foto struk + caption lengkap ke Telegram begitu transaksi
    // yang SUDAH dibayar (cash/QRIS/split) selesai dicatat. Pesanan "Belum
    // Bayar" sengaja TIDAK di-auto-kirim di sini — belum ada uang yang
    // diterima, dan sudah ada notifikasi teks "Pesanan Belum Dibayar"
    // tersendiri dari pendingOrderService.ts, jadi kasir masih perlu pakai
    // tombol kirim manual kalau memang mau membagikan foto strukunya juga.
    if (!belumBayar && !autoSendAttemptedRef.current) {
      autoSendAttemptedRef.current = true;
      (async () => {
        const settings = await getSettings();
        if (settings.transactionNotifyEnabled && settings.telegramChannelEnabled !== false) {
          await sendReceiptPhoto();
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSendReceiptPhoto() {
    await sendReceiptPhoto();
  }

  // Teks struk versi ringkas untuk dibagikan lewat WhatsApp — formatnya
  // mirip pesan rekap Telegram yang sudah ada, pakai *bold* ala WhatsApp.
  function buildReceiptText(): string {
    const lines = items.map(({ name, quantity, note, variantLabel, unitPrice }) => {
      return `${name}${variantLabel ? ` (${variantLabel})` : ''} x${quantity}${
        note ? ` (${note})` : ''
      } - ${formatRupiah(unitPrice * quantity)}`;
    });
    const statusLines = belumBayar
      ? ['Status: Belum Dibayar']
      : isSplit && splitDetail
        ? [
            'Metode: Split',
            `- Cash: ${formatRupiah(splitDetail.cash)}`,
            `- QRIS: ${formatRupiah(splitDetail.qris)}`,
            ...(splitDetail.kasbon > 0 ? [`- Kasbon (belum dibayar): ${formatRupiah(splitDetail.kasbon)}`] : []),
          ]
        : [
            `Metode: ${method === 'cash' ? 'Cash' : 'QRIS'}`,
            ...(method === 'cash' ? [`Kembalian: ${formatRupiah(change || 0)}`] : []),
          ];
    return [
      '*Struk Warkop Dua Tujuh*',
      ...(customerName ? [`Atas nama: ${customerName}`] : []),
      '',
      ...lines,
      '',
      `*Total: ${formatRupiah(total)}*`,
      ...statusLines,
    ].join('\n');
  }

  // Prioritaskan Web Share API (langsung buka pilihan aplikasi di HP,
  // termasuk WhatsApp) kalau tersedia — ini yang paling mulus di perangkat
  // mobile tempat kasir biasanya pakai app ini. Kalau tidak didukung
  // (mis. dibuka di desktop), fallback ke link wa.me yang membuka WhatsApp
  // Web/app dengan teks struk sudah terisi, tinggal pilih kontak pelanggan.
  async function handleShareWhatsApp() {
    const text = buildReceiptText();
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ text, title: 'Struk Warkop Dua Tujuh' });
        return;
      } catch {
        // Dibatalkan pengguna atau share gagal — lanjut ke fallback di bawah.
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-cream w-full sm:max-w-sm rounded-t-2xl sm:rounded-card p-6 space-y-4 text-center max-h-[92vh] overflow-y-auto">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
            belumBayar ? 'bg-brick/15 text-brick' : 'bg-sage/15 text-sage'
          }`}
        >
          {belumBayar ? <NotebookPen size={22} /> : <Check size={24} />}
        </div>
        <h2 className="font-display font-semibold text-lg text-espresso">
          {belumBayar ? 'Pesanan Disimpan (Belum Dibayar)' : 'Pesanan Selesai'}
        </h2>
        {customerName && (
          <p className="text-sm text-espresso/60">
            Atas nama <span className="font-medium text-espresso">{customerName}</span>
          </p>
        )}

        <div className="bg-surface rounded-card p-4 text-left space-y-1.5">
          {items.map(({ id, name, quantity, note, variantLabel, unitPrice }) => (
            <div key={id} className="flex justify-between text-sm text-espresso/80 gap-2">
              <span className="min-w-0">
                {name} x{quantity}
                {variantLabel && (
                  <span className="block text-xs text-espresso/50 truncate">
                    {variantLabel}
                  </span>
                )}
                {note && <span className="block text-xs text-espresso/50 italic truncate">&ldquo;{note}&rdquo;</span>}
              </span>
              <span className="shrink-0">{formatRupiah(unitPrice * quantity)}</span>
            </div>
          ))}
          <div className="border-t border-cream-dark mt-2 pt-2 flex justify-between font-semibold text-espresso">
            <span>Total</span>
            <span>{formatRupiah(total)}</span>
          </div>
          {belumBayar ? (
            <div className="flex justify-between text-xs text-brick">
              <span>Status</span>
              <span>Belum Dibayar</span>
            </div>
          ) : isSplit && splitDetail ? (
            <>
              <div className="flex justify-between text-xs text-espresso/50">
                <span>Metode</span>
                <span>Split</span>
              </div>
              {splitDetail.cash > 0 && (
                <div className="flex justify-between text-xs text-espresso/50">
                  <span>Cash</span>
                  <span>{formatRupiah(splitDetail.cash)}</span>
                </div>
              )}
              {splitDetail.qris > 0 && (
                <div className="flex justify-between text-xs text-espresso/50">
                  <span>QRIS</span>
                  <span>{formatRupiah(splitDetail.qris)}</span>
                </div>
              )}
              {splitDetail.kasbon > 0 && (
                <div className="flex justify-between text-xs text-brick">
                  <span>Kasbon (belum dibayar)</span>
                  <span>{formatRupiah(splitDetail.kasbon)}</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex justify-between text-xs text-espresso/50">
                <span>Metode</span>
                <span>{method === 'cash' ? 'Cash' : 'QRIS'}</span>
              </div>
              {method === 'cash' && (
                <div className="flex justify-between text-xs text-espresso/50">
                  <span>Kembalian</span>
                  <span>{formatRupiah(change || 0)}</span>
                </div>
              )}
            </>
          )}
        </div>

        {belumBayar ? (
          <p className="text-sm text-espresso/70">
            Pesanan ini tercatat di halaman <span className="font-medium text-espresso">Belum Bayar</span> —
            tandai &ldquo;Sudah Dibayar&rdquo; kalau sudah dilunasi, atau pindahkan ke Kasbon kalau tidak dibayar.
          </p>
        ) : isSplit && splitDetail && splitDetail.kasbon > 0 ? (
          <p className="text-sm text-espresso/70">
            Sisa {formatRupiah(splitDetail.kasbon)} sudah tercatat sebagai utang di{' '}
            <span className="font-medium text-espresso">Buku Kasbon</span>
            {customerName ? <> atas nama {customerName}</> : null}.
          </p>
        ) : (
          <div className="pt-2">
            <p className="text-sm text-espresso/70 mb-3">Suka kopinya? Bantu kasih ulasan ya 🙏</p>
            <div className="flex justify-center bg-white p-3 rounded-card w-fit mx-auto">
              <QRCodeSVG value={GOOGLE_REVIEW_URL} size={140} fgColor="#3C2415" />
            </div>
          </div>
        )}

        <button
          onClick={handleShareWhatsApp}
          className="w-full flex items-center justify-center gap-2 border border-sage text-sage rounded-card py-3 font-medium"
        >
          <Share2 size={18} /> Bagikan Struk ke WhatsApp
        </button>

        {/* Canvas dipakai untuk menggambar struk (lihat lib/utils/receiptCanvas.ts)
            — disembunyikan karena yang ditampilkan ke kasir cukup hasil
            toDataURL-nya di bawah (receiptPreviewUrl), sementara canvas asli
            tetap dipakai sebagai sumber saat dikonversi ke Blob untuk dikirim. */}
        <canvas ref={receiptCanvasRef} className="hidden" />

        {receiptPreviewUrl && (
          <div className="pt-1">
            <p className="text-xs text-espresso/50 mb-1.5">Preview gambar struk</p>
            <img
              src={receiptPreviewUrl}
              alt="Preview struk"
              className="mx-auto max-w-[220px] rounded-card border border-cream-dark shadow-sm"
            />
          </div>
        )}

        <button
          onClick={handleSendReceiptPhoto}
          disabled={sendPhotoState === 'sending'}
          className="w-full flex items-center justify-center gap-2 border border-espresso/30 text-espresso rounded-card py-3 font-medium disabled:opacity-40"
        >
          {sendPhotoState === 'sending' ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
          {belumBayar
            ? 'Kirim Gambar Struk ke Telegram'
            : sendPhotoState === 'success' || sendPhotoState === 'sending'
              ? 'Kirim Ulang ke Telegram'
              : 'Kirim Gambar Struk ke Telegram'}
        </button>
        {sendPhotoState === 'success' && (
          <p className="flex items-center justify-center gap-1.5 text-sm text-sage -mt-2">
            <CheckCircle2 size={16} />
            {belumBayar ? 'Gambar struk terkirim, cek Telegram.' : 'Terkirim otomatis ke Telegram, cek chat bot.'}
          </p>
        )}
        {sendPhotoState === 'error' && (
          <p className="flex items-center justify-center gap-1.5 text-sm text-brick -mt-2">
            <XCircle size={16} /> {sendPhotoError}
          </p>
        )}

        <button onClick={onClose} className="w-full bg-espresso text-cream rounded-card py-3 font-medium">
          Pesanan Baru
        </button>
      </div>
    </div>
  );
}
