

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
import { RolePermissions } from '@/lib/data';

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
  { href: '/admin/recurring-tasks', icon: Repeat, label: 'Task Ricorrenti', permission: '_create-recurring-projects' },
  { href: '/projects', icon: LayoutGrid, label: 'Progetti' },
  { href: '/admin/recurring-projects', icon: Library, label: 'Progetti Ricorrenti', permission: '_create-recurring-projects' },
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
  { href: '/admin/recurring-tasks', icon: Repeat, label: 'Task Ricorrenti', permission: '_create-recurring-projects' },
  { href: '/admin/recurring-projects', icon: Library, label: 'Progetti Ricorrenti', permission: '_create-recurring-projects' },
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

  // GLOBAL DEBUG LOG - VERSION 1.1.2
  console.log('[SidebarNav] VERSION 1.1.2 - RENDER', {
    hasUser: !!currentUser,
    role: currentUser?.role,
    permsKeys: permissions ? Object.keys(permissions) : 'none',
    isLoading: isLoadingLayout
  });

  const unreadChatCount = useMemo(() => {
    if (!notifications) return 0;
    // Count unread notifications that link to a conversation
    return notifications.filter(n => !n.isRead && n.link?.includes('/chat?conversationId=')).length;
  }, [notifications]);


  // Helper functions for permission checks
  const getRolePermissions = (role: string, perms: RolePermissions) => {
    const normalized = (role || '').trim().toLowerCase();
    if (!normalized) return [];

    // 1. Precise case-insensitive match
    const keys = Object.keys(perms);
    const exactMatchKey = keys.find(k => k.trim().toLowerCase() === normalized);
    if (exactMatchKey) return perms[exactMatchKey];

    // 2. Contains match (e.g. "Project Manager" matches "project manager" or "pm")
    const isPM = normalized.includes('project') && normalized.includes('manager') || normalized === 'pm';
    if (isPM) {
      const pmKey = keys.find(k => {
        const lk = k.toLowerCase().trim();
        return (lk.includes('project') && lk.includes('manager')) || lk === 'pm' || lk === 'project manager';
      });
      if (pmKey) return perms[pmKey];
    }

    return perms[role] || [];
  };

  const visibleNavItems = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'Cliente') {
      return clientNavItems;
    }

    const roleName = (currentUser.role || '').trim();
    const normalizedRole = roleName.toLowerCase();

    if (normalizedRole === 'amministratore' || normalizedRole === 'admin') {
      return allNavItems;
    }

    const userPermissions = getRolePermissions(roleName, permissions);

    // Debug logging for Project Manager visibility issues
    if (normalizedRole.includes('project') || normalizedRole.includes('pm')) {
      console.log('[SidebarNav] Current Role:', roleName);
      console.log('[SidebarNav] Normalized:', normalizedRole);
      console.log('[SidebarNav] Available Perms Keys:', Object.keys(permissions));
      console.log('[SidebarNav] Resolved Perms for Role:', userPermissions);
    }

    return allNavItems.filter(item => {
      const isRecurringItem = item.href.includes('recurring');

      // 1. Permission key match
      if (item.permission && userPermissions.includes(item.permission)) return true;
      // 2. Href match
      if (userPermissions.includes(item.href)) return true;
      // 3. Special case for PM and recurring
      const isPM = (normalizedRole.includes('project') && normalizedRole.includes('manager')) || normalizedRole === 'pm';

      if (isPM && isRecurringItem) {
        const hasActionPerm = userPermissions.includes('_create-recurring-projects');
        const hasHrefPerm = userPermissions.includes(item.href);
        const result = hasActionPerm || hasHrefPerm;
        console.log(`[SidebarNav] Recurring Item Check [${item.label}]:`, { isPM, hasActionPerm, hasHrefPerm, result });
        return result;
      }
      return false;
    });
  }, [currentUser, permissions]);

  const visibleAdminItems = useMemo(() => {
    if (!currentUser) return [];
    const roleName = (currentUser.role || '').trim();
    const normalizedRole = roleName.toLowerCase();

    if (normalizedRole === 'amministratore' || normalizedRole === 'admin') {
      return adminNavItems;
    }

    const userPermissions = getRolePermissions(roleName, permissions);

    return adminNavItems.filter(item => {
      const isPM = (normalizedRole.includes('project') && normalizedRole.includes('manager')) || normalizedRole === 'pm';
      if (isPM && item.href.includes('recurring')) {
        if (userPermissions.includes('_create-recurring-projects') || userPermissions.includes(item.href)) return true;
      }
      if (item.href === '/admin') return userPermissions.includes(item.href);
      const hasPermission = item.permission ? userPermissions.includes(item.permission) : false;
      const hasHrefAccess = userPermissions.includes(item.href);
      return hasPermission || hasHrefAccess;
    });
  }, [currentUser, permissions]);

  const visibleTools = useMemo(() => {
    if (!currentUser) return [];
    const roleName = (currentUser.role || '').trim();
    const normalizedRole = roleName.toLowerCase();
    if (normalizedRole === 'amministratore' || normalizedRole === 'admin') {
      return allTools;
    }
    const userPermissions = getRolePermissions(roleName, permissions);
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
            <h1 className="text-lg font-semibold text-sidebar-foreground font-headline group-data-[state=collapsed]:hidden transition-all duration-200 whitespace-nowrap overflow-hidden flex items-center gap-2">
              <span>W<span className="text-yellow-400">[</span>r<span className="text-yellow-400">]</span>Digital</span>
              <Badge variant="outline" className="text-[10px] py-0 px-1 bg-yellow-400/10 text-yellow-400 border-yellow-400/20">v1.1.2</Badge>
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
