/**
 * Helper generik untuk mengekspor data tabular ke file CSV dan langsung
 * memicu unduhan di browser. Dipakai oleh halaman Laporan, tapi ditulis
 * generik supaya bisa dipakai halaman lain juga.
 */

function escapeCsvValue(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(','));
  // Tambahkan BOM supaya karakter dibaca benar saat dibuka di Excel.
  const csvContent = '\uFEFF' + lines.join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
