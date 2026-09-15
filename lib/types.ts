export interface MenuItem {
  id: string;
  name: string;
  price: number;
  // Harga Pokok Penjualan (modal) per satu porsi/unit — dipakai untuk
  // menghitung margin/untung bersih per menu. Opsional & default 0 supaya
  // menu lama (dibuat sebelum fitur ini ada) tetap valid tanpa migrasi data.
  hpp?: number;
  category: string;
  stock: number;
  imageUrl?: string;
  isFavorite?: boolean;
  createdAt: string;
}

export type PaymentMethod = 'cash' | 'qris';

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  note?: string;
}

export interface TransactionLineItem {
  menuItemId: string;
  name: string;
  price: number;
  // Snapshot HPP menu pada saat transaksi terjadi (bukan referensi ke HPP
  // menu saat ini) — supaya laporan margin masa lalu tidak berubah kalau
  // HPP menu diedit belakangan. Kosong/undefined berarti HPP tidak
  // diketahui (mis. item dari kasbon lama yang tidak tertaut ke menu asli).
  hpp?: number;
  quantity: number;
  note?: string;
}

export type TransactionSource = 'pos' | 'kasbon_lunas';

export interface Transaction {
  id: string;
  items: TransactionLineItem[];
  total: number;
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  change?: number;
  createdAt: string;
  source: TransactionSource;
  voided?: boolean;
  voidedAt?: string;
  // Alasan pembatalan — dipilih kasir saat void, untuk audit kalau nanti ada
  // kejanggalan di laporan (misal banyak void dari satu kasir/menu tertentu).
  voidReason?: string;
  operatorName?: string;
  // Nama pelanggan — opsional, diisi kasir kalau pesanan ini atas nama
  // seseorang (mis. dipanggil saat pesanan siap, atau pre-order titip nama).
  customerName?: string;
}

export type KasbonStatus = 'belum_lunas' | 'lunas';

export interface KasbonEntry {
  id: string;
  customerName: string;
  items: { name: string; price: number; quantity: number }[];
  total: number;
  status: KasbonStatus;
  createdAt: string;
  paidAt?: string;
  // ID transaksi pemasukan yang otomatis dibuat saat kasbon ini dilunasi
  // (lihat lunasiKasbon) — dipakai untuk ikut memperbarui/membatalkan
  // transaksi itu kalau kasbon yang sudah lunas diedit/dihapus, supaya
  // Laporan tetap sinkron dengan Buku Kasbon.
  transactionId?: string;
}

export interface PengeluaranEntry {
  id: string;
  name: string;
  amount: number;
  createdAt: string;
  operatorName?: string;
}

// Satu baris barang dalam satu sesi belanja stok, mis. "Kopi Bubuk Kapal Api"
// 5 renceng masuk sebagai 60 sachet ke stok, dibeli seharga Rp90.000.
export interface StockPurchaseLineItem {
  menuItemId: string;
  name: string;
  // Jumlah yang MASUK KE STOK (satuan jual, mis. per sachet/batang/porsi) —
  // boleh beda dari jumlah kemasan fisik yang dibeli (mis. 1 renceng = 30 sachet).
  quantity: number;
  // Total harga beli untuk seluruh baris ini (bukan per satuan) — dicocokkan
  // dengan nominal di nota/struk toko grosir supaya gampang diinput.
  totalCost: number;
}

// Riwayat belanja stok (restock) — mencatat rincian per item supaya bisa
// jadi dasar audit & perhitungan HPP rata-rata tertimbang. Nominal totalnya
// juga tercatat sebagai satu PengeluaranEntry lewat pengeluaranId, supaya
// tetap terhitung di Laba Bersih tanpa duplikasi logika laporan.
export interface StockPurchaseEntry {
  id: string;
  items: StockPurchaseLineItem[];
  total: number;
  // Apakah HPP menu ikut diperbarui otomatis (rata-rata tertimbang) dari
  // pembelian ini, atau cuma stoknya saja yang ditambah.
  updateHpp: boolean;
  createdAt: string;
  operatorName?: string;
  pengeluaranId?: string;
}

// Akun kasir sederhana — hanya untuk mencatat siapa yang jaga shift,
// bukan sistem otentikasi sungguhan (PIN disimpan polos di localStorage).
export interface Operator {
  id: string;
  name: string;
  pin: string;
  createdAt: string;
}
