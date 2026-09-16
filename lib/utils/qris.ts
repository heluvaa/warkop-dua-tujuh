// Utilitas untuk kode QRIS statis milik warkop (dari kertas cetakan resmi
// penyelenggara) — dipakai untuk memvalidasi kode yang disimpan pemilik di
// Pengaturan, lalu "menyuntikkan" nominal transaksi ke kode itu supaya jadi
// kode QRIS DINAMIS yang nominalnya otomatis terisi di aplikasi pembayaran
// pelanggan (tidak perlu kasir ketik manual di mesin/EDC QRIS terpisah).
//
// Format kode QRIS mengikuti standar EMVCo QR Code for Payment Systems:
// rangkaian field TLV (Tag 2 digit + Length 2 digit + Value), diakhiri
// field CRC (tag 63) yang berisi checksum seluruh payload sebelumnya.
// Referensi tag yang dipakai di sini:
//   00 = Payload Format Indicator
//   01 = Point of Initiation Method ("11" statis, "12" dinamis)
//   53 = Transaction Currency
//   54 = Transaction Amount (baru muncul di kode dinamis)
//   58 = Country Code
//   59 = Merchant Name
//   60 = Merchant City
//   63 = CRC (checksum, selalu field TERAKHIR)

export interface EmvField {
  tag: string;
  value: string;
}

// Memecah payload QRIS mentah jadi daftar field TLV berurutan. Melempar
// error kalau formatnya tidak sesuai (tag/length bukan 2 digit, atau
// panjang value tidak cocok dengan sisa string) — dipakai untuk menolak
// teks yang jelas bukan kode QRIS yang valid.
export function parseEmvFields(raw: string): EmvField[] {
  const fields: EmvField[] = [];
  let i = 0;
  while (i < raw.length) {
    if (i + 4 > raw.length) {
      throw new Error('Format kode QRIS tidak valid (terpotong di tengah field).');
    }
    const tag = raw.slice(i, i + 2);
    const lenStr = raw.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lenStr)) {
      throw new Error('Format kode QRIS tidak valid (tag/panjang field bukan angka).');
    }
    const len = Number(lenStr);
    const start = i + 4;
    const end = start + len;
    if (end > raw.length) {
      throw new Error('Format kode QRIS tidak valid (panjang field tidak cocok dengan isinya).');
    }
    fields.push({ tag, value: raw.slice(start, end) });
    i = end;
  }
  return fields;
}

// Menggabungkan kembali daftar field TLV jadi satu string payload.
function serializeEmvFields(fields: EmvField[]): string {
  return fields.map((f) => `${f.tag}${String(f.value.length).padStart(2, '0')}${f.value}`).join('');
}

// CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) — algoritma checksum yang
// dipakai standar EMVCo QR, termasuk QRIS. Hasilnya 4 digit heksadesimal
// huruf besar, sama seperti 4 karakter terakhir kode QRIS asli.
export function crc16ccitt(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface QrisMerchantInfo {
  merchantName?: string;
  merchantCity?: string;
}

export type QrisValidationResult =
  | { valid: true; info: QrisMerchantInfo }
  | { valid: false; error: string };

// Membersihkan teks hasil scan/paste dari baris baru/tab nyasar (mis. kalau
// tersalin dari aplikasi chat yang membungkus teks panjang jadi beberapa
// baris) dan spasi di awal/akhir. SENGAJA tidak membuang spasi di
// TENGAH teks — spasi tunggal di tengah adalah isi VALUE yang sah (mis.
// nama merchant "Toko Kopi" atau kota "JAKARTA PUSAT"), dan ikut dihitung
// di panjang field TLV-nya. Membuang spasi itu akan merusak keselarasan
// panjang field dengan isinya.
export function cleanRawCode(rawInput: string): string {
  return rawInput.replace(/[\r\n\t]+/g, '').trim();
}

// Validasi kode QRIS statis: cek checksum CRC-nya cocok, lalu ambil nama &
// kota merchant untuk ditampilkan ke pemilik sebagai konfirmasi visual
// bahwa kode yang disimpan benar sebelum dipakai transaksi sungguhan.
export function validateStaticQris(rawInput: string): QrisValidationResult {
  const raw = cleanRawCode(rawInput);
  if (raw.length < 20) {
    return { valid: false, error: 'Teks terlalu pendek untuk kode QRIS. Pastikan seluruh kode tersalin.' };
  }
  if (!raw.startsWith('000201') && !raw.startsWith('000202')) {
    return { valid: false, error: 'Teks ini tidak diawali format kode QRIS yang dikenali ("000201...").' };
  }
  const body = raw.slice(0, -4);
  const crcInPayload = raw.slice(-4).toUpperCase();
  if (crc16ccitt(body) !== crcInPayload) {
    return { valid: false, error: 'Checksum kode QRIS tidak cocok — kemungkinan ada karakter yang salah/hilang saat disalin.' };
  }
  let fields: EmvField[];
  try {
    fields = parseEmvFields(raw);
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Format kode QRIS tidak valid.' };
  }
  const countryCode = fields.find((f) => f.tag === '58')?.value;
  if (countryCode && countryCode !== 'ID') {
    return { valid: false, error: 'Kode ini bukan QRIS Indonesia (kode negara bukan ID).' };
  }
  const merchantName = fields.find((f) => f.tag === '59')?.value;
  const merchantCity = fields.find((f) => f.tag === '60')?.value;
  return { valid: true, info: { merchantName, merchantCity } };
}

// Menyuntikkan nominal transaksi ke kode QRIS statis, menghasilkan payload
// QRIS DINAMIS baru: Point of Initiation Method diubah ke "12" (dinamis),
// field nominal (54) disisipkan/diganti, lalu CRC dihitung ulang dari nol
// (CRC lama tidak valid lagi karena isinya berubah). Melempar error kalau
// rawInput bukan kode QRIS yang valid — panggil validateStaticQris dulu
// sebelum menyimpan kode supaya ini tidak pernah dipanggil dengan kode
// rusak saat transaksi sungguhan berlangsung.
export function buildDynamicQrisPayload(rawInput: string, amount: number): string {
  const raw = cleanRawCode(rawInput);
  const fields = parseEmvFields(raw).filter((f) => f.tag !== '63');

  const poiIdx = fields.findIndex((f) => f.tag === '01');
  if (poiIdx >= 0) {
    fields[poiIdx] = { tag: '01', value: '12' };
  } else {
    const formatIdx = fields.findIndex((f) => f.tag === '00');
    fields.splice(formatIdx + 1, 0, { tag: '01', value: '12' });
  }

  const withoutAmount = fields.filter((f) => f.tag !== '54');
  const amountValue = String(Math.max(0, Math.round(amount)));
  const currencyIdx = withoutAmount.findIndex((f) => f.tag === '53');
  const insertAt = currencyIdx >= 0 ? currencyIdx + 1 : withoutAmount.length;
  withoutAmount.splice(insertAt, 0, { tag: '54', value: amountValue });

  const bodyWithCrcPlaceholder = `${serializeEmvFields(withoutAmount)}6304`;
  return bodyWithCrcPlaceholder + crc16ccitt(bodyWithCrcPlaceholder);
}

// Deteksi dukungan browser untuk membaca kode QR langsung dari gambar
// (dipakai saat pemilik upload foto/screenshot kode QRIS, supaya tidak
// perlu salin teks manual). Belum didukung semua browser — kalau tidak
// ada, UI Pengaturan akan minta pemilik menyalin teks kodenya secara
// manual sebagai jalan alternatif.
export function isBarcodeDetectionSupported(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

// Membaca kode QR dari file gambar yang diunggah memakai BarcodeDetector
// bawaan browser (tanpa perlu library decoding QR eksternal).
export async function decodeQrisFromImageFile(file: File): Promise<string> {
  if (!isBarcodeDetectionSupported()) {
    throw new Error(
      'Browser ini belum bisa membaca kode QR dari gambar secara otomatis. Salin teks kode QRIS secara manual di bawah.'
    );
  }
  const DetectorCtor = window.BarcodeDetector as NonNullable<typeof window.BarcodeDetector>;
  const detector = new DetectorCtor({ formats: ['qr_code'] });
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Gagal membuka file gambar ini. Pastikan filenya berupa foto/screenshot yang valid.');
  }
  const results = await detector.detect(bitmap);
  if (results.length === 0) {
    throw new Error('Tidak ada kode QR yang terbaca dari gambar ini. Coba foto yang lebih jelas & tidak buram.');
  }
  return results[0].rawValue;
}

// BarcodeDetector belum ada di lib.dom.d.ts versi TypeScript proyek ini —
// deklarasi minimal supaya kode di atas type-check tanpa perlu @ts-ignore.
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => {
      detect: (source: ImageBitmap) => Promise<{ rawValue: string }[]>;
    };
  }
}
