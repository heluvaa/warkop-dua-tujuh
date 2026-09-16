// Satu opsi ukuran atau level gula/es — priceDelta ditambahkan ke harga
// dasar menu kalau opsi ini dipilih (boleh 0, mis. ukuran "Regular" yang
// harganya sama dengan harga dasar).
export interface MenuVariantOption {
  id: string;
  name: string;
  priceDelta: number;
}

// Satu opsi topping — beda dari MenuVariantOption karena topping bisa
// dipilih LEBIH DARI SATU sekaligus (bukan pilih salah satu seperti
// ukuran/level gula-es), jadi field harganya dinamai `price` (harga
// tambahan topping itu sendiri) supaya jelas bukan delta dari sesuatu.
export interface MenuToppingOption {
  id: string;
  name: string;
  price: number;
}

// Konfigurasi varian menu — semuanya opsional. Menu tanpa satupun field ini
// terisi berarti tidak punya varian sama sekali, dan alur tambah-ke-
// keranjang di Kasir berjalan persis seperti sebelum fitur ini ada (klik
// langsung masuk keranjang, tanpa dialog pilihan).
export interface MenuVariantConfig {
  sizes?: MenuVariantOption[];
  sugarIceLevels?: MenuVariantOption[];
  toppings?: MenuToppingOption[];
}

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
  // Pilihan varian (ukuran, level gula/es, topping) yang bisa dipilih kasir
  // saat menambahkan menu ini ke keranjang — lihat MenuVariantConfig.
  // Opsional sepenuhnya: menu lama tanpa field ini tetap valid.
  variants?: MenuVariantConfig;
  createdAt: string;
}

// Snapshot pilihan varian pada SATU baris keranjang/transaksi — beda dari
// MenuVariantConfig di atas (yang cuma daftar pilihan yang TERSEDIA di
// menu). Disimpan sebagai nama+harga langsung (bukan referensi id ke
// MenuVariantConfig) supaya kalau varian menu diedit/dihapus belakangan,
// baris yang sudah ada di keranjang atau riwayat transaksi tidak ikut
// berubah.
export interface SelectedVariant {
  size?: { name: string; priceDelta: number };
  sugarIce?: { name: string; priceDelta: number };
  toppings?: { name: string; price: number }[];
}

export type PaymentMethod = 'cash' | 'qris' | 'split';

// Rincian alokasi nominal saat pembayaran dipecah jadi beberapa metode dalam
// satu pesanan — kasus umum di warkop: "separo cash, separo QRIS" atau
// "separo dulu ya, sisanya besok" (sisanya jadi kasbon). cash+qris+kasbon
// HARUS sama dengan total pesanan. Bagian `kasbon` di sini BUKAN pemasukan
// (belum dibayar), makanya tidak ikut dihitung ke Transaction.total — lihat
// catatan di field `total` pada Transaction di bawah.
export interface SplitPaymentDetail {
  cash: number;
  qris: number;
  kasbon: number;
}

export interface CartItem {
  // Id unik untuk BARIS keranjang ini — beda dari menuItem.id supaya menu
  // yang sama dengan pilihan varian berbeda (mis. Kopi Susu Regular vs Kopi
  // Susu Large) jadi baris terpisah di keranjang, bukan malah tergabung
  // jadi satu qty yang salah harganya. Lihat lib/utils/variant.ts.
  id: string;
  menuItem: MenuItem;
  quantity: number;
  note?: string;
  // Pilihan varian untuk baris ini (kosong berarti menu ini ditambahkan
  // tanpa memilih varian apapun — baik karena menunya memang tidak punya
  // varian, maupun kasir membiarkan default).
  variant?: SelectedVariant;
  // Harga satuan yang SUDAH termasuk tambahan ukuran + level gula/es +
  // topping (belum dikali quantity). Dihitung sekali saat baris ini dibuat
  // supaya konsisten dipakai di Cart, PaymentModal, dan ReceiptModal tanpa
  // masing-masing menghitung ulang dari menuItem.price + variant.
  unitPrice: number;
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
  // Label ringkas varian yang dipilih untuk baris ini, mis. "Large · Less
  // Sugar · Boba + Espresso Shot" — sudah dalam bentuk teks jadi (bukan
  // struktur SelectedVariant) supaya gampang ditampilkan langsung di
  // struk/Laporan/Kasbon tanpa perlu format ulang. Kosong berarti tidak ada
  // varian yang dipilih untuk baris ini.
  variantLabel?: string;
}

export type TransactionSource = 'pos' | 'kasbon_lunas' | 'pending_paid';

// Pilihan checkout di Kasir: dua metode bayar biasa, ditambah 'belum_bayar'
// untuk pesanan yang disimpan dulu (belum dibayar saat itu juga). Bukan
// bagian dari PaymentMethod karena 'belum_bayar' tidak pernah tersimpan
// sebagai Transaction — lihat PendingOrder di bawah.
export type CheckoutMethod = PaymentMethod | 'belum_bayar';

export interface Transaction {
  id: string;
  items: TransactionLineItem[];
  // Untuk paymentMethod 'split': total DI SINI cuma bagian yang sudah benar-
  // benar diterima sekarang (cash+qris dari splitDetail), BUKAN nilai penuh
  // pesanan — supaya konsisten dengan pola pencatatan pemasukan di seluruh
  // app ini (kasbon baru dianggap pemasukan saat lunas, lihat kasbonService).
  // Sisa yang belum dibayar tercatat terpisah sebagai KasbonEntry (lihat
  // linkedKasbonId).
  total: number;
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  change?: number;
  // Rincian alokasi nominal — hanya terisi kalau paymentMethod === 'split'.
  splitDetail?: SplitPaymentDetail;
  // ID KasbonEntry yang otomatis dibuat bersamaan dengan transaksi split ini
  // untuk mencatat sisa yang belum dibayar (splitDetail.kasbon > 0). Dipakai
  // untuk menelusuri balik dari riwayat transaksi ke utangnya di Buku Kasbon.
  linkedKasbonId?: string;
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

// Satu kali pembayaran cicilan kasbon — kasbon bisa dilunasi bertahap
// (mis. bayar Rp20rb dulu, sisanya nyusul), bukan cuma lunas total sekaligus.
// Tiap pembayaran (baik cicilan sebagian maupun pelunasan penuh lewat
// lunasiKasbon) dicatat sebagai satu entri di sini DAN sebagai satu
// Transaction pemasukan tersendiri (source 'kasbon_lunas') — lihat
// bayarCicilanKasbon di lib/storage/kasbonService.ts.
export interface KasbonPayment {
  id: string;
  amount: number;
  paidAt: string;
  // ID Transaction pemasukan yang dibuat bersamaan dengan pembayaran ini —
  // dipakai untuk membatalkan (void) transaksi terkait kalau kasbon ini
  // nanti dihapus dari Buku Kasbon.
  transactionId: string;
  operatorName?: string;
}

export interface KasbonEntry {
  id: string;
  customerName: string;
  items: { name: string; price: number; quantity: number; variantLabel?: string }[];
  total: number;
  status: KasbonStatus;
  createdAt: string;
  paidAt?: string;
  // Riwayat cicilan/pembayaran kasbon ini — kosong/undefined berarti belum
  // ada pembayaran sama sekali. Jumlahkan `amount` di sini untuk tahu total
  // yang sudah dibayar (lihat getKasbonAmountPaid). Kasbon dianggap lunas
  // (status berubah otomatis) begitu total pembayaran >= `total`.
  payments?: KasbonPayment[];
  // ID transaksi pemasukan dari pembayaran TERAKHIR (cicilan atau pelunasan
  // penuh) — dipertahankan untuk kompatibilitas dengan kasbon lama (sebelum
  // fitur cicilan ada) yang cuma kenal satu transactionId untuk satu
  // pelunasan penuh sekaligus.
  transactionId?: string;
  // ID transaksi POS yang dibuat BERSAMAAN dengan kasbon ini lewat split
  // payment (mis. pelanggan bayar sebagian cash, sisanya kasbon langsung
  // saat checkout) — beda dari `transactionId` di atas yang baru terisi
  // belakangan saat kasbon ini dilunasi. Kosong berarti kasbon ini dibuat
  // dengan cara biasa (dari halaman Belum Bayar, tanpa split).
  originTransactionId?: string;
}

// Pesanan yang sudah diproses di Kasir (item & stok sudah terpotong) tapi
// belum dibayar saat itu juga — dipilih lewat opsi "Belum Bayar" di
// PaymentModal. Bukan Transaction (belum tentu jadi pemasukan) dan bukan
// KasbonEntry (belum tentu jadi utang) — statusnya baru pasti setelah
// ditandai "Sudah Dibayar" (-> Transaction) atau "Jadikan Kasbon" (->
// KasbonEntry) dari halaman Belum Bayar.
export interface PendingOrder {
  id: string;
  items: TransactionLineItem[];
  total: number;
  customerName?: string;
  operatorName?: string;
  createdAt: string;
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

// Peran akun kasir — menentukan menu/aksi apa saja yang boleh diakses.
// 'kasir' = akses operasional harian saja (jualan, catat pengeluaran, dst),
// tanpa lihat Laba Bersih/Margin Produk maupun aksi hapus data besar-besaran
// (Clear Data laporan, kelola akun kasir, pulihkan backup). 'pemilik' =
// akses penuh tanpa batasan di atas.
export type OperatorRole = 'kasir' | 'pemilik';

// Akun kasir sederhana — hanya untuk mencatat siapa yang jaga shift,
// bukan sistem otentikasi sungguhan (PIN disimpan polos di localStorage).
export interface Operator {
  id: string;
  name: string;
  pin: string;
  // Opsional supaya akun yang dibuat SEBELUM fitur role ada tetap valid
  // tanpa migrasi data — lihat getOperatorRole di operatorService.ts untuk
  // aturan fallback-nya (akun lama dianggap 'pemilik' supaya tidak
  // mendadak kehilangan akses yang sebelumnya mereka punya).
  role?: OperatorRole;
  createdAt: string;
}

// Satu baris riwayat login/logout kasir — murni catatan (audit trail)
// "siapa pegang HP kapan", terpisah dari ACTIVE_OPERATOR (status login
// SAAT INI, per-device) dan dari ShiftEntry (laci kas). Log ini data
// warung (disimpan lewat getItem/setItem, ikut Supabase kalau ada) supaya
// pemilik bisa lihat riwayatnya dari device manapun.
export type LoginLogAction = 'login' | 'logout';

export interface LoginLogEntry {
  id: string;
  operatorId: string;
  operatorName: string;
  action: LoginLogAction;
  at: string;
}

export type ShiftStatus = 'open' | 'closed';

// Satu sesi shift laci kas — beda dari "sesi login kasir" di operatorService
// (yang cuma penanda siapa yang pegang HP/device, per-device). Shift di sini
// mewakili LACI KAS itu sendiri: dibuka sekali dengan modal awal, dipakai
// bersama meski kasirnya berganti (mis. pagi si A, siang ganti si B tanpa
// tutup-buka shift), lalu ditutup sekali di akhir hari dengan menghitung
// uang fisik dan dibandingkan dengan catatan sistem.
export interface ShiftEntry {
  id: string;
  // Kasir yang MEMBUKA shift ini (bukan berarti satu-satunya yang jaga
  // sepanjang shift — lihat komentar di atas).
  operatorId: string;
  operatorName: string;
  modalAwal: number;
  openedAt: string;
  status: ShiftStatus;
  // Kasir yang MENUTUP shift ini — dicatat terpisah dari operatorName di
  // atas karena bisa jadi orang yang berbeda dari yang membuka.
  closedByOperatorId?: string;
  closedByOperatorName?: string;
  closedAt?: string;
  // Rincian berikut hanya terisi setelah shift ditutup — snapshot
  // perhitungan sistem dari transaksi & pengeluaran yang terjadi selama
  // openedAt..closedAt, supaya laporan shift lama tidak berubah kalau ada
  // data baru ditambahkan/diedit belakangan.
  cashSalesTotal?: number;
  qrisSalesTotal?: number;
  pengeluaranTotal?: number;
  // Uang kas yang SEHARUSNYA ada di laci menurut catatan sistem:
  // modalAwal + cashSalesTotal - pengeluaranTotal.
  systemCash?: number;
  // Uang kas yang benar-benar dihitung fisik oleh kasir saat tutup shift.
  physicalCash?: number;
  // physicalCash - systemCash. Positif = lebih (surplus), negatif = kurang
  // (defisit), nol = pas.
  selisih?: number;
  // Catatan opsional dari kasir soal penyebab selisih (kalau ada).
  note?: string;
}
