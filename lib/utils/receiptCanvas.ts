import { formatRupiah, formatDateTime } from './format';

export interface ReceiptCanvasItem {
  name: string;
  quantity: number;
  unitPrice: number;
  variantLabel?: string;
  note?: string;
}

export interface ReceiptCanvasData {
  storeName?: string;
  items: ReceiptCanvasItem[];
  total: number;
  method: 'cash' | 'qris' | 'split' | 'belum_bayar';
  cashReceived?: number;
  change?: number;
  splitDetail?: { cash: number; qris: number; kasbon: number };
  customerName?: string;
  operatorName?: string;
  // ISO string. Default ke waktu sekarang kalau tidak diisi.
  createdAt?: string;
}

// Lebar kertas ala printer thermal 58mm (~384px di 203dpi) — ukuran yang
// familiar dipakai aplikasi kasir sejenis, dan cukup ringkas untuk dilihat
// sebagai foto di Telegram tanpa perlu di-zoom.
const CANVAS_WIDTH = 384;
const PADDING_X = 20;
const PADDING_Y = 20;
const CONTENT_WIDTH = CANVAS_WIDTH - PADDING_X * 2;
const DASHED_HEIGHT = 14;

const FONT_HEADER = 'bold 17px "Courier New", monospace';
const FONT_BODY = '13px "Courier New", monospace';
const FONT_BOLD = 'bold 14px "Courier New", monospace';
const FONT_SMALL = '11px "Courier New", monospace';

const LH_HEADER = 24;
const LH_BODY = 19;
const LH_SMALL = 16;

type Line =
  | { kind: 'gap'; height: number }
  | { kind: 'dashed' }
  | { kind: 'center'; text: string; font: string; height: number }
  | { kind: 'left'; text: string; font: string; height: number }
  | { kind: 'row'; left: string; right: string; font: string; height: number };

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

// Menggambar struk ke canvas yang diberikan (elemen <canvas> dari React
// ref) — ukuran canvas otomatis disesuaikan tingginya sesuai isi struk.
// Dipanggil ulang tiap kali data berubah (di ReceiptModal cukup sekali saat
// modal dibuka, karena data transaksi sudah final).
export function renderReceiptToCanvas(canvas: HTMLCanvasElement, data: ReceiptCanvasData): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Pass 1: pakai canvas yang sama untuk MENGUKUR teks (lebar sudah pasti,
  // tinggi belum penting di tahap ini) sambil menyusun daftar baris +
  // word-wrap untuk nama item/catatan yang kepanjangan.
  canvas.width = CANVAS_WIDTH;

  const lines: Line[] = [];

  function addWrappedLeft(ctx: CanvasRenderingContext2D, text: string, font: string, height: number) {
    ctx.font = font;
    for (const wrapped of wrapText(ctx, text, CONTENT_WIDTH)) {
      lines.push({ kind: 'left', text: wrapped, font, height });
    }
  }

  lines.push({ kind: 'center', text: data.storeName || 'Warkop Dua Tujuh', font: FONT_HEADER, height: LH_HEADER });
  lines.push({
    kind: 'center',
    text: formatDateTime(data.createdAt || new Date().toISOString()),
    font: FONT_SMALL,
    height: LH_SMALL,
  });
  lines.push({ kind: 'gap', height: 6 });
  lines.push({ kind: 'dashed' });

  if (data.customerName) addWrappedLeft(ctx, `Atas nama: ${data.customerName}`, FONT_BODY, LH_BODY);
  if (data.operatorName) addWrappedLeft(ctx, `Kasir: ${data.operatorName}`, FONT_BODY, LH_BODY);
  if (data.customerName || data.operatorName) lines.push({ kind: 'dashed' });

  for (const item of data.items) {
    const nameLine = `${item.name}${item.variantLabel ? ` (${item.variantLabel})` : ''}`;
    addWrappedLeft(ctx, nameLine, FONT_BODY, LH_BODY);
    if (item.note) addWrappedLeft(ctx, `  "${item.note}"`, FONT_SMALL, LH_SMALL);
    lines.push({
      kind: 'row',
      left: `  ${item.quantity} x ${formatRupiah(item.unitPrice)}`,
      right: formatRupiah(item.unitPrice * item.quantity),
      font: FONT_BODY,
      height: LH_BODY,
    });
  }

  lines.push({ kind: 'dashed' });
  lines.push({ kind: 'row', left: 'TOTAL', right: formatRupiah(data.total), font: FONT_BOLD, height: LH_HEADER });

  if (data.method === 'belum_bayar') {
    lines.push({ kind: 'left', text: 'Status: Belum Dibayar', font: FONT_BODY, height: LH_BODY });
  } else if (data.method === 'split' && data.splitDetail) {
    lines.push({ kind: 'row', left: 'Cash', right: formatRupiah(data.splitDetail.cash), font: FONT_BODY, height: LH_BODY });
    lines.push({ kind: 'row', left: 'QRIS', right: formatRupiah(data.splitDetail.qris), font: FONT_BODY, height: LH_BODY });
    if (data.splitDetail.kasbon > 0) {
      lines.push({
        kind: 'row',
        left: 'Kasbon',
        right: formatRupiah(data.splitDetail.kasbon),
        font: FONT_BODY,
        height: LH_BODY,
      });
    }
  } else {
    lines.push({
      kind: 'left',
      text: `Metode: ${data.method === 'cash' ? 'Cash' : 'QRIS'}`,
      font: FONT_BODY,
      height: LH_BODY,
    });
    if (data.method === 'cash' && data.change !== undefined) {
      lines.push({ kind: 'row', left: 'Kembalian', right: formatRupiah(data.change), font: FONT_BODY, height: LH_BODY });
    }
  }

  lines.push({ kind: 'dashed' });
  lines.push({ kind: 'gap', height: 4 });
  lines.push({
    kind: 'center',
    text: data.method === 'belum_bayar' ? 'Belum dibayar' : 'Terima kasih! \u2615',
    font: FONT_BODY,
    height: LH_BODY,
  });

  let totalHeight = PADDING_Y * 2;
  for (const line of lines) {
    totalHeight += line.kind === 'dashed' ? DASHED_HEIGHT : line.height;
  }

  // Pass 2: resize canvas ke tinggi final (ini otomatis membersihkan
  // canvas & mereset context, makanya style di bawah di-set ULANG) lalu
  // gambar tiap baris.
  canvas.height = Math.ceil(totalHeight);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#2A1810';
  ctx.textBaseline = 'middle';

  let y = PADDING_Y;
  for (const line of lines) {
    if (line.kind === 'dashed') {
      ctx.save();
      ctx.strokeStyle = '#B8ADA0';
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(PADDING_X, y + DASHED_HEIGHT / 2);
      ctx.lineTo(CANVAS_WIDTH - PADDING_X, y + DASHED_HEIGHT / 2);
      ctx.stroke();
      ctx.restore();
      y += DASHED_HEIGHT;
      continue;
    }
    if (line.kind === 'gap') {
      y += line.height;
      continue;
    }
    ctx.font = line.font;
    ctx.fillStyle = '#2A1810';
    if (line.kind === 'center') {
      ctx.textAlign = 'center';
      ctx.fillText(line.text, CANVAS_WIDTH / 2, y + line.height / 2);
    } else if (line.kind === 'left') {
      ctx.textAlign = 'left';
      ctx.fillText(line.text, PADDING_X, y + line.height / 2);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(line.left, PADDING_X, y + line.height / 2);
      ctx.textAlign = 'right';
      ctx.fillText(line.right, CANVAS_WIDTH - PADDING_X, y + line.height / 2);
    }
    y += line.height;
  }
}

// canvas.toBlob berbasis callback — dibungkus Promise supaya gampang
// dipakai dengan async/await di ReceiptModal.
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
