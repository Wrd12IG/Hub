'use client';

import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { LayoutDataProvider } from "./(app)/layout-context";
import { Toaster } from "@/components/ui/toaster";
import { ColorThemeApplier } from "@/components/color-theme-applier";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ColorThemeApplier />
      <SidebarProvider>
        <LayoutDataProvider>
          {children}
          <Toaster />
        </LayoutDataProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}
