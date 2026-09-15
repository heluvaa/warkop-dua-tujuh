'use client';

import { useEffect, useState } from 'react';
import { Download, Trash2, Send, TrendingUp, TrendingDown, Wallet, Loader2, CalendarDays, Flame, Ban, Search, X, LineChart, Users, Clock, CalendarRange, PiggyBank, Receipt, AlertTriangle } from 'lucide-react';
import type { Transaction, PengeluaranEntry, KasbonEntry } from '@/lib/types';
import { getTransactionsByDate, clearTransactionsByDate, voidTransaction, getDailyTotals, getTransactionsByMonth } from '@/lib/storage/transactionService';
import { getPengeluaranByDate, clearPengeluaranByDate, getPengeluaranByMonth } from '@/lib/storage/pengeluaranService';
import { getAllKasbon } from '@/lib/storage/kasbonService';
import { KASBON_OVERDUE_DAYS } from '@/lib/constants';
import { incrementStock } from '@/lib/storage/menuService';
import { formatRupiah, formatDateTime } from '@/lib/utils/format';
import { downloadCsv } from '@/lib/utils/exportCsv';
import { todayDateKey, daysSince, currentMonthKey, toMonthKey } from '@/lib/utils/date';
import SalesTrendChart, { type TrendBucket } from '@/components/laporan/SalesTrendChart';
import MonthPicker from '@/components/laporan/MonthPicker';

type SendState = 'idle' | 'sending' | 'success' | 'error';
type TrendRange = 'week' | 'month';

// Pilihan alasan void yang paling sering terjadi di warkop — dibuat sebagai
// tombol pilih cepat supaya kasir tidak perlu mengetik tiap kali. "Lainnya"
// membuka input teks bebas untuk kasus yang tidak tercakup daftar ini.
const VOID_REASONS = ['Salah input pesanan', 'Pelanggan batal', 'Salah kasir/bayar dobel', 'Lainnya'];

export default function LaporanPage() {
  const [selectedDate, setSelectedDate] = useState(todayDateKey());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pengeluaran, setPengeluaran] = useState<PengeluaranEntry[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [sendState, setSendState] = useState<SendState>('idle');
  const [sendError, setSendError] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<Transaction | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [voidReasonChoice, setVoidReasonChoice] = useState<string | null>(null);
  const [voidReasonCustom, setVoidReasonCustom] = useState('');
  const [txQuery, setTxQuery] = useState('');
  const [operatorFilter, setOperatorFilter] = useState('semua');
  const [trendRange, setTrendRange] = useState<TrendRange>('week');
  const [trendBuckets, setTrendBuckets] = useState<TrendBucket[]>([]);
  const [kasbonAll, setKasbonAll] = useState<KasbonEntry[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [monthTransactions, setMonthTransactions] = useState<Transaction[]>([]);
  const [monthPengeluaran, setMonthPengeluaran] = useState<PengeluaranEntry[]>([]);

  const isToday = selectedDate === todayDateKey();

  async function refresh(dateKey: string) {
    setTransactions(await getTransactionsByDate(dateKey));
    setPengeluaran(await getPengeluaranByDate(dateKey));
  }

  useEffect(() => {
    refresh(selectedDate);
    setSendState('idle');
    setSendError(null);
    setTxQuery('');
    setOperatorFilter('semua');
  }, [selectedDate]);

  useEffect(() => {
    (async () => {
      setKasbonAll(await getAllKasbon());
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setMonthTransactions(await getTransactionsByMonth(selectedMonth));
      setMonthPengeluaran(await getPengeluaranByMonth(selectedMonth));
    })();
  }, [selectedMonth]);

  useEffect(() => {
    (async () => {
      if (trendRange === 'week') {
        const daily = await getDailyTotals(7);
        setTrendBuckets(
          daily.map((d) => ({
            label: new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(new Date(`${d.dateKey}T00:00:00`)),
            total: d.total,
          }))
        );
      } else {
        const daily = await getDailyTotals(30);
        const bucketSize = 6; // 5 kelompok x 6 hari = 30 hari
        const groups: typeof daily[] = [];
        for (let i = 0; i < daily.length; i += bucketSize) {
          groups.push(daily.slice(i, i + bucketSize));
        }
        setTrendBuckets(
          groups.map((g) => {
            const total = g.reduce((sum, d) => sum + d.total, 0);
            const start = new Date(`${g[0].dateKey}T00:00:00`);
            const end = new Date(`${g[g.length - 1].dateKey}T00:00:00`);
            const fmt = (d: Date) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(d);
            return { label: `${fmt(start)}–${fmt(end)}`, total };
          })
        );
      }
    })();
  }, [trendRange]);

  const sorted = [...transactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const sortedPengeluaran = [...pengeluaran].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Cari transaksi berdasarkan nama menu di dalamnya, nama pelanggan (kalau
  // dicatat), atau berdasarkan nominal total (cocok sebagian, misal "15000"
  // atau "15.000").
  const txQ = txQuery.trim().toLowerCase();
  const txQDigits = txQuery.replace(/\D/g, '');
  const filteredSorted = sorted.filter((t) => {
    if (operatorFilter !== 'semua' && (t.operatorName ?? 'Tanpa Kasir') !== operatorFilter) return false;
    if (!txQ) return true;
    const nameMatch = t.items.some((i) => i.name.toLowerCase().includes(txQ));
    const customerMatch = t.customerName?.toLowerCase().includes(txQ) ?? false;
    const amountMatch = txQDigits.length > 0 && t.total.toString().includes(txQDigits);
    return nameMatch || customerMatch || amountMatch;
  });

  // Daftar kasir yang muncul pada tanggal terpilih, untuk dropdown filter.
  const operatorNames = Array.from(
    new Set(sorted.map((t) => t.operatorName ?? 'Tanpa Kasir'))
  ).sort((a, b) => a.localeCompare(b));

  // Transaksi yang di-void dikecualikan dari semua perhitungan total &
  // menu terlaris, tapi tetap tampil di tabel riwayat (dicoret) untuk audit.
  const activeTransactions = transactions.filter((t) => !t.voided);

  const totalCash = activeTransactions
    .filter((t) => t.paymentMethod === 'cash')
    .reduce((sum, t) => sum + t.total, 0);
  const totalQris = activeTransactions
    .filter((t) => t.paymentMethod === 'qris')
    .reduce((sum, t) => sum + t.total, 0);
  const totalPemasukan = totalCash + totalQris;
  const totalPengeluaran = pengeluaran.reduce((sum, e) => sum + e.amount, 0);
  const labaBersih = totalPemasukan - totalPengeluaran;

  // Agregasi menu terlaris berdasarkan jumlah item terjual pada tanggal
  // terpilih (termasuk transaksi hasil kasbon lunas, tidak termasuk void).
  // Sekalian akumulasi modal (HPP x qty) per menu untuk kalkulasi margin —
  // hppUnknown ditandai kalau ada baris item menu itu yang HPP-nya tidak
  // tercatat (mis. dari kasbon lama), supaya margin-nya tidak ditampilkan
  // seolah pasti akurat.
  const menuTerlaris = (() => {
    const map = new Map<
      string,
      { name: string; qty: number; omzet: number; modal: number; hppUnknown: boolean }
    >();
    for (const t of activeTransactions) {
      for (const item of t.items) {
        const key = item.name;
        const existing = map.get(key) ?? {
          name: item.name,
          qty: 0,
          omzet: 0,
          modal: 0,
          hppUnknown: false,
        };
        existing.qty += item.quantity;
        existing.omzet += item.price * item.quantity;
        if (item.hpp === undefined) {
          existing.hppUnknown = true;
        } else {
          existing.modal += item.hpp * item.quantity;
        }
        map.set(key, existing);
      }
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
  })();
  const maxQty = menuTerlaris[0]?.qty ?? 0;

  // Laba kotor (margin produk) — HANYA dihitung dari baris item yang HPP-nya
  // tercatat (item.hpp !== undefined). Ini beda dari "Laba Bersih" di atas:
  // Laba Bersih = semua pemasukan - semua pengeluaran operasional (arus kas),
  // sedangkan Laba Kotor di sini murni margin harga jual dikurangi modal
  // bahan per menu, tanpa memperhitungkan pengeluaran operasional lain.
  let totalModalTerjual = 0;
  let omzetDenganHpp = 0;
  let qtyTanpaHpp = 0;
  for (const t of activeTransactions) {
    for (const item of t.items) {
      if (item.hpp === undefined) {
        qtyTanpaHpp += item.quantity;
      } else {
        totalModalTerjual += item.hpp * item.quantity;
        omzetDenganHpp += item.price * item.quantity;
      }
    }
  }
  const labaKotor = omzetDenganHpp - totalModalTerjual;
  const labaKotorPercent = omzetDenganHpp > 0 ? (labaKotor / omzetDenganHpp) * 100 : 0;

  // Ringkasan omzet per kasir (shift) pada tanggal terpilih — tidak
  // termasuk transaksi yang di-void, sama seperti perhitungan total lainnya.
  const perKasir = (() => {
    const map = new Map<
      string,
      { name: string; count: number; cash: number; qris: number; total: number }
    >();
    for (const t of activeTransactions) {
      const key = t.operatorName ?? 'Tanpa Kasir';
      const existing = map.get(key) ?? { name: key, count: 0, cash: 0, qris: 0, total: 0 };
      existing.count += 1;
      if (t.paymentMethod === 'cash') existing.cash += t.total;
      else existing.qris += t.total;
      existing.total += t.total;
      map.set(key, existing);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  })();
  const maxKasirTotal = perKasir[0]?.total ?? 0;

  // Statistik jam ramai — mengelompokkan transaksi (tidak termasuk void) pada
  // tanggal terpilih ke dalam blok 3 jam, supaya terlihat jam berapa warkop
  // paling sibuk tanpa membuat 24 batang terpisah yang terlalu sempit di HP.
  const jamBuckets = (() => {
    const buckets = Array.from({ length: 8 }, (_, i) => ({
      label: `${String(i * 3).padStart(2, '0')}–${String((i + 1) * 3).padStart(2, '0')}`,
      count: 0,
      omzet: 0,
    }));
    for (const t of activeTransactions) {
      const hour = new Date(t.createdAt).getHours();
      const idx = Math.min(Math.floor(hour / 3), 7);
      buckets[idx].count += 1;
      buckets[idx].omzet += t.total;
    }
    return buckets;
  })();
  const maxJamCount = Math.max(...jamBuckets.map((b) => b.count), 0);
  const jamRamaiIdx =
    maxJamCount > 0 ? jamBuckets.findIndex((b) => b.count === maxJamCount) : -1;

  // Rekap Bulanan — agregasi terpisah dari tampilan harian di atas, memakai
  // bulan yang dipilih sendiri (default bulan berjalan).
  const monthActiveTx = monthTransactions.filter((t) => !t.voided);
  const monthCash = monthActiveTx
    .filter((t) => t.paymentMethod === 'cash')
    .reduce((sum, t) => sum + t.total, 0);
  const monthQris = monthActiveTx
    .filter((t) => t.paymentMethod === 'qris')
    .reduce((sum, t) => sum + t.total, 0);
  const monthPemasukan = monthCash + monthQris;
  const monthPengeluaranTotal = monthPengeluaran.reduce((sum, e) => sum + e.amount, 0);
  const monthLaba = monthPemasukan - monthPengeluaranTotal;
  const monthLabel = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(
    new Date(`${selectedMonth}-01T00:00:00`)
  );

  // Laba kotor (margin produk) versi bulanan — logika sama seperti versi
  // harian di atas, hanya HPP yang tercatat yang dihitung.
  let monthModalTerjual = 0;
  let monthOmzetDenganHpp = 0;
  for (const t of monthActiveTx) {
    for (const item of t.items) {
      if (item.hpp !== undefined) {
        monthModalTerjual += item.hpp * item.quantity;
        monthOmzetDenganHpp += item.price * item.quantity;
      }
    }
  }
  const monthLabaKotor = monthOmzetDenganHpp - monthModalTerjual;

  // --- Laporan Kasbon --------------------------------------------------
  //
  // Ringkasan "saat ini" (tidak terikat tanggal/bulan yang dipilih) —
  // menunjukkan kondisi utang pelanggan sekarang, sama seperti badge/counter
  // yang sudah ada sebelumnya.
  const belumLunasKasbon = kasbonAll.filter((k) => k.status === 'belum_lunas');
  const totalKasbonBelumLunas = belumLunasKasbon.reduce((sum, k) => sum + k.total, 0);
  const kasbonJatuhTempo = belumLunasKasbon.filter((k) => daysSince(k.createdAt) >= KASBON_OVERDUE_DAYS);
  const kasbonJatuhTempoCount = kasbonJatuhTempo.length;

  // Pelanggan berutang terbesar — diagregasi per nama (satu pelanggan bisa
  // punya beberapa catatan kasbon belum lunas sekaligus).
  const topDebitur = (() => {
    const map = new Map<string, { name: string; total: number; count: number; maxDays: number }>();
    for (const k of belumLunasKasbon) {
      const existing = map.get(k.customerName) ?? { name: k.customerName, total: 0, count: 0, maxDays: 0 };
      existing.total += k.total;
      existing.count += 1;
      existing.maxDays = Math.max(existing.maxDays, daysSince(k.createdAt));
      map.set(k.customerName, existing);
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  })();
  const maxDebiturTotal = topDebitur[0]?.total ?? 0;

  // Breakdown bulanan untuk Rekap Bulanan: kasbon BARU dicatat bulan ini
  // (bukan pemasukan — baru jadi pemasukan saat lunas) vs kasbon yang LUNAS
  // di bulan ini (nominalnya sudah termasuk di monthPemasukan lewat
  // transaksi 'kasbon_lunas', ini cuma breakdown informatif).
  const monthKasbonBaru = kasbonAll.filter((k) => toMonthKey(new Date(k.createdAt)) === selectedMonth);
  const monthKasbonBaruTotal = monthKasbonBaru.reduce((sum, k) => sum + k.total, 0);
  const monthKasbonLunas = kasbonAll.filter(
    (k) => k.status === 'lunas' && k.paidAt && toMonthKey(new Date(k.paidAt)) === selectedMonth
  );
  const monthKasbonLunasTotal = monthKasbonLunas.reduce((sum, k) => sum + k.total, 0);

  function handleExportMonthCsv() {
    const headers = ['Tanggal', 'Tipe', 'Deskripsi', 'Metode/Kategori', 'Kasir', 'Pelanggan', 'Nominal'];
    const sortedMonthTx = [...monthActiveTx].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const sortedMonthExp = [...monthPengeluaran].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const rows: (string | number)[][] = [
      ...sortedMonthTx.map((t) => [
        formatDateTime(t.createdAt),
        'Penjualan',
        t.items.map((i) => `${i.name} x${i.quantity}${i.note ? ` (${i.note})` : ''}`).join('; '),
        t.paymentMethod === 'cash' ? 'Cash' : 'QRIS',
        t.operatorName ?? '-',
        t.customerName ?? '-',
        t.total,
      ]),
      ...sortedMonthExp.map((e) => [
        formatDateTime(e.createdAt),
        'Pengeluaran',
        e.name,
        '-',
        e.operatorName ?? '-',
        '-',
        -e.amount,
      ]),
    ];
    rows.push(['', '', '', '', '', 'Total Pemasukan', monthPemasukan]);
    rows.push(['', '', '', '', '', 'Total Pengeluaran', -monthPengeluaranTotal]);
    rows.push(['', '', '', '', '', 'Laba Bersih', monthLaba]);
    rows.push(['', '', '', '', '', 'Total Modal (HPP) Terjual', -monthModalTerjual]);
    rows.push(['', '', '', '', '', 'Laba Kotor (Margin Produk)', monthLabaKotor]);
    rows.push(['', '', '', '', '', 'Kasbon Baru Dicatat', monthKasbonBaruTotal]);
    rows.push(['', '', '', '', '', 'Kasbon Lunas (sudah termasuk Pemasukan)', monthKasbonLunasTotal]);
    rows.push(['', '', '', '', '', 'Kasbon Belum Lunas (saat ini)', totalKasbonBelumLunas]);

    downloadCsv(`rekap-bulanan-warkop27-${selectedMonth}.csv`, headers, rows);
  }

  // selectedDate berformat 'YYYY-MM-DD' — tambahkan waktu lokal supaya tidak
  // bergeser sehari akibat parsing sebagai UTC.
  const tanggalLabel = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(
    new Date(`${selectedDate}T00:00:00`)
  );

  function handleExportCsv() {
    const headers = ['Tanggal', 'Tipe', 'Deskripsi', 'Metode/Kategori', 'Kasir', 'Pelanggan', 'Nominal'];
    const activeSorted = sorted.filter((t) => !t.voided);
    const rows: (string | number)[][] = [
      ...activeSorted.map((t) => [
        formatDateTime(t.createdAt),
        'Penjualan',
        t.items.map((i) => `${i.name} x${i.quantity}${i.note ? ` (${i.note})` : ''}`).join('; '),
        t.paymentMethod === 'cash' ? 'Cash' : 'QRIS',
        t.operatorName ?? '-',
        t.customerName ?? '-',
        t.total,
      ]),
      ...sortedPengeluaran.map((e) => [
        formatDateTime(e.createdAt),
        'Pengeluaran',
        e.name,
        '-',
        e.operatorName ?? '-',
        '-',
        -e.amount,
      ]),
    ];
    rows.push(['', '', '', '', '', 'Total Pemasukan', totalPemasukan]);
    rows.push(['', '', '', '', '', 'Total Pengeluaran', -totalPengeluaran]);
    rows.push(['', '', '', '', '', 'Laba Bersih', labaBersih]);
    rows.push(['', '', '', '', '', 'Total Modal (HPP) Terjual', -totalModalTerjual]);
    rows.push(['', '', '', '', '', 'Laba Kotor (Margin Produk)', labaKotor]);

    downloadCsv(`rekap-warkop27-${selectedDate}.csv`, headers, rows);
  }

  async function handleClearData() {
    await clearTransactionsByDate(selectedDate);
    await clearPengeluaranByDate(selectedDate);
    setConfirmClear(false);
    await refresh(selectedDate);
  }

  // Alasan final yang akan disimpan: kalau pilih "Lainnya", pakai teks bebas
  // yang diketik; kalau bukan, pakai label tombolnya langsung.
  const finalVoidReason =
    voidReasonChoice === 'Lainnya' ? voidReasonCustom.trim() : voidReasonChoice;
  const isVoidReasonValid = !!finalVoidReason;

  function closeVoidModal() {
    setVoidTarget(null);
    setVoidReasonChoice(null);
    setVoidReasonCustom('');
  }

  async function handleVoid() {
    if (!voidTarget || !isVoidReasonValid) return;
    setVoiding(true);
    try {
      await voidTransaction(voidTarget.id, finalVoidReason || undefined);
      // Kembalikan stok untuk item yang punya menuItemId valid (transaksi
      // dari kasbon lunas punya menuItemId kosong karena menu asal boleh
      // sudah dihapus/berubah, jadi dilewati).
      for (const item of voidTarget.items) {
        if (item.menuItemId) {
          await incrementStock(item.menuItemId, item.quantity);
        }
      }
      await refresh(selectedDate);
    } finally {
      setVoiding(false);
      closeVoidModal();
    }
  }

  async function handleKirimLaporan() {
    setSendState('sending');
    setSendError(null);

    // Sertakan kasbon yang sudah lama belum lunas supaya pemilik warung
    // juga dapat pengingat lewat Telegram, tidak cuma lewat badge di app.
    const allKasbon = await getAllKasbon();
    const kasbonJatuhTempo = allKasbon
      .filter((k) => k.status === 'belum_lunas' && daysSince(k.createdAt) >= KASBON_OVERDUE_DAYS)
      .sort((a, b) => daysSince(b.createdAt) - daysSince(a.createdAt));

    const kasbonSection =
      kasbonJatuhTempo.length > 0
        ? `\n\n<b>⚠️ Kasbon Jatuh Tempo (${kasbonJatuhTempo.length})</b>\n` +
          kasbonJatuhTempo
            .map((k) => `- ${k.customerName}: ${formatRupiah(k.total)} (${daysSince(k.createdAt)} hari)`)
            .join('\n')
        : '';

    const message =
      `<b>Rekap Harian Warkop Dua Tujuh</b>\n` +
      `${tanggalLabel}\n\n` +
      `Pemasukan Cash: ${formatRupiah(totalCash)}\n` +
      `Pemasukan QRIS: ${formatRupiah(totalQris)}\n` +
      `Total Pemasukan: ${formatRupiah(totalPemasukan)}\n` +
      `Total Pengeluaran: ${formatRupiah(totalPengeluaran)}\n\n` +
      `<b>Laba Bersih: ${formatRupiah(labaBersih)}</b>\n\n` +
      `Jumlah transaksi: ${transactions.length}` +
      kasbonSection;

    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Gagal mengirim laporan ke Telegram');
      }
      setSendState('success');
    } catch (err) {
      setSendState('error');
      setSendError(err instanceof Error ? err.message : 'Gagal mengirim laporan');
    }
  }

  return (
    <div className="p-4 pb-24 md:pb-6">
      <h1 className="font-display font-semibold text-xl text-espresso mb-1">Rekap & Laporan</h1>

      {/* Pemilih tanggal */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 bg-surface border border-cream-dark rounded-card px-3 py-2">
          <CalendarDays size={16} className="text-espresso/50 shrink-0" />
          <input
            type="date"
            value={selectedDate}
            max={todayDateKey()}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm text-espresso bg-transparent outline-none"
          />
        </div>
        {!isToday && (
          <button
            onClick={() => setSelectedDate(todayDateKey())}
            className="text-sm font-medium text-espresso underline underline-offset-2"
          >
            Hari ini
          </button>
        )}
      </div>
      <p className="text-sm text-espresso/60 mb-4">{tanggalLabel}</p>

      {/* Ringkasan Keuangan */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-surface rounded-card p-4 border border-cream-dark">
          <div className="flex items-center gap-2 text-sage mb-1.5">
            <TrendingUp size={16} />
            <span className="text-xs font-medium">Pemasukan</span>
          </div>
          <p className="font-display font-semibold text-espresso text-lg">{formatRupiah(totalPemasukan)}</p>
          <p className="text-[11px] text-espresso/50 mt-0.5">
            Cash {formatRupiah(totalCash)} · QRIS {formatRupiah(totalQris)}
          </p>
        </div>

        <div className="bg-surface rounded-card p-4 border border-cream-dark">
          <div className="flex items-center gap-2 text-brick mb-1.5">
            <TrendingDown size={16} />
            <span className="text-xs font-medium">Pengeluaran</span>
          </div>
          <p className="font-display font-semibold text-espresso text-lg">{formatRupiah(totalPengeluaran)}</p>
          <p className="text-[11px] text-espresso/50 mt-0.5">{pengeluaran.length} catatan</p>
        </div>

        <div className="col-span-2 md:col-span-2 bg-espresso rounded-card p-4">
          <div className="flex items-center gap-2 text-crema mb-1.5">
            <Wallet size={16} />
            <span className="text-xs font-medium">Laba Bersih</span>
          </div>
          <p className="font-display font-semibold text-cream text-2xl">{formatRupiah(labaBersih)}</p>
        </div>
      </div>

      {/* Margin Produk (Laba Kotor) — beda dari Laba Bersih di atas: ini
          murni harga jual dikurangi modal (HPP) per menu yang terjual,
          tanpa memperhitungkan pengeluaran operasional lain. */}
      <section className="mb-6">
        <h2 className="font-display font-semibold text-espresso mb-2 flex items-center gap-1.5">
          <PiggyBank size={17} /> Margin Produk (HPP)
        </h2>
        {omzetDenganHpp === 0 ? (
          <p className="text-sm text-espresso/50 text-center py-8 bg-surface rounded-card border border-cream-dark">
            Belum ada penjualan dengan HPP tercatat pada tanggal ini. Isi HPP menu di halaman
            Manajemen Menu supaya margin bisa dihitung.
          </p>
        ) : (
          <div className="bg-surface rounded-card border border-cream-dark p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-xs text-espresso/50">Total Modal (HPP) Terjual</p>
                <p className="font-display font-semibold text-espresso text-lg">
                  {formatRupiah(totalModalTerjual)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-espresso/50">Laba Kotor</p>
                <p className="font-display font-semibold text-sage text-lg">
                  {formatRupiah(labaKotor)}{' '}
                  <span className="text-xs font-sans font-normal text-espresso/50">
                    ({labaKotorPercent.toFixed(0)}%)
                  </span>
                </p>
              </div>
            </div>
            {qtyTanpaHpp > 0 && (
              <p className="text-[11px] text-espresso/40 mt-3 pt-3 border-t border-cream-dark">
                {qtyTanpaHpp} item terjual tanpa data HPP (biasanya dari kasbon lama) tidak
                ikut dihitung di atas.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Tren Penjualan */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display font-semibold text-espresso flex items-center gap-1.5">
            <LineChart size={17} /> Tren Penjualan
          </h2>
          <div className="flex gap-1.5">
            <button
              onClick={() => setTrendRange('week')}
              className={`px-3 py-1 rounded-full text-xs border ${
                trendRange === 'week'
                  ? 'bg-espresso text-cream border-espresso'
                  : 'bg-surface text-espresso/70 border-cream-dark'
              }`}
            >
              7 Hari
            </button>
            <button
              onClick={() => setTrendRange('month')}
              className={`px-3 py-1 rounded-full text-xs border ${
                trendRange === 'month'
                  ? 'bg-espresso text-cream border-espresso'
                  : 'bg-surface text-espresso/70 border-cream-dark'
              }`}
            >
              30 Hari
            </button>
          </div>
        </div>
        <div className="bg-surface rounded-card border border-cream-dark p-4">
          {trendBuckets.every((b) => b.total === 0) ? (
            <p className="text-sm text-espresso/50 text-center py-8">
              Belum ada penjualan pada periode ini.
            </p>
          ) : (
            <SalesTrendChart buckets={trendBuckets} />
          )}
        </div>
      </section>

      {/* Jam Ramai */}
      <section className="mb-6">
        <h2 className="font-display font-semibold text-espresso mb-2 flex items-center gap-1.5">
          <Clock size={17} /> Jam Ramai
        </h2>
        {maxJamCount === 0 ? (
          <p className="text-sm text-espresso/50 text-center py-8 bg-surface rounded-card border border-cream-dark">
            Belum ada penjualan pada tanggal ini.
          </p>
        ) : (
          <div className="bg-surface rounded-card border border-cream-dark p-4 space-y-3">
            {jamBuckets.map((b, idx) => (
              <div key={b.label} className="flex items-center gap-3">
                <span className="text-xs text-espresso/50 w-14 shrink-0 whitespace-nowrap">{b.label}</span>
                <div className="flex-1 h-1.5 bg-cream-dark rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${idx === jamRamaiIdx ? 'bg-caramel' : 'bg-crema'}`}
                    style={{ width: `${maxJamCount > 0 ? (b.count / maxJamCount) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs text-espresso/60 w-8 text-right shrink-0">{b.count}x</span>
                {idx === jamRamaiIdx && <Flame size={13} className="text-caramel shrink-0" />}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Menu Terlaris */}
      <section className="mb-6">
        <h2 className="font-display font-semibold text-espresso mb-2">Menu Terlaris</h2>
        {menuTerlaris.length === 0 ? (
          <p className="text-sm text-espresso/50 text-center py-8 bg-surface rounded-card border border-cream-dark">
            Belum ada penjualan pada tanggal ini.
          </p>
        ) : (
          <div className="bg-surface rounded-card border border-cream-dark p-4 space-y-3">
            {menuTerlaris.map((item, idx) => (
              <div key={item.name} className="flex items-center gap-3">
                <div
                  className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0 ${
                    idx === 0 ? 'bg-crema text-espresso' : 'bg-cream-dark text-espresso/60'
                  }`}
                >
                  {idx === 0 ? <Flame size={13} /> : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-espresso font-medium truncate">{item.name}</span>
                    <span className="text-xs text-espresso/50 whitespace-nowrap">
                      {item.qty} terjual · {formatRupiah(item.omzet)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-cream-dark rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="h-full bg-caramel rounded-full"
                      style={{ width: `${maxQty > 0 ? (item.qty / maxQty) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-[11px] mt-1">
                    {item.hppUnknown && item.modal === 0 ? (
                      <span className="text-espresso/30">HPP belum diisi</span>
                    ) : (
                      <span className={item.omzet - item.modal < 0 ? 'text-brick' : 'text-sage'}>
                        Untung {formatRupiah(item.omzet - item.modal)}
                        {item.hppUnknown ? ' (sebagian tanpa HPP)' : ''}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Ringkasan per Kasir / Shift */}
      <section className="mb-6">
        <h2 className="font-display font-semibold text-espresso mb-2 flex items-center gap-1.5">
          <Users size={17} /> Ringkasan per Kasir
        </h2>
        {perKasir.length === 0 ? (
          <p className="text-sm text-espresso/50 text-center py-8 bg-surface rounded-card border border-cream-dark">
            Belum ada penjualan pada tanggal ini.
          </p>
        ) : (
          <div className="bg-surface rounded-card border border-cream-dark p-4 space-y-3">
            {perKasir.map((k) => (
              <button
                key={k.name}
                onClick={() => setOperatorFilter(k.name)}
                className="w-full text-left"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-espresso font-medium truncate">{k.name}</span>
                  <span className="text-xs text-espresso/50 whitespace-nowrap">
                    {k.count} transaksi · {formatRupiah(k.total)}
                  </span>
                </div>
                <div className="h-1.5 bg-cream-dark rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="h-full bg-sage rounded-full"
                    style={{ width: `${maxKasirTotal > 0 ? (k.total / maxKasirTotal) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-[11px] text-espresso/40 mt-1">
                  Cash {formatRupiah(k.cash)} · QRIS {formatRupiah(k.qris)}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Aksi */}
      <div className="flex flex-wrap gap-2 mb-2">
        <button
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 bg-surface border border-cream-dark text-espresso rounded-card px-3.5 py-2 text-sm font-medium"
        >
          <Download size={16} /> Export CSV
        </button>
        <button
          onClick={() => setConfirmClear(true)}
          className="flex items-center gap-1.5 bg-surface border border-cream-dark text-brick rounded-card px-3.5 py-2 text-sm font-medium"
        >
          <Trash2 size={16} /> Clear Data Tanggal Ini
        </button>
        <button
          onClick={handleKirimLaporan}
          disabled={sendState === 'sending' || !isToday}
          title={!isToday ? 'Hanya bisa mengirim laporan untuk hari ini' : undefined}
          className="flex items-center gap-1.5 bg-espresso text-cream rounded-card px-3.5 py-2 text-sm font-medium disabled:opacity-40"
        >
          {sendState === 'sending' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Tutup Warung & Kirim Laporan
        </button>
      </div>
      {!isToday && (
        <p className="text-xs text-espresso/50 mb-4">
          Kirim laporan Telegram hanya tersedia untuk tanggal hari ini.
        </p>
      )}
      {isToday && kasbonJatuhTempoCount > 0 && (
        <p className="text-xs text-brick/80 mb-4">
          {kasbonJatuhTempoCount} kasbon jatuh tempo akan ikut disertakan dalam laporan Telegram.
        </p>
      )}

      {sendState === 'success' && (
        <p className="text-sm text-sage mb-4">Laporan berhasil dikirim ke Telegram.</p>
      )}
      {sendState === 'error' && (
        <p className="text-sm text-brick mb-4">{sendError}</p>
      )}

      {/* Riwayat Transaksi */}
      <section className="mb-6">
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <h2 className="font-display font-semibold text-espresso">Riwayat Transaksi Penjualan</h2>
          {sorted.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {operatorNames.length > 1 && (
                <select
                  value={operatorFilter}
                  onChange={(e) => setOperatorFilter(e.target.value)}
                  className="bg-surface border border-cream-dark rounded-card px-3 py-1.5 text-sm text-espresso focus:outline-none focus:border-crema"
                >
                  <option value="semua">Semua Kasir</option>
                  {operatorNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              )}
              <div className="relative w-full sm:w-64">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-espresso/40 pointer-events-none"
                />
                <input
                  type="text"
                  value={txQuery}
                  onChange={(e) => setTxQuery(e.target.value)}
                  placeholder="Cari nama menu, pelanggan, atau nominal..."
                  className="w-full bg-surface border border-cream-dark rounded-card pl-8 pr-8 py-1.5 text-sm text-espresso placeholder:text-espresso/40 focus:outline-none focus:border-crema"
                />
                {txQuery && (
                  <button
                    onClick={() => setTxQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-espresso/40 hover:text-espresso"
                    aria-label="Hapus pencarian"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        {sorted.length === 0 ? (
          <p className="text-sm text-espresso/50 text-center py-8 bg-surface rounded-card border border-cream-dark">
            Tidak ada transaksi pada tanggal ini.
          </p>
        ) : filteredSorted.length === 0 ? (
          <p className="text-sm text-espresso/50 text-center py-8 bg-surface rounded-card border border-cream-dark">
            {txQ
              ? <>Tidak ada transaksi yang cocok dengan &quot;{txQuery}&quot;.</>
              : <>Tidak ada transaksi untuk kasir &quot;{operatorFilter}&quot;.</>}
          </p>
        ) : (
          <>
            {/* Kartu — dipakai di layar sempit (HP) supaya daftar item yang
                panjang tetap terbaca penuh tanpa perlu geser tabel ke samping. */}
            <div className="md:hidden space-y-2.5">
              {filteredSorted.map((t) => (
                <div
                  key={t.id}
                  className={`bg-surface rounded-card p-3.5 border border-cream-dark space-y-2 ${t.voided ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-espresso/50">{formatDateTime(t.createdAt)}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-cream-dark text-espresso/70 shrink-0">
                      {t.paymentMethod === 'cash' ? 'Cash' : 'QRIS'}
                    </span>
                  </div>
                  <p className={`text-sm text-espresso leading-snug ${t.voided ? 'line-through' : ''}`}>
                    {t.items
                      .map((i) => `${i.name} x${i.quantity}${i.note ? ` (${i.note})` : ''}`)
                      .join(', ')}
                  </p>
                  {t.customerName && (
                    <p className="text-xs text-espresso/50">Atas nama: {t.customerName}</p>
                  )}
                  {(t.source === 'kasbon_lunas' || t.voided) && (
                    <div className="flex gap-1.5 flex-wrap">
                      {t.source === 'kasbon_lunas' && (
                        <span className="text-[10px] text-crema/90 bg-espresso/5 px-1.5 py-0.5 rounded">
                          kasbon lunas
                        </span>
                      )}
                      {t.voided && (
                        <span className="text-[10px] text-brick bg-brick/10 px-1.5 py-0.5 rounded">
                          dibatalkan{t.voidReason ? ` · ${t.voidReason}` : ''}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 border-t border-cream-dark">
                    <span className="text-xs text-espresso/60">{t.operatorName ?? '-'}</span>
                    <div className="flex items-center gap-3">
                      <span className={`font-semibold text-espresso ${t.voided ? 'line-through' : ''}`}>
                        {formatRupiah(t.total)}
                      </span>
                      {!t.voided && (
                        <button
                          onClick={() => setVoidTarget(t)}
                          className="text-xs text-brick/80 hover:text-brick font-medium underline underline-offset-2"
                        >
                          Batalkan
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Tabel — dipakai di layar lebar (tablet/desktop) yang ruangnya
                cukup untuk menampilkan semua kolom sekaligus. */}
            <div className="hidden md:block bg-surface rounded-card border border-cream-dark overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-espresso/50 text-xs border-b border-cream-dark">
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Waktu</th>
                    <th className="px-3 py-2.5 font-medium">Item</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Metode</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Kasir</th>
                    <th className="px-3 py-2.5 font-medium text-right whitespace-nowrap">Total</th>
                    <th className="px-3 py-2.5 font-medium text-right whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSorted.map((t) => (
                    <tr
                      key={t.id}
                      className={`border-b border-cream-dark last:border-0 align-top ${t.voided ? 'opacity-50' : ''}`}
                    >
                      <td className="px-3 py-2.5 text-espresso/70 whitespace-nowrap">{formatDateTime(t.createdAt)}</td>
                      <td className={`px-3 py-2.5 text-espresso min-w-[200px] whitespace-normal break-words ${t.voided ? 'line-through' : ''}`}>
                        {t.items
                          .map((i) => `${i.name} x${i.quantity}${i.note ? ` (${i.note})` : ''}`)
                          .join(', ')}
                        {t.customerName && (
                          <span className="block text-xs text-espresso/50 not-italic">
                            Atas nama: {t.customerName}
                          </span>
                        )}
                        {t.source === 'kasbon_lunas' && (
                          <span className="ml-1.5 text-[10px] text-crema/90 bg-espresso/5 px-1.5 py-0.5 rounded whitespace-nowrap">
                            kasbon lunas
                          </span>
                        )}
                        {t.voided && (
                          <span className="ml-1.5 text-[10px] text-brick bg-brick/10 px-1.5 py-0.5 rounded whitespace-nowrap">
                            dibatalkan{t.voidReason ? ` · ${t.voidReason}` : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-espresso/70 whitespace-nowrap">{t.paymentMethod === 'cash' ? 'Cash' : 'QRIS'}</td>
                      <td className="px-3 py-2.5 text-espresso/70 whitespace-nowrap">{t.operatorName ?? '-'}</td>
                      <td className={`px-3 py-2.5 text-right font-medium text-espresso whitespace-nowrap ${t.voided ? 'line-through' : ''}`}>
                        {formatRupiah(t.total)}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {!t.voided && (
                          <button
                            onClick={() => setVoidTarget(t)}
                            className="text-xs text-brick/80 hover:text-brick font-medium underline underline-offset-2"
                          >
                            Batalkan
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Modal konfirmasi void transaksi */}
      {voidTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-cream rounded-card p-5 max-w-xs w-full space-y-4 text-center">
            <Ban size={28} className="mx-auto text-brick" />
            <div>
              <p className="text-espresso font-medium mb-1">Batalkan transaksi ini?</p>
              <p className="text-sm text-espresso/60">
                {voidTarget.items.map((i) => `${i.name} x${i.quantity}`).join(', ')} —{' '}
                {formatRupiah(voidTarget.total)}. Transaksi akan dikeluarkan dari total laporan
                dan stok menu terkait akan dikembalikan. Tindakan ini tidak bisa dibatalkan.
              </p>
            </div>

            <div className="text-left">
              <p className="text-xs text-espresso/60 mb-1.5">Alasan pembatalan</p>
              <div className="flex flex-wrap gap-1.5">
                {VOID_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setVoidReasonChoice(reason)}
                    className={`px-2.5 py-1.5 rounded-full text-xs border ${
                      voidReasonChoice === reason
                        ? 'bg-espresso text-cream border-espresso'
                        : 'bg-surface text-espresso/70 border-cream-dark'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              {voidReasonChoice === 'Lainnya' && (
                <input
                  autoFocus
                  value={voidReasonCustom}
                  onChange={(e) => setVoidReasonCustom(e.target.value)}
                  placeholder="Tulis alasannya..."
                  className="w-full border border-cream-dark rounded-card px-3 py-2 bg-surface text-sm text-espresso mt-2 focus:outline-none focus:border-espresso"
                />
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={closeVoidModal}
                disabled={voiding}
                className="flex-1 border border-cream-dark rounded-card py-2.5 text-espresso disabled:opacity-40"
              >
                Batal
              </button>
              <button
                onClick={handleVoid}
                disabled={voiding || !isVoidReasonValid}
                className="flex-1 bg-brick text-cream rounded-card py-2.5 flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {voiding ? <Loader2 size={16} className="animate-spin" /> : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Riwayat Pengeluaran */}
      <section className="mb-6">
        <h2 className="font-display font-semibold text-espresso mb-2">Riwayat Pengeluaran</h2>
        {sortedPengeluaran.length === 0 ? (
          <p className="text-sm text-espresso/50 text-center py-8 bg-surface rounded-card border border-cream-dark">
            Tidak ada pengeluaran pada tanggal ini.
          </p>
        ) : (
          <div className="bg-surface rounded-card border border-cream-dark overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-espresso/50 text-xs border-b border-cream-dark">
                  <th className="px-3 py-2.5 font-medium">Waktu</th>
                  <th className="px-3 py-2.5 font-medium">Nama</th>
                  <th className="px-3 py-2.5 font-medium text-right">Nominal</th>
                </tr>
              </thead>
              <tbody>
                {sortedPengeluaran.map((e) => (
                  <tr key={e.id} className="border-b border-cream-dark last:border-0">
                    <td className="px-3 py-2.5 text-espresso/70 whitespace-nowrap">{formatDateTime(e.createdAt)}</td>
                    <td className="px-3 py-2.5 text-espresso">{e.name}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-brick whitespace-nowrap">
                      {formatRupiah(e.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Laporan Kasbon — ringkasan kondisi utang pelanggan saat ini, tidak
          terikat ke tanggal/bulan yang dipilih di atas. */}
      <section className="mb-6">
        <h2 className="font-display font-semibold text-espresso mb-2 flex items-center gap-1.5">
          <Receipt size={17} /> Laporan Kasbon
        </h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-surface rounded-card p-4 border border-cream-dark">
            <div className="flex items-center gap-2 text-brick mb-1.5">
              <Wallet size={16} />
              <span className="text-xs font-medium">Belum Lunas</span>
            </div>
            <p className="font-display font-semibold text-espresso text-lg">
              {formatRupiah(totalKasbonBelumLunas)}
            </p>
            <p className="text-[11px] text-espresso/50 mt-0.5">{belumLunasKasbon.length} catatan</p>
          </div>
          <div className="bg-surface rounded-card p-4 border border-cream-dark">
            <div className="flex items-center gap-2 text-brick mb-1.5">
              <AlertTriangle size={16} />
              <span className="text-xs font-medium">Jatuh Tempo</span>
            </div>
            <p className="font-display font-semibold text-espresso text-lg">{kasbonJatuhTempoCount}</p>
            <p className="text-[11px] text-espresso/50 mt-0.5">sudah ≥{KASBON_OVERDUE_DAYS} hari belum lunas</p>
          </div>
        </div>
        <h3 className="text-xs font-medium text-espresso/60 mb-2">Pelanggan Berutang Terbesar</h3>
        {topDebitur.length === 0 ? (
          <p className="text-sm text-espresso/50 text-center py-8 bg-surface rounded-card border border-cream-dark">
            Tidak ada kasbon yang belum lunas saat ini.
          </p>
        ) : (
          <div className="bg-surface rounded-card border border-cream-dark p-4 space-y-3">
            {topDebitur.map((d) => (
              <div key={d.name}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-espresso font-medium truncate">{d.name}</span>
                  <span className="text-xs text-espresso/50 whitespace-nowrap">
                    {d.count} catatan · {formatRupiah(d.total)}
                  </span>
                </div>
                <div className="h-1.5 bg-cream-dark rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="h-full bg-brick rounded-full"
                    style={{ width: `${maxDebiturTotal > 0 ? (d.total / maxDebiturTotal) * 100 : 0}%` }}
                  />
                </div>
                {d.maxDays >= KASBON_OVERDUE_DAYS && (
                  <p className="text-[11px] text-brick mt-1">Sudah {d.maxDays} hari belum lunas</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Rekap Bulanan */}
      <section className="mb-6">
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <h2 className="font-display font-semibold text-espresso flex items-center gap-1.5">
            <CalendarRange size={17} /> Rekap Bulanan
          </h2>
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
        </div>
        <p className="text-xs text-espresso/50 mb-3 capitalize">{monthLabel}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div className="bg-surface rounded-card p-4 border border-cream-dark">
            <div className="flex items-center gap-2 text-sage mb-1.5">
              <TrendingUp size={16} />
              <span className="text-xs font-medium">Pemasukan</span>
            </div>
            <p className="font-display font-semibold text-espresso text-lg">{formatRupiah(monthPemasukan)}</p>
            <p className="text-[11px] text-espresso/50 mt-0.5">
              Cash {formatRupiah(monthCash)} · QRIS {formatRupiah(monthQris)}
            </p>
          </div>
          <div className="bg-surface rounded-card p-4 border border-cream-dark">
            <div className="flex items-center gap-2 text-brick mb-1.5">
              <TrendingDown size={16} />
              <span className="text-xs font-medium">Pengeluaran</span>
            </div>
            <p className="font-display font-semibold text-espresso text-lg">{formatRupiah(monthPengeluaranTotal)}</p>
            <p className="text-[11px] text-espresso/50 mt-0.5">{monthPengeluaran.length} catatan</p>
          </div>
          <div className="col-span-2 md:col-span-2 bg-espresso rounded-card p-4">
            <div className="flex items-center gap-2 text-crema mb-1.5">
              <Wallet size={16} />
              <span className="text-xs font-medium">Laba Bersih Bulan Ini</span>
            </div>
            <p className="font-display font-semibold text-cream text-2xl">{formatRupiah(monthLaba)}</p>
            <p className="text-[11px] text-cream/60 mt-0.5">{monthActiveTx.length} transaksi</p>
          </div>
        </div>

        {/* Breakdown kasbon bulan ini */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-surface rounded-card p-4 border border-cream-dark">
            <div className="flex items-center gap-2 text-espresso/70 mb-1.5">
              <Receipt size={16} />
              <span className="text-xs font-medium">Kasbon Baru</span>
            </div>
            <p className="font-display font-semibold text-espresso text-lg">
              {formatRupiah(monthKasbonBaruTotal)}
            </p>
            <p className="text-[11px] text-espresso/50 mt-0.5">{monthKasbonBaru.length} catatan</p>
          </div>
          <div className="bg-surface rounded-card p-4 border border-cream-dark">
            <div className="flex items-center gap-2 text-sage mb-1.5">
              <Wallet size={16} />
              <span className="text-xs font-medium">Kasbon Lunas</span>
            </div>
            <p className="font-display font-semibold text-espresso text-lg">
              {formatRupiah(monthKasbonLunasTotal)}
            </p>
            <p className="text-[11px] text-espresso/50 mt-0.5">{monthKasbonLunas.length} catatan</p>
          </div>
        </div>
        <p className="text-[11px] text-espresso/40 mb-3">
          Kasbon Lunas sudah termasuk dalam Pemasukan di atas. Kasbon Baru bukan pemasukan — baru
          tercatat sebagai pemasukan saat pelanggannya melunasi.
        </p>

        {monthActiveTx.length === 0 ? (
          <p className="text-sm text-espresso/50 text-center py-6 bg-surface rounded-card border border-cream-dark">
            Belum ada transaksi pada bulan ini.
          </p>
        ) : (
          <button
            onClick={handleExportMonthCsv}
            className="flex items-center gap-1.5 bg-surface border border-cream-dark text-espresso rounded-card px-3.5 py-2 text-sm font-medium"
          >
            <Download size={16} /> Export CSV Bulan Ini
          </button>
        )}
      </section>

      {confirmClear && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-cream rounded-card p-5 max-w-xs w-full space-y-4 text-center">
            <p className="text-espresso">
              Hapus semua data transaksi & pengeluaran pada {tanggalLabel}? Tindakan tidak bisa dibatalkan.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmClear(false)}
                className="flex-1 border border-cream-dark rounded-card py-2.5 text-espresso"
              >
                Batal
              </button>
              <button onClick={handleClearData} className="flex-1 bg-brick text-cream rounded-card py-2.5">
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
