

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
  Building2,
  Search,
  Briefcase,
  Youtube,
  Music,
  Linkedin,
  Instagram,
  Facebook
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
import { useMemo, useState, useEffect } from 'react';
import { Skeleton } from './ui/skeleton';
import { useLayoutData } from '@/app/(app)/layout-context';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import Image from 'next/image';
import { AudiIcon, lucideToAudiMap } from './audi-icons';
import { useSiteIcons } from '@/hooks/use-site-icons';
import { RolePermissions } from '@/lib/data';
import ClientSwitcher from './ClientSwitcher';

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
  { href: '/social-strategies', icon: Bot, label: 'Strategie Social' },
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
  const { toggle: toggleSidebar } = useSidebar();
  const [colorTheme, setColorTheme] = useState<string>('default');
  const [mounted, setMounted] = useState(false);
  
  const clientMatch = pathname.match(/^\/clients\/([^/]+)/);
  const activeClientId = clientMatch ? clientMatch[1] : null;

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
              <div className="relative w-12 h-12 flex-shrink-0 group-data-[state=collapsed]:w-8 group-data-[state=collapsed]:h-8 transition-all duration-200">
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
              <div className="relative w-12 h-12 flex-shrink-0 group-data-[state=collapsed]:w-8 group-data-[state=collapsed]:h-8 transition-all duration-200">
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
              <div className="relative w-12 h-12 flex-shrink-0 group-data-[state=collapsed]:w-8 group-data-[state=collapsed]:h-8 transition-all duration-200">
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
              <Badge variant="outline" className="text-[10px] py-0 px-1 bg-yellow-400/10 text-yellow-400 border-yellow-400/20">v1.1.3</Badge>
            </h1>
          </div>
          <SidebarTrigger />
        </div>
      </SidebarHeader>
      
      {/* BRAND SWITCHER */}
      <div className="px-3 pt-4 pb-2 group-data-[state=collapsed]:hidden">
        <ClientSwitcher />
      </div>
      {/* MINI BRAND SWITCHER FOR COLLAPSED STATE */}
      <div className="px-3 pt-4 pb-2 hidden group-data-[state=collapsed]:flex justify-center">
        <div onClick={toggleSidebar} className="h-8 w-8 rounded-md bg-sidebar-accent flex items-center justify-center cursor-pointer" title="Espandi la sidebar per selezionare il cliente">
          <Briefcase className="h-4 w-4 text-sidebar-foreground/70" />
        </div>
      </div>

      <SidebarContent>
        {activeClientId ? (
          /* =========================================
             VISTA CLIENTE (METRICOOL PARADIGM)
             ========================================= */
          <>
            <SidebarGroup>
              <SidebarGroupLabel>Operatività & Hub</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <Link href={`/clients/${activeClientId}`} prefetch={true}>
                    <SidebarMenuButton isActive={pathname === `/clients/${activeClientId}`} tooltip="Overview Cliente">
                      <Gauge className="h-5 w-5 flex-shrink-0" />
                      <span className="group-data-[state=collapsed]:hidden truncate">Overview Cliente</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href={`/clients/${activeClientId}/tasks`} prefetch={true}>
                    <SidebarMenuButton isActive={pathname.startsWith(`/clients/${activeClientId}/tasks`)} tooltip="Task">
                      <ClipboardList className="h-5 w-5 flex-shrink-0" />
                      <span className="group-data-[state=collapsed]:hidden truncate">Task</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href={`/clients/${activeClientId}/projects`} prefetch={true}>
                    <SidebarMenuButton isActive={pathname.startsWith(`/clients/${activeClientId}/projects`)} tooltip="Progetti">
                      <LayoutGrid className="h-5 w-5 flex-shrink-0" />
                      <span className="group-data-[state=collapsed]:hidden truncate">Progetti</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Canali Marketing</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <Link href={`/clients/${activeClientId}/calendar`} prefetch={true}>
                    <SidebarMenuButton isActive={pathname.startsWith(`/clients/${activeClientId}/calendar`)} tooltip="Piano Editoriale">
                      <Newspaper className="h-5 w-5 flex-shrink-0" />
                      <span className="group-data-[state=collapsed]:hidden truncate">Piano Editoriale</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href={`/clients/${activeClientId}/meta-ads`} prefetch={true}>
                    <SidebarMenuButton isActive={pathname.startsWith(`/clients/${activeClientId}/meta-ads`)} tooltip="Meta Ads">
                      <Bot className="h-5 w-5 flex-shrink-0" />
                      <span className="group-data-[state=collapsed]:hidden truncate">Meta Ads</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href={`/clients/${activeClientId}/google-ads`} prefetch={true}>
                    <SidebarMenuButton isActive={pathname.startsWith(`/clients/${activeClientId}/google-ads`)} tooltip="Google Ads">
                      <Search className="h-5 w-5 flex-shrink-0" />
                      <span className="group-data-[state=collapsed]:hidden truncate">Google Ads</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href={`/clients/${activeClientId}/youtube`} prefetch={true}>
                    <SidebarMenuButton isActive={pathname.startsWith(`/clients/${activeClientId}/youtube`)} tooltip="YouTube">
                      <Youtube className="h-5 w-5 flex-shrink-0" />
                      <span className="group-data-[state=collapsed]:hidden truncate">YouTube</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href={`/clients/${activeClientId}/tiktok`} prefetch={true}>
                    <SidebarMenuButton isActive={pathname.startsWith(`/clients/${activeClientId}/tiktok`)} tooltip="TikTok">
                      <Music className="h-5 w-5 flex-shrink-0" />
                      <span className="group-data-[state=collapsed]:hidden truncate">TikTok</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href={`/clients/${activeClientId}/linkedin`} prefetch={true}>
                    <SidebarMenuButton isActive={pathname.startsWith(`/clients/${activeClientId}/linkedin`)} tooltip="LinkedIn">
                      <Linkedin className="h-5 w-5 flex-shrink-0" />
                      <span className="group-data-[state=collapsed]:hidden truncate">LinkedIn</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href={`/clients/${activeClientId}/instagram`} prefetch={true}>
                    <SidebarMenuButton isActive={pathname.startsWith(`/clients/${activeClientId}/instagram`)} tooltip="Instagram">
                      <Instagram className="h-5 w-5 flex-shrink-0" />
                      <span className="group-data-[state=collapsed]:hidden truncate">Instagram</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href={`/clients/${activeClientId}/facebook`} prefetch={true}>
                    <SidebarMenuButton isActive={pathname.startsWith(`/clients/${activeClientId}/facebook`)} tooltip="Facebook">
                      <Facebook className="h-5 w-5 flex-shrink-0" />
                      <span className="group-data-[state=collapsed]:hidden truncate">Facebook</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href={`/clients/${activeClientId}/gbp`} prefetch={true}>
                    <SidebarMenuButton isActive={pathname.startsWith(`/clients/${activeClientId}/gbp`)} tooltip="Profilo GBP">
                      <Building2 className="h-5 w-5 flex-shrink-0" />
                      <span className="group-data-[state=collapsed]:hidden truncate">Profilo GBP</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>AI & Automation</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <Link href={`/clients/${activeClientId}/ads-automation`} prefetch={true}>
                    <SidebarMenuButton isActive={pathname.startsWith(`/clients/${activeClientId}/ads-automation`)} tooltip="Automazione Ads">
                      <Sliders className="h-5 w-5 flex-shrink-0" />
                      <span className="group-data-[state=collapsed]:hidden truncate">Automazione Ads</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </>
        ) : (
          /* =========================================
             VISTA GLOBALE (AGENZIA)
             ========================================= */
          <>
            <SidebarGroup>
              <SidebarGroupLabel>Menu Globale</SidebarGroupLabel>
              <SidebarMenu>
                {visibleNavItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <Link href={item.href} prefetch={true}>
                      <SidebarMenuButton
                        isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))}
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
          </>
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
