import type { Metadata, Viewport } from 'next';
import { Fraunces, Manrope } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/layout/Sidebar';
import TelegramCommandListener from '@/components/telegram/TelegramCommandListener';
import ServiceWorkerRegister from '@/components/pwa/ServiceWorkerRegister';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'Warkop Dua Tujuh — Kasir',
  description: 'Sistem kasir dan manajemen Warkop Dua Tujuh',
  manifest: '/manifest.json',
  appleWebApp: {
    // Membuat Safari iOS memperlakukan app ini sebagai app "standalone"
    // (tanpa address bar) begitu di-"Add to Home Screen", bukan cuma
    // bookmark biasa.
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Warkop 27',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#3C2415',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        {/* Terapkan preferensi tema (localStorage atau prefers-color-scheme)
            sebelum halaman dirender, supaya tidak ada kedipan warna saat load. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var stored = localStorage.getItem('warkop27_theme');
                var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (dark) document.documentElement.classList.add('dark');
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className={`${fraunces.variable} ${manrope.variable} font-sans bg-cream text-espresso-dark min-h-screen antialiased`}>
        <div className="flex flex-col md:flex-row min-h-screen">
          <Sidebar />
          <main className="flex-1 pb-16 md:pb-0 min-h-screen">{children}</main>
        </div>
        <TelegramCommandListener />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
