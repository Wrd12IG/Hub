import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./glass-skin.css";
import React, { Suspense } from 'react';
import { Providers } from './providers';


// Font caricati dal progetto (pacchetti @fontsource), NON scaricati da Google a ogni build:
// next/font/google fallisce quando Vercel non raggiunge fonts.gstatic.com e fa cadere la build a caso.
// Stessi font e stessi pesi di prima (subset latin: copre le lettere accentate italiane).
// I percorsi devono essere stringhe letterali: next/font non valuta variabili.
const dmSans = localFont({
  src: "../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2",
  variable: "--font-dm-sans",
  weight: "100 1000",
  display: "swap",
});
const spaceGrotesk = localFont({
  src: "../node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2",
  variable: "--font-space-grotesk",
  weight: "300 700",
  display: "swap",
});
const dmMono = localFont({
  src: [
    { path: "../node_modules/@fontsource/dm-mono/files/dm-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../node_modules/@fontsource/dm-mono/files/dm-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-dm-mono",
  display: "swap",
});
const jakartaSans = localFont({
  src: "../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2",
  variable: "--font-jakarta",
  weight: "200 800",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" }
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "W[r]Digital ® Marketing HUB",
  description: "Il sistema centralizzato per la gestione di task, progetti, clienti e comunicazione per W[r]Digital",
  applicationName: "W[r]Digital HUB",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "WrDigital HUB",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "build-version": "1.1.2",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icon.png",
    apple: [
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "it_IT",
    siteName: "W[r]Digital Marketing HUB",
    title: "W[r]Digital ® Marketing HUB",
    description: "Il sistema centralizzato per la gestione di task, progetti, clienti e comunicazione",
  },
  twitter: {
    card: "summary_large_image",
    title: "W[r]Digital ® Marketing HUB",
    description: "Il sistema centralizzato per la gestione di task, progetti, clienti e comunicazione",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${spaceGrotesk.variable} ${dmMono.variable} ${jakartaSans.variable} font-body antialiased`}>
        <Providers>
          <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><p>Loading...</p></div>}>
            {children}
          </Suspense>

        </Providers>
      </body>
    </html>
  );
}
