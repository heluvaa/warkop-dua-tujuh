import type { PaymentMethod } from '../types';

// Label singkat metode bayar untuk badge/tabel — dipusatkan di sini supaya
// semua tempat (Laporan, riwayat pelanggan, dst) konsisten begitu ada
// metode 'split', bukan cuma ternary cash/qris seperti sebelumnya.
export function paymentMethodLabel(method: PaymentMethod): string {
  if (method === 'cash') return 'Cash';
  if (method === 'qris') return 'QRIS';
  return 'Split';
}

// Gabungkan nama item dengan label variannya (kalau ada) untuk ditampilkan
// di satu baris — dipakai di semua daftar item transaksi/kasbon/belum-bayar
// supaya formatnya konsisten, mis. "Kopi Susu Gula Aren (Large · Boba)".
export function formatItemLabel(name: string, variantLabel?: string): string {
  return variantLabel ? `${name} (${variantLabel})` : name;
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Versi ringkas untuk label grafik/ruang sempit, misal "125rb" atau "1,2jt".
export function formatRupiahShort(value: number): string {
  if (value <= 0) return '0';
  if (value >= 1_000_000) {
    const jt = value / 1_000_000;
    return `${jt % 1 === 0 ? jt : jt.toFixed(1)}jt`.replace('.', ',');
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1000)}rb`;
  }
  return String(value);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

// Jam:menit saja (mis. "08:03") — dipakai untuk notifikasi buka/tutup shift.
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', { timeStyle: 'short' }).format(date);
}

// Format rapi "Hari, tanggal Bulan Tahun · pukul JJ.MM" (mis. "Rabu, 16
// September 2026 · pukul 14.35") — dipakai sebagai footer waktu kejadian di
// tiap notifikasi Telegram, supaya jelas kapan persis notifikasi itu terjadi
// tanpa perlu buka aplikasi.
// Semua pesan notifikasi ditulis sekali pakai tag gaya Telegram (mis.
// "<b>Transaksi Baru</b>"). WhatsApp tidak paham HTML — dia pakai gaya
// sendiri (*tebal*, _miring_) — jadi pesan yang sama dikonversi di sini
// sebelum dikirim ke provider WhatsApp, supaya isi pesan tidak perlu
// ditulis dua kali di tiap tempat notifikasi dipicu.
export function htmlToWhatsappText(message: string): string {
  return message
    .replace(/<b>(.*?)<\/b>/gi, '*$1*')
    .replace(/<strong>(.*?)<\/strong>/gi, '*$1*')
    .replace(/<i>(.*?)<\/i>/gi, '_$1_')
    .replace(/<em>(.*?)<\/em>/gi, '_$1_')
    .replace(/<[^>]+>/g, '');
}

export function formatNotificationTimestamp(date: Date = new Date()): string {
  const tanggal = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  const jam = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(':', '.');
  return `${tanggal} · pukul ${jam}`;
}
