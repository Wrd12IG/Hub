

'use client';
import React from 'react';
import {
  Sidebar,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarContent,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Home,
  LayoutGrid,
  ClipboardList,
  Calendar,
  MessageSquare,
  FileText,
  Sliders,
  Settings,
  Rocket,
  LogOut,
  Bot,
  CalendarX2,
  Bell,
  Moon,
  Sun,
  Repeat,
  Newspaper,
  BarChart3,
  KeyRound,
  Mail,
  Send,
  Gauge,
  Upload,
  Library,
  BookOpen,
  Image as ImageIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { useTheme } from 'next-themes';
import { useMemo } from 'react';
import { Skeleton } from './ui/skeleton';
import { useLayoutData } from '@/app/(app)/layout-context';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { AudiIcon, lucideToAudiMap } from './audi-icons';
import { useSiteIcons } from '@/hooks/use-site-icons';

export type NavItem = {
  href: string;
  icon: any;
  label: string;
  permission?: string;
};

export const allNavItems: NavItem[] = [
  // Overview
  { href: '/dashboard', icon: Gauge, label: 'Dashboard' },

  // Lavoro quotidiano
  { href: '/tasks', icon: ClipboardList, label: 'Tasks' },
  { href: '/admin/recurring-tasks', icon: Repeat, label: 'Task Ricorrenti' },
  { href: '/projects', icon: LayoutGrid, label: 'Progetti' },
  { href: '/admin/recurring-projects', icon: Library, label: 'Progetti Ricorrenti' },
  { href: '/briefs', icon: BookOpen, label: 'Briefs' },

  // Pianificazione
  { href: '/calendar', icon: Calendar, label: 'Calendario' },
  { href: '/editorial-plan', icon: Newspaper, label: 'Piano Editoriale' },
  { href: '/absences', icon: CalendarX2, label: 'Assenze' },

  // Comunicazione
  { href: '/chat', icon: MessageSquare, label: 'Chat' },

  // Risorse
  { href: '/documents', icon: FileText, label: 'Documenti' },
  { href: '/assets', icon: ImageIcon, label: 'Media & Assets' },

  // Analytics
  { href: '/reports', icon: BarChart3, label: 'Report' },
];

const adminNavItems: NavItem[] = [
  { href: '/admin', icon: Settings, label: 'Pannello Admin' },
  { href: '/import-editorial', icon: Upload, label: 'Importa Piano' },
];

const clientNavItems = [
  { href: '/briefs', icon: BookOpen, label: 'Briefs' },
  { href: '/documents', icon: FileText, label: 'Documenti' },
]


const allTools: { href: string; icon: any; label: string; }[] = [
];

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { setTheme, theme, resolvedTheme } = useTheme();
  const { currentUser, permissions, isLoadingLayout, handleLogout, notifications } = useLayoutData();
  const { getMainIcon } = useSiteIcons();
  const { } = useSidebar();
  const [colorTheme, setColorTheme] = useState<string>('default');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Initialize color theme
    const savedTheme = localStorage.getItem('color-theme');
    if (savedTheme) setColorTheme(savedTheme);

    // Listen for changes
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setColorTheme(customEvent.detail);
    };

    window.addEventListener('color-theme-change', handleThemeChange);
    return () => window.removeEventListener('color-theme-change', handleThemeChange);
  }, []);

  const currentTheme = mounted ? resolvedTheme : 'light';

  const unreadChatCount = useMemo(() => {
    if (!notifications) return 0;
    // Count unread notifications that link to a conversation
    return notifications.filter(n => !n.isRead && n.link?.includes('/chat?conversationId=')).length;
  }, [notifications]);


  const visibleNavItems = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'Cliente') {
      return clientNavItems;
    }
    if (currentUser.role === 'Amministratore') {
      return allNavItems;
    }
    const userPermissions = permissions[currentUser.role] || [];
    return allNavItems.filter(item => userPermissions.includes(item.href));
  }, [currentUser, permissions]);

  const visibleAdminItems = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'Amministratore') {
      return adminNavItems;
    }
    const userPermissions = permissions[currentUser.role] || [];
    return adminNavItems.filter(item => {
      if (item.href === '/admin') return userPermissions.includes(item.href);
      return item.permission ? userPermissions.includes(item.permission) : false;
    });
  }, [currentUser, permissions]);

  const visibleTools = useMemo(() => {
    if (!currentUser || currentUser.role === 'Amministratore') {
      return allTools;
    }
    const userPermissions = permissions[currentUser.role] || [];
    return allTools.filter(item => userPermissions.includes(item.href));
  }, [currentUser, permissions]);


  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {colorTheme === 'juventus' ? (
              <div className="relative w-12 h-12 flex-shrink-0">
                <Image
                  key={`${colorTheme}-${currentTheme}`}
                  src="/assets/juventus-logo-dark.png"
                  alt="Juventus Logo"
                  fill
                  sizes="48px"
                  className="object-contain"
                  priority
                />
              </div>
            ) : colorTheme === 'audi' ? (
              <div className="relative w-12 h-12 flex-shrink-0">
                <Image
                  key={`audi-logo-${currentTheme}`}
                  src={currentTheme === 'dark' ? "/assets/audi-logo-light.png" : "/assets/audi-logo-dark.png"}
                  alt="Audi Logo"
                  fill
                  sizes="48px"
                  className="object-contain"
                  priority
                />
              </div>
            ) : (
              <div className="relative w-12 h-12 flex-shrink-0">
                <Image
                  key={`wr-logo-${currentTheme}`}
                  src={getMainIcon()}
                  alt="W[r]Digital Logo"
                  fill
                  sizes="48px"
                  className="object-contain"
                  priority
                  unoptimized
                />
              </div>
            )}
            <h1 className="text-lg font-semibold text-sidebar-foreground font-headline group-data-[state=collapsed]:hidden transition-all duration-200 whitespace-nowrap overflow-hidden">
              W<span className="text-yellow-400">[</span>r<span className="text-yellow-400">]</span>Digital
            </h1>
          </div>
          <SidebarTrigger className="group-data-[state=collapsed]:hidden" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarMenu>
            {visibleNavItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} prefetch={true}>
                  <SidebarMenuButton
                    isActive={pathname.startsWith(item.href)}
                    tooltip={item.label}
                  >
                    <div className="relative flex-shrink-0">
                      {colorTheme === 'audi' ? (
                        <AudiIcon name={lucideToAudiMap[item.icon.displayName || item.icon.name] || 'default'} className="h-5 w-5 flex-shrink-0" />
                      ) : (
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                      )}
                      {item.label === 'Chat' && unreadChatCount > 0 && (
                        <Badge className="absolute -top-2 -right-2 h-4 w-4 justify-center p-0 text-[10px]">{unreadChatCount}</Badge>
                      )}
                    </div>
                    <span className="group-data-[state=collapsed]:hidden truncate">{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {visibleTools.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>AI Tools</SidebarGroupLabel>
            <SidebarMenu>
              {visibleTools.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <Link href={item.href} prefetch={true}>
                    <SidebarMenuButton
                      isActive={pathname.startsWith(item.href)}
                      tooltip={item.label}
                    >
                      {colorTheme === 'audi' ? (
                        <AudiIcon name={lucideToAudiMap[item.icon.displayName || item.icon.name] || 'default'} className="h-5 w-5 flex-shrink-0" />
                      ) : (
                        <item.icon className="h-5 w-5 flex-shrink-0 text-white/90" />
                      )}
                      <span className="group-data-[state=collapsed]:hidden truncate">{item.label}</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {visibleAdminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Impostazioni</SidebarGroupLabel>
            <SidebarMenu>
              {visibleAdminItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <Link href={item.href} prefetch={true}>
                    <SidebarMenuButton
                      isActive={pathname.startsWith(item.href)}
                      tooltip={item.label}
                    >
                      {colorTheme === 'audi' ? (
                        <AudiIcon name={lucideToAudiMap[item.icon.displayName || item.icon.name] || 'default'} className="h-5 w-5 flex-shrink-0" />
                      ) : (
                        <item.icon className="h-5 w-5 flex-shrink-0 text-white/90" />
                      )}
                      <span className="group-data-[state=collapsed]:hidden truncate">{item.label}</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        {isLoadingLayout && (
          <div className="flex items-center justify-center">
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        )}
        {!isLoadingLayout && (
          <div className="flex items-center justify-center">
            <SidebarTrigger />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
