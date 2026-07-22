'use client';
import React, { useEffect, useState } from 'react';
import { useLayoutData } from "@/app/(app)/layout-context";
import { usePathname } from 'next/navigation';
import { Header } from "@/components/header";
import { SidebarNav } from "@/components/sidebar-nav";
import { Loader2 } from "lucide-react";
import { useRouter } from 'next/navigation';
import { SidebarInset } from '@/components/ui/sidebar';
import { Toaster } from 'sonner';
import PomodoroWidget from '@/components/pomodoro-timer';
import CommandMenu, { CommandMenuProvider } from '@/components/command-menu';
import MotivationalQuote from '@/components/motivational-quote';
import { LoveHeartAnimation } from '@/components/love-heart-animation';
import DynamicIcons from '@/components/dynamic-icons';
import { useKonamiCodeToggle } from '@/hooks/useKonamiCode';
import { BukowskiMode, BukowskiConfetti } from '@/components/easter-eggs/bukowski-mode';
import { BirthdayCelebration } from '@/components/birthday-celebration';
import FloatingNetworkBackground from '@/components/FloatingNetworkBackground';
import { PageTransition } from '@/components/PageTransition';
import FloatingCommandDock from '@/components/floating-command-dock';



import { TranslationProvider } from '@/hooks/useTranslation';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoadingLayout, pomodoroTask, setPomodoroTask, users } = useLayoutData();
  const router = useRouter();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const [bukowskiMode, toggleBukowskiMode] = useKonamiCodeToggle();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && !isLoadingLayout && !currentUser) {
      router.replace('/login');
    }
  }, [currentUser, isLoadingLayout, router, isMounted]);


  if (!isMounted || isLoadingLayout || !currentUser) {
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
            <span className="text-sm font-semibold tracking-widest text-foreground/80 uppercase animate-pulse">W[r]Digital</span>
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
          <FloatingNetworkBackground />

          <SidebarNav />
          <SidebarInset className="relative isolate">
            <Header />
            <main className="flex-1 overflow-auto p-4 sm:px-6 sm:py-6 w-full min-w-0">
              <PageTransition key={pathname}>
                {children}
              </PageTransition>
            </main>
            <CommandMenu />
            <FloatingCommandDock />
          </SidebarInset>
          <Toaster richColors position="top-right" />
          {pomodoroTask && (
            <PomodoroWidget
              task={pomodoroTask}
              onClose={() => setPomodoroTask(null)}
            />
          )}
          <MotivationalQuote />
          <LoveHeartAnimation />
          <DynamicIcons />
          <BukowskiMode active={bukowskiMode} onClose={toggleBukowskiMode} />
          <BukowskiConfetti />
          <BirthdayCelebration users={users} />

        </div>
      </CommandMenuProvider>
    </TranslationProvider>
  );
}
