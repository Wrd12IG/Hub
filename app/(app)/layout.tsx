'use client';
import React, { useEffect, useState } from 'react';
import { useLayoutData } from "@/app/(app)/layout-context";
import { auth } from '@/lib/firebase';
import { usePathname } from 'next/navigation';
import { Header } from "@/components/header";
import { SidebarNav } from "@/components/sidebar-nav";
import { Loader2 } from "lucide-react";
import { useRouter } from 'next/navigation';
import { SidebarInset } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { Toaster } from 'sonner';
import TimersPanel from '@/components/pomodoro-timer';
import CommandMenu, { CommandMenuProvider } from '@/components/command-menu';
import MotivationalQuote from '@/components/motivational-quote';
import { LoveHeartAnimation } from '@/components/love-heart-animation';
import DynamicIcons from '@/components/dynamic-icons';
import { useKonamiCodeToggle } from '@/hooks/useKonamiCode';
import { BukowskiMode, BukowskiConfetti } from '@/components/easter-eggs/bukowski-mode';
import { BirthdayCelebration } from '@/components/birthday-celebration';
import FloatingNetworkBackground from '@/components/FloatingNetworkBackground';
import { BrandWordmark } from '@/components/brand-wordmark';
import { PageTransition } from '@/components/PageTransition';
import FloatingCommandDock from '@/components/floating-command-dock';
import GlassSkinToggle from '@/components/glass-skin-toggle';



import { TranslationProvider } from '@/hooks/useTranslation';
import { isClientAreaPath } from '@/lib/client-area';


/** Pagine che riempiono lo schermo da sole: uno spazio in fondo le farebbe scorrere senza motivo. */
const FULL_HEIGHT_PAGES = ['/chat', '/focus'];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoadingLayout, timerTasks, stopTimer, users } = useLayoutData();
  const router = useRouter();
  const pathname = usePathname();
  const isFullHeightPage = FULL_HEIGHT_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const [isMounted, setIsMounted] = useState(false);
  const [bukowskiMode, toggleBukowskiMode] = useKonamiCodeToggle();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // `auth.currentUser` c'è già appena Firebase ha accettato la password, un attimo prima che il profilo sia caricato:
    // senza questo controllo quell'attimo bastava a rimandare al login (toast «Login effettuato» e di nuovo l'accesso).
    if (isMounted && !isLoadingLayout && !currentUser && !auth.currentUser) {
      router.replace('/login');
    }
  }, [currentUser, isLoadingLayout, router, isMounted]);

  useEffect(() => {
    if (isMounted && !isLoadingLayout && currentUser?.role === 'Cliente' && currentUser.clientId && !isClientAreaPath(pathname, currentUser.clientId)) {
      router.replace(`/clients/${currentUser.clientId}`);
    }
  }, [currentUser, isLoadingLayout, router, isMounted, pathname]);


  // Accesso «Cliente»: tre pagine del proprio cliente (risultati, PED, brief). Qualunque altro indirizzo riporta ai risultati
  // (e intanto non si mostra niente). Le API fanno comunque il loro controllo: questa è la parte di navigazione.
  // Lo spinner va solo mentre si reindirizza: prima valeva per ogni pagina diversa dai risultati, anche per PED e Brief.
  const redirectingClient = currentUser?.role === 'Cliente' && !!currentUser.clientId && !isClientAreaPath(pathname, currentUser.clientId);

  if (!isMounted || isLoadingLayout || !currentUser || redirectingClient) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-primary/10 animate-pulse" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <BrandWordmark className="text-base text-foreground/80 animate-pulse" />
            <span className="text-xs text-muted-foreground">Caricamento HUB…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TranslationProvider>
      <CommandMenuProvider>
        <div className="flex h-screen w-full bg-transparent">
          <React.Suspense fallback={null}>
            <GlassSkinToggle />
          </React.Suspense>
          <FloatingNetworkBackground />

          {/* Menu Globale a sinistra nascosto: Navigazione spostata nel Floating Command Dock e Header */}
          {/* <SidebarNav /> */}
          <SidebarInset className="relative isolate">
            <Header />
            {/* Pagine a tutta altezza (es. la chat): niente spazio in fondo al contenuto, quindi il margine sta qui, nel padding di <main>.
                Senza, la barra flottante copre la casella di scrittura. */}
            <main className={cn('flex-1 overflow-auto p-4 sm:px-6 sm:py-6 w-full min-w-0', isFullHeightPage && 'pb-24 sm:pb-24')}>
              <PageTransition key={pathname} fullHeight={isFullHeightPage}>
                {children}
                {/* Spazio sotto l'ultima riga, per la barra flottante. Sta DENTRO il contenitore della pagina: il padding di
                    <main> non conta, perché PageTransition è alto il 100% e il contenuto più lungo ne esce (misurato: 0 px
                    sotto il contenuto col padding, 111 px con questo spazio). Non nelle pagine a tutta altezza. */}
                {!isFullHeightPage && (
                  <div aria-hidden="true" className="h-28 shrink-0" />
                )}
              </PageTransition>
            </main>
            {currentUser.role !== 'Cliente' && <CommandMenu />}
            <FloatingCommandDock />
          </SidebarInset>
          <Toaster richColors position="top-right" />
          {/* Cronometri in corso: più task possono essere cronometrati insieme */}
          <TimersPanel tasks={timerTasks} onStop={stopTimer} />
          <DynamicIcons />
          {/* Le frasi motivazionali, il Konami, i cuori e i compleanni dei colleghi sono del team: il cliente vede solo i suoi
              risultati e non deve ricevere popup pensati per chi lavora nell'agenzia. */}
          {currentUser.role !== 'Cliente' && (
            <>
              <MotivationalQuote />
              <LoveHeartAnimation />
              <BukowskiMode active={bukowskiMode} onClose={toggleBukowskiMode} />
              <BukowskiConfetti />
              <BirthdayCelebration users={users} />
            </>
          )}

        </div>
      </CommandMenuProvider>
    </TranslationProvider>
  );
}
