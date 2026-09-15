/**
 * Helper tanggal lokal. Dipakai supaya perbandingan "transaksi tanggal X"
 * konsisten di semua service (menghindari pergeseran zona waktu yang bisa
 * terjadi kalau pakai toISOString().slice(0, 10), yang mengonversi ke UTC).
 */

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayDateKey(): string {
  return toDateKey(new Date());
}

// Kunci bulan berformat 'YYYY-MM' (sesuai value dari <input type="month">).
// Dipakai untuk rekap bulanan di halaman Laporan.
export function toMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function currentMonthKey(): string {
  return toMonthKey(new Date());
}

// Daftar N bulan terakhir (termasuk bulan ini), format 'YYYY-MM', urut dari
// yang terbaru ke terlama. Dipakai untuk opsi pemilih bulan di halaman
// Laporan — menghindari <input type="month"> bawaan browser yang tampilannya
// tidak konsisten (teks bisa terpotong) di berbagai perangkat.
export function lastMonthKeys(count: number): string[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return toMonthKey(d);
  });
}

// Jumlah hari penuh yang sudah berlalu sejak tanggal `iso` hingga sekarang.
// Dipakai untuk menandai kasbon yang sudah lama belum lunas ("jatuh tempo").
export function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
