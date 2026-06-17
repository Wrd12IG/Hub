import type { Metadata, Viewport } from "next";
import { Space_Grotesk, DM_Sans, DM_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import React, { Suspense } from 'react';
import { Providers } from './providers';


const dmSans = DM_Sans({ 
  subsets: ["latin"], 
  variable: "--font-dm-sans",
  weight: ["300", "400", "500", "600"]
});
const spaceGrotesk = Space_Grotesk({ 
  subsets: ["latin"], 
  variable: "--font-space-grotesk",
  weight: ["400", "500", "600", "700"]
});
const dmMono = DM_Mono({ 
  subsets: ["latin"], 
  variable: "--font-dm-mono",
  weight: ["400", "500"]
});
const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["300", "400", "500", "600", "700", "800"],
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
