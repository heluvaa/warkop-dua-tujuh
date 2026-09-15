'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

const THEME_KEY = 'warkop27_theme';

export default function ThemeToggle({ className }: { className?: string }) {
  // Nilai awal null supaya tidak salah render sebelum tahu preferensi yang
  // tersimpan (dibaca secara sinkron oleh inline script di layout.tsx).
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    window.localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    setIsDark(next);
  }

  if (isDark === null) {
    // Placeholder berukuran sama supaya tidak ada layout shift saat hydrate.
    return <div className="w-8 h-8" />;
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
      className={
        className ??
        'flex items-center justify-center w-8 h-8 rounded-full bg-[#5A3825] text-[#FBF6EE] hover:bg-[#6b4530] transition-colors'
      }
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
