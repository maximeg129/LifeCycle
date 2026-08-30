import type { Metadata } from 'next';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';
import { FirebaseClientProvider } from '@/firebase';
import { Toaster } from '@/components/ui/toaster';
import { IntervalsProvider } from '@/hooks/use-intervals';
import { LocaleSync } from '@/i18n/locale-sync';

// "Performance Lab" identity — Space Grotesk (headings/body) + JetBrains
// Mono (data readouts: stats, prices, dates in tables — see .lc-data /
// font-data). Self-hosted via next/font (no external request, no FOUC),
// replacing the Inter + -apple-system stack.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono-data',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LifeCycle Pro',
  description: 'Votre coffre-fort personnel pour la performance et le style de vie.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'LifeCycle',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport = {
  themeColor: '#6FAB21',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Résolu depuis le cookie NEXT_LOCALE côté serveur (src/i18n/request.ts) —
  // jamais depuis la préférence Firestore directement (lecture Firestore
  // client-only dans cette app, voir la section Authentification de
  // CLAUDE.md). <LocaleSync> ci-dessous tient ce cookie à jour dès que
  // l'utilisateur est connecté.
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <head>
        {/* Anti-FOUC: apply saved theme before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('lifecycle-theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
        {/* Register the app-shell service worker (offline resilience only — no data caching). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}`,
          }}
        />
      </head>
      <body className="font-body">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <FirebaseClientProvider>
            <IntervalsProvider>
              <LocaleSync />
              {children}
              <Toaster />
            </IntervalsProvider>
          </FirebaseClientProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
