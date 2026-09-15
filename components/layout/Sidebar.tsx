'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart, BookUser, Receipt, UtensilsCrossed, BarChart3, Coffee, Settings, UserRound, LogOut, type LucideIcon } from 'lucide-react';
import { getAllKasbon } from '@/lib/storage/kasbonService';
import { getDaysSinceLastBackup } from '@/lib/storage/backupService';
import { getActiveOperator, clearActiveOperator } from '@/lib/storage/operatorService';
import { daysSince } from '@/lib/utils/date';
import { KASBON_OVERDUE_DAYS, BACKUP_REMINDER_DAYS } from '@/lib/constants';
import ThemeToggle from '@/components/theme/ThemeToggle';

interface NavItem {
  href: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/kasir', label: 'Kasir', icon: ShoppingCart },
  { href: '/kasbon', label: 'Kasbon', icon: BookUser },
  { href: '/pengeluaran', label: 'Pengeluaran', icon: Receipt },
  { href: '/menu', label: 'Menu & Stok', shortLabel: 'Menu', icon: UtensilsCrossed },
  { href: '/laporan', label: 'Laporan', icon: BarChart3 },
  { href: '/pengaturan', label: 'Pengaturan', icon: Settings },
];

export default function Sidebar({ onLogout }: { onLogout?: () => void }) {
  const pathname = usePathname();
  const [kasbonOverdue, setKasbonOverdue] = useState(0);
  const [backupOverdue, setBackupOverdue] = useState(false);
  const [activeOperatorName, setActiveOperatorName] = useState<string | null>(null);

  async function handleLogout() {
    await clearActiveOperator();
    onLogout?.();
  }

  useEffect(() => {
    async function checkOverdue() {
      const all = await getAllKasbon();
      const count = all.filter(
        (e) => e.status === 'belum_lunas' && daysSince(e.createdAt) >= KASBON_OVERDUE_DAYS
      ).length;
      setKasbonOverdue(count);

      const daysSinceBackup = await getDaysSinceLastBackup();
      setBackupOverdue(daysSinceBackup === null || daysSinceBackup >= BACKUP_REMINDER_DAYS);

      const session = await getActiveOperator();
      setActiveOperatorName(session?.operatorName ?? null);
    }
    checkOverdue();
    // Cek ulang setiap kali pindah halaman, supaya badge ikut update kalau
    // baru saja melunasi/menambah kasbon, backup, atau ganti kasir di halaman lain.
  }, [pathname]);

  return (
    <>
      {/* Navigasi desktop — warnanya dikunci manual (bukan token tema) supaya
          sidebar tetap jadi bar gelap yang konsisten di mode terang maupun gelap. */}
      <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 bg-[#3C2415] text-[#FBF6EE] p-6 gap-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coffee size={22} className="text-[#C9A227]" />
            <span className="font-display text-lg tracking-tight">Dua Tujuh</span>
          </div>
          <ThemeToggle />
        </div>

        {activeOperatorName && (
          <div className="flex items-center justify-between gap-2 -mt-4 -mb-2 text-[#FBF6EE]/70 text-xs">
            <span className="flex items-center gap-2 min-w-0">
              <UserRound size={13} className="shrink-0" />
              <span className="truncate">Kasir jaga: <span className="font-medium text-[#FBF6EE]">{activeOperatorName}</span></span>
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 shrink-0 text-[#FBF6EE]/70 hover:text-[#FBF6EE]"
              title="Keluar / ganti kasir"
            >
              <LogOut size={13} />
            </button>
          </div>
        )}

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-card text-sm transition-colors ${
                  active
                    ? 'bg-[#FBF6EE] text-[#3C2415] font-semibold'
                    : 'text-[#FBF6EE]/80 hover:bg-[#5A3825]'
                }`}
              >
                <Icon size={18} />
                {label}
                {href === '/kasbon' && kasbonOverdue > 0 && (
                  <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#B3432B] text-[#FBF6EE] text-[10px] font-semibold">
                    {kasbonOverdue}
                  </span>
                )}
                {href === '/pengaturan' && backupOverdue && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-[#B3432B]" title="Belum backup baru-baru ini" />
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Navigasi bawah untuk HP/Tablet */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#3C2415] text-[#FBF6EE] flex justify-around py-2 z-40 border-t border-[#5A3825]">
        {NAV_ITEMS.map(({ href, label, shortLabel, icon: Icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] whitespace-nowrap ${
                active ? 'text-[#C9A227]' : 'text-[#FBF6EE]/70'
              }`}
            >
              <span className="relative">
                <Icon size={20} />
                {href === '/kasbon' && kasbonOverdue > 0 && (
                  <span className="absolute -top-1 -right-1.5 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#B3432B] text-[#FBF6EE] text-[9px] font-semibold">
                    {kasbonOverdue}
                  </span>
                )}
                {href === '/pengaturan' && backupOverdue && (
                  <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-[#B3432B]" />
                )}
              </span>
              {shortLabel ?? label}
            </Link>
          );
        })}
        {activeOperatorName && (
          <button
            onClick={handleLogout}
            className="flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] text-[#FBF6EE]/70"
          >
            <LogOut size={20} />
            Keluar
          </button>
        )}
      </nav>
    </>
  );
}
