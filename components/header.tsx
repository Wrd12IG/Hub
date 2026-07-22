'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
    PanelLeft,
    Search,
    Settings,
    LogOut,
    Bell,
    Sun,
    Moon,
    Trash2,
    Briefcase,
    ClipboardList,
    Users,
    Heart,
    Volume2,
    Languages,
    BellRing,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { SidebarNav } from '@/components/sidebar-nav';
import { useLayoutData } from '@/app/(app)/layout-context';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTheme } from 'next-themes';
import { markNotificationsAsRead, deleteReadNotifications } from '@/lib/actions';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn, getInitials } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Notification } from '@/lib/data';
import { useCommandMenu } from '@/components/command-menu';
import { toast } from 'sonner';

import { ThemeSelector } from '@/components/theme-selector';
import { NotificationCenter } from '@/components/notification-center';
import Image from 'next/image';
import { useTranslation } from '@/hooks/useTranslation';

export function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const {
        clientDetails,
        currentUser,
        handleLogout,
        notifications,
    } = useLayoutData();
    const { setTheme, theme, resolvedTheme } = useTheme();
    const [isClient, setIsClient] = useState(false);
    const { setOpen } = useCommandMenu();
    const { language, setLanguage, t } = useTranslation();


    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    const unreadCount = notifications.filter(n => !n.isRead).length;
    const readCount = notifications.filter(n => n.isRead).length;

    const [colorTheme, setColorTheme] = useState<string>('default');

    useEffect(() => {
        setIsClient(true);
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

    const getSegmentLabel = (segment: string, index: number) => {
        if (segments[index - 1] === 'clients' && clientDetails && clientDetails.id === segment) {
            return clientDetails.name;
        }
        return segment.replace('-', ' ');
    }

    const getSegmentPath = (segment: string, index: number) => {
        // If the segment is 'clients', link to the admin page with the clients tab selected
        if (segment === 'clients') {
            return '/admin?tab=clients';
        }
        // Otherwise, build the path incrementally
        return `/${segments.slice(0, index + 1).join('/')}`;
    }
    const segments = pathname.split('/').filter(Boolean).filter(s => s !== 'app');

    const handleMarkAllAsRead = () => {
        if (!currentUser) return;
        const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
        if (unreadIds.length > 0) {
            markNotificationsAsRead(currentUser.id, unreadIds);
        }
    };

    const handleDeleteRead = () => {
        if (!currentUser || readCount === 0) return;
        deleteReadNotifications(currentUser.id);
    }

    const handleNotificationClick = (notification: Notification) => {
        if (!currentUser) return;
        markNotificationsAsRead(currentUser.id, [notification.id]);
        if (notification.link) {
            const correctedLink = notification.link.replace(/^\/app/, '');
            router.push(correctedLink);
        }
    }


    return (
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
            <SidebarTrigger className="sm:hidden" />

            <div className="flex-1">
                <Breadcrumb className="hidden md:flex">
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild>
                                <Link href="/dashboard" className="text-lg">
                                    W<span className="text-yellow-400">[</span><span className="text-foreground">r</span><span className="text-yellow-400">]</span>Digital ® Marketing <span className="text-yellow-400">HUB</span>
                                </Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        {segments.map((segment, index) => (
                            <React.Fragment key={segment}>
                                <BreadcrumbSeparator />
                                <BreadcrumbItem>
                                    {index === segments.length - 1 ? (
                                        <BreadcrumbPage className="capitalize">
                                            {getSegmentLabel(segment, index)}
                                        </BreadcrumbPage>
                                    ) : (
                                        <BreadcrumbLink asChild>
                                            <Link href={getSegmentPath(segment, index)} className="capitalize">
                                                {getSegmentLabel(segment, index)}
                                            </Link>
                                        </BreadcrumbLink>
                                    )}
                                </BreadcrumbItem>
                            </React.Fragment>
                        ))}
                    </BreadcrumbList>
                </Breadcrumb>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
                {/* Search */}
                <div className="relative flex-1 md:grow-0">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Cerca..."
                        className="w-full rounded-full bg-background pl-8 md:w-[200px] lg:w-[300px]"
                        onFocus={() => setOpen(true)}
                    />
                    <p className="text-xs text-muted-foreground mt-1 ml-2 hidden md:block">Premi ⌘K per la ricerca rapida</p>
                </div>

                {/* Theme controls */}
                <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Cambia tema chiaro/scuro">
                    <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                </Button>

                <ThemeSelector />

                {/* Notifications */}
                <NotificationCenter
                    trigger={
                        <Button variant="ghost" size="icon" className="relative h-9 w-9">
                            {colorTheme === 'love' ? (
                                <Heart
                                    className={cn(
                                        "h-6 w-6 text-red-500 fill-red-500",
                                        unreadCount > 0 && "animate-pulse"
                                    )}
                                />
                            ) : colorTheme === 'juventus' ? (
                                <div className={cn("relative h-7 w-7", unreadCount > 0 && "animate-pulse")}>
                                    <Image
                                        src={(isClient ? resolvedTheme : theme) === 'dark' ? "/assets/juventus-logo-dark.png" : "/assets/juventus-logo.png"}
                                        alt="Juventus Notifications"
                                        fill
                                        className="object-contain"
                                    />
                                </div>
                            ) : (
                                <div className={cn("text-xl", unreadCount > 0 && "animate-pulse")}>📬</div>
                            )}
                            {unreadCount > 0 && (
                                <Badge variant="destructive" className="badge-pulse absolute -top-0.5 -right-0.5 h-4 w-4 justify-center p-0 text-[10px] rounded-full">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </Badge>
                            )}
                            <span className="sr-only">Notifiche</span>
                        </Button>
                    }
                />


                {currentUser && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-9 w-9 rounded-full ring-2 ring-transparent hover:ring-primary/30 transition-all duration-200">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={currentUser?.avatar || ''} alt={currentUser?.name || ''} />
                                    <AvatarFallback style={{ backgroundColor: currentUser?.color }} className="text-white text-sm font-semibold">{currentUser.name ? getInitials(currentUser.name) : '?'}</AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64">
                            <DropdownMenuLabel className="pb-2">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={currentUser?.avatar || ''} alt={currentUser?.name || ''} />
                                        <AvatarFallback style={{ backgroundColor: currentUser?.color }} className="text-white font-semibold">{currentUser.name ? getInitials(currentUser.name) : '?'}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-semibold text-sm">{currentUser?.name}</p>
                                        <p className="text-xs text-muted-foreground font-normal">{currentUser?.email}</p>
                                    </div>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {currentUser.role === 'Amministratore' && (
                                <DropdownMenuItem onSelect={() => router.push('/admin')}>
                                    <Settings className="mr-2 h-4 w-4" />
                                    Pannello Admin
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onSelect={() => setLanguage(language === 'it' ? 'en' : 'it')}>
                                <Languages className="mr-2 h-4 w-4" />
                                Lingua: <span className="ml-1 font-bold uppercase">{language}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => {
                                import('@/lib/push-notifications').then(({ PushNotificationManager }) => {
                                    const manager = new PushNotificationManager();
                                    manager.subscribeToPush().then((sub: any) => {
                                        if (sub) toast.success('Notifiche Push attivate con successo!');
                                    });
                                });
                            }}>
                                <BellRing className="mr-2 h-4 w-4" />
                                Attiva Notifiche Push
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={handleLogout} className="text-destructive focus:text-destructive">
                                <LogOut className="mr-2 h-4 w-4" />
                                Logout
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}

            </div>
        </header>
    );
}
