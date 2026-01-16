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
import { SoundSettingsButton } from '@/components/sound-settings-button';

import { ThemeSelector } from '@/components/theme-selector';
import { NotificationCenter } from '@/components/notification-center';
import Image from 'next/image';

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

            <div className="flex items-center gap-4">
                <div className="relative flex-1 md:grow-0">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Cerca..."
                        className="w-full rounded-full bg-background pl-8 md:w-[200px] lg:w-[320px]"
                        onFocus={() => setOpen(true)}
                    />
                    <p className="text-xs text-muted-foreground mt-1 ml-2 hidden md:block">Premi ⌘K per la ricerca rapida</p>
                </div>

                <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                    <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                </Button>

                <ThemeSelector />

                <SoundSettingsButton />

                <NotificationCenter
                    trigger={
                        <Button variant="ghost" size="icon" className="relative h-10 w-10">
                            {colorTheme === 'love' ? (
                                <Heart
                                    className={cn(
                                        "h-7 w-7 text-red-500 fill-red-500",
                                        unreadCount > 0 && "animate-pulse"
                                    )}
                                />
                            ) : colorTheme === 'juventus' ? (
                                <div className={cn("relative h-8 w-8", unreadCount > 0 && "animate-pulse")}>
                                    <Image
                                        src={(isClient ? resolvedTheme : theme) === 'dark' ? "/assets/juventus-logo-dark.png" : "/assets/juventus-logo.png"}
                                        alt="Juventus Notifications"
                                        fill
                                        className="object-contain"
                                    />
                                </div>
                            ) : (
                                <div className={cn("text-2xl", unreadCount > 0 && "animate-pulse")}>📬</div>
                            )}
                            {unreadCount > 0 && (
                                <Badge variant="destructive" className="absolute top-0 right-0 h-5 w-5 justify-center p-0 rounded-full">
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
                            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={currentUser?.avatar || ''} alt={currentUser?.name || ''} />
                                    <AvatarFallback style={{ backgroundColor: currentUser?.color }} className="text-white">{currentUser.name ? getInitials(currentUser.name) : '?'}</AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-60">
                            <DropdownMenuLabel>
                                <p className="font-semibold">{currentUser?.name}</p>
                                <p className="text-xs text-muted-foreground font-normal">{currentUser?.email}</p>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {currentUser.role === 'Amministratore' && (
                                <DropdownMenuItem onSelect={() => router.push('/admin')}>
                                    <Settings className="mr-2 h-4 w-4" />
                                    Pannello Admin
                                </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={handleLogout}>
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
