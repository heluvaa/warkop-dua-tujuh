// Ganti dengan Place ID asli Warkop Dua Tujuh di Google Business Profile,
// atau set NEXT_PUBLIC_GOOGLE_REVIEW_URL di file .env.local.
export const GOOGLE_REVIEW_URL =
  process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL ||
  'https://search.google.com/local/writereview?placeid=GANTI_DENGAN_PLACE_ID_ANDA';

export const LOW_STOCK_THRESHOLD = 5;

// Kasbon yang belum lunas dan sudah tercatat lebih dari sekian hari akan
// ditandai "jatuh tempo" di halaman Kasbon & badge di Sidebar.
export const KASBON_OVERDUE_DAYS = 7;

// Pengeluaran dengan nominal >= ini akan memicu notifikasi Telegram
// tersendiri (supaya pemilik warung tahu ada pengeluaran besar meski
// sedang tidak di tempat), terpisah dari rekap harian biasa.
export const EXPENSE_NOTIFY_THRESHOLD = 50000;

// Kalau sudah sekian hari sejak backup terakhir (atau belum pernah backup
// sama sekali), tampilkan pengingat di halaman Pengaturan & badge di Sidebar.
export const BACKUP_REMINDER_DAYS = 3;
