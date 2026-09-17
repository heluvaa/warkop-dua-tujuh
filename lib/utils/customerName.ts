// Menghasilkan nama otomatis "Pelanggan N" saat kasir tidak mengisi nama
// pelanggan — dipakai baik untuk transaksi langsung di Kasir maupun pesanan
// di halaman Belum Bayar, supaya pelanggan tanpa nama tetap gampang
// dibedakan satu sama lain di riwayat/daftar. N dihitung dari nomor
// "Pelanggan N" terbesar yang ada di daftar nama yang diberikan pemanggil
// (lihat masing-masing pemanggil untuk cakupannya — mis. transaksi hari ini
// saja, atau pesanan Belum Bayar yang sedang aktif saja) — jadi nomor kecil
// wajar terpakai ulang di hari/daftar berikutnya, bukan penghitung global
// yang terus naik selamanya.
export function nextAutoCustomerName(existingNames: (string | undefined)[]): string {
  const pattern = /^Pelanggan (\d+)$/;
  let max = 0;
  for (const name of existingNames) {
    const match = name?.match(pattern);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `Pelanggan ${max + 1}`;
}
