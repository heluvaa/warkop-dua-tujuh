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
