'use client';
import React, { useEffect, useState } from 'react';
import { useLayoutData } from "@/app/(app)/layout-context";
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



export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoadingLayout, pomodoroTask, setPomodoroTask, users } = useLayoutData();
  const router = useRouter();
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
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Caricamento in corso...</p>
      </div>
    );
  }

  return (
    <CommandMenuProvider>
      <div className="flex h-screen w-full bg-transparent">

        <SidebarNav />
        <SidebarInset className="relative isolate">
          <Header />
          <main className="flex-1 overflow-auto p-4 sm:px-6 sm:py-6">
            {children}
          </main>
          <CommandMenu />
        </SidebarInset>
        <Toaster richColors />
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
  );
}
