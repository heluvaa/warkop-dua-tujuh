'use client';

import { useEffect, useState } from 'react';
import { Search, X, ChevronRight, AlertTriangle, Users, UserPlus, Wallet, CalendarCheck } from 'lucide-react';
import {
  getAllCustomerSummaries,
  getCustomerReportSummary,
  type CustomerSummary,
  type CustomerReportSummary,
} from '@/lib/storage/customerService';
import { formatRupiah } from '@/lib/utils/format';
import CustomerDetailModal from '@/components/pelanggan/CustomerDetailModal';

export default function PelangganPage() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [report, setReport] = useState<CustomerReportSummary | null>(null);
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const [summaries, reportSummary] = await Promise.all([
      getAllCustomerSummaries(),
      getCustomerReportSummary(),
    ]);
    setCustomers(summaries);
    setReport(reportSummary);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = customers.filter((c) => !q || c.name.toLowerCase().includes(q));

  const totalKasbonBelumLunas = customers.reduce((sum, c) => sum + c.totalKasbonBelumLunas, 0);

  return (
    <div className="p-4 pb-24 md:pb-6">
      <h1 className="font-display font-semibold text-xl text-espresso mb-1">Riwayat Pelanggan</h1>
      <p className="text-sm text-espresso/60 mb-4">
        Dikumpulkan dari nama yang diisi di Kasir & Kasbon. Total belum lunas semua pelanggan:{' '}
        <span className="font-semibold text-brick">{formatRupiah(totalKasbonBelumLunas)}</span>
      </p>

      {report && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-surface rounded-card border border-cream-dark p-3">
            <p className="flex items-center gap-1 text-[11px] text-espresso/50">
              <Users size={12} /> Total Pelanggan
            </p>
            <p className="text-lg font-semibold text-espresso mt-0.5">{report.totalPelanggan}</p>
          </div>
          <div className="bg-surface rounded-card border border-cream-dark p-3">
            <p className="flex items-center gap-1 text-[11px] text-espresso/50">
              <CalendarCheck size={12} /> Pelanggan Hari Ini
            </p>
            <p className="text-lg font-semibold text-espresso mt-0.5">{report.pelangganHariIni}</p>
          </div>
          <div className="bg-surface rounded-card border border-cream-dark p-3">
            <p className="flex items-center gap-1 text-[11px] text-espresso/50">
              <UserPlus size={12} /> Baru Bulan Ini
            </p>
            <p className="text-lg font-semibold text-espresso mt-0.5">{report.pelangganBaruBulanIni}</p>
          </div>
          <div className="bg-surface rounded-card border border-cream-dark p-3">
            <p className="flex items-center gap-1 text-[11px] text-espresso/50">
              <Wallet size={12} /> Rata-rata Belanja
            </p>
            <p className="text-sm font-semibold text-espresso mt-1 leading-tight">
              {formatRupiah(report.rataRataBelanja)}
            </p>
          </div>
        </div>
      )}

      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-espresso/40 pointer-events-none"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama pelanggan..."
          className="w-full bg-surface border border-cream-dark rounded-card pl-9 pr-9 py-2.5 text-sm text-espresso placeholder:text-espresso/40 focus:outline-none focus:border-crema"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-espresso/40 hover:text-espresso"
            aria-label="Hapus pencarian"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-espresso/50 text-center py-10">Memuat...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-espresso/50 text-center py-10">
          {q
            ? `Tidak ada pelanggan yang cocok dengan "${query}".`
            : 'Belum ada nama pelanggan yang tercatat. Isi nama pelanggan saat checkout di Kasir atau saat mencatat Kasbon.'}
        </p>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((c) => (
            <button
              key={c.key}
              onClick={() => setSelectedKey(c.key)}
              className="w-full flex items-center justify-between gap-3 bg-surface rounded-card p-4 border border-cream-dark text-left"
            >
              <div className="min-w-0">
                <p className="font-medium text-espresso truncate">{c.name}</p>
                <p className="text-xs text-espresso/50">
                  Belanja: <span className="font-medium">{formatRupiah(c.totalBelanja)}</span>
                  {' · '}
                  {c.transactionCount} transaksi
                </p>
                {c.totalKasbonBelumLunas > 0 && (
                  <p className="flex items-center gap-1 text-xs text-brick mt-0.5">
                    <AlertTriangle size={11} />
                    Kasbon belum lunas: {formatRupiah(c.totalKasbonBelumLunas)}
                  </p>
                )}
              </div>
              <ChevronRight size={18} className="text-espresso/30 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {selectedKey && (
        <CustomerDetailModal customerKey={selectedKey} onClose={() => setSelectedKey(null)} />
      )}
    </div>
  );
}
