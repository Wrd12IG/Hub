'use client';

import { useState, useMemo, useEffect } from 'react';
import { useLayoutData } from '@/app/(app)/layout-context';
import { Bell, Check, CheckCheck, Trash2, ExternalLink, Filter, X, Clock, Briefcase, MessageSquare, Calendar, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { formatDistanceToNow, parseISO, isToday, isYesterday, isThisWeek } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { markNotificationAsRead, markAllNotificationsAsRead, deleteNotification } from '@/lib/actions';
import type { Notification } from '@/lib/data';

// Category configuration with icons and colors
const CATEGORY_CONFIG = {
    task: {
        icon: Clock,
        label: 'Task',
        color: 'bg-blue-500',
        lightColor: 'bg-blue-100 dark:bg-blue-900/30'
    },
    project: {
        icon: Briefcase,
        label: 'Progetti',
        color: 'bg-purple-500',
        lightColor: 'bg-purple-100 dark:bg-purple-900/30'
    },
    chat: {
        icon: MessageSquare,
        label: 'Chat',
        color: 'bg-green-500',
        lightColor: 'bg-green-100 dark:bg-green-900/30'
    },
    absence: {
        icon: Calendar,
        label: 'Assenze',
        color: 'bg-amber-500',
        lightColor: 'bg-amber-100 dark:bg-amber-900/30'
    },
    brief: {
        icon: FileText,
        label: 'Brief',
        color: 'bg-pink-500',
        lightColor: 'bg-pink-100 dark:bg-pink-900/30'
    },
    editorial: {
        icon: FileText,
        label: 'Editoriale',
        color: 'bg-indigo-500',
        lightColor: 'bg-indigo-100 dark:bg-indigo-900/30'
    },
    calendar: {
        icon: Calendar,
        label: 'Calendario',
        color: 'bg-teal-500',
        lightColor: 'bg-teal-100 dark:bg-teal-900/30'
    },
    system: {
        icon: AlertCircle,
        label: 'Sistema',
        color: 'bg-gray-500',
        lightColor: 'bg-gray-100 dark:bg-gray-900/30'
    }
};

// Priority badge config
const PRIORITY_CONFIG = {
    urgent: { label: 'Urgente', className: 'bg-red-500 text-white animate-pulse' },
    high: { label: 'Alta', className: 'bg-orange-500 text-white' },
    normal: { label: 'Normale', className: 'bg-blue-500 text-white' },
    low: { label: 'Bassa', className: 'bg-gray-500 text-white' }
};

// Group notifications by date
function groupByDate(notifications: Notification[]) {
    const groups: { [key: string]: Notification[] } = {
        'Oggi': [],
        'Ieri': [],
        'Questa settimana': [],
        'Precedenti': []
    };

    notifications.forEach(n => {
        const date = parseISO(n.timestamp);
        if (isToday(date)) {
            groups['Oggi'].push(n);
        } else if (isYesterday(date)) {
            groups['Ieri'].push(n);
        } else if (isThisWeek(date)) {
            groups['Questa settimana'].push(n);
        } else {
            groups['Precedenti'].push(n);
        }
    });

    return groups;
}

interface NotificationItemProps {
    notification: Notification;
    onMarkRead: (id: string) => void;
    onDelete: (id: string) => void;
}

function NotificationItem({ notification, onMarkRead, onDelete }: NotificationItemProps) {
    const config = CATEGORY_CONFIG[notification.category as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.system;
    const Icon = config.icon;
    const priority = PRIORITY_CONFIG[notification.priority as keyof typeof PRIORITY_CONFIG];

    return (
        <div
            className={cn(
                "group relative flex gap-3 p-3 rounded-lg transition-all duration-200",
                "hover:bg-muted/50",
                !notification.isRead && "bg-primary/5 border-l-2 border-primary"
            )}
        >
            {/* Icon */}
            <div className={cn(
                "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                config.lightColor
            )}>
                <Icon className={cn("h-5 w-5", !notification.isRead && "text-primary")} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-start justify-between gap-2">
                    <p className={cn(
                        "text-sm line-clamp-2",
                        !notification.isRead && "font-semibold"
                    )}>
                        {notification.title}
                    </p>
                    {priority && notification.priority !== 'normal' && (
                        <Badge className={cn("text-xs px-1.5 py-0.5", priority.className)}>
                            {priority.label}
                        </Badge>
                    )}
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2">
                    {notification.text}
                </p>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                        {config.label}
                    </Badge>
                    <span>•</span>
                    <span>
                        {formatDistanceToNow(parseISO(notification.timestamp), { addSuffix: true, locale: it })}
                    </span>
                </div>
            </div>

            {/* Actions - visible on hover */}
            <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {notification.link && (
                    <Link href={notification.link}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                            <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                    </Link>
                )}
                {!notification.isRead && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onMarkRead(notification.id)}
                    >
                        <Check className="h-3.5 w-3.5" />
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => onDelete(notification.id)}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* Unread dot */}
            {!notification.isRead && (
                <div className="absolute right-2 bottom-2 w-2 h-2 rounded-full bg-primary animate-pulse" />
            )}
        </div>
    );
}

interface NotificationCenterProps {
    trigger?: React.ReactNode;
}

export function NotificationCenter({ trigger }: NotificationCenterProps) {
    const { notifications, currentUser } = useLayoutData();
    const [activeTab, setActiveTab] = useState('all');
    const [isOpen, setIsOpen] = useState(false);

    // Sort notifications by timestamp (newest first)
    const sortedNotifications = useMemo(() => {
        return [...notifications].sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
    }, [notifications]);

    // Filter notifications by category
    const filteredNotifications = useMemo(() => {
        if (activeTab === 'all') return sortedNotifications;
        if (activeTab === 'unread') return sortedNotifications.filter(n => !n.isRead);
        return sortedNotifications.filter(n => n.category === activeTab);
    }, [sortedNotifications, activeTab]);

    // Group by date
    const groupedNotifications = useMemo(() => {
        return groupByDate(filteredNotifications);
    }, [filteredNotifications]);

    // Count unread
    const unreadCount = notifications.filter(n => !n.isRead).length;

    // Count by category
    const categoryCount = useMemo(() => {
        const counts: { [key: string]: number } = {};
        notifications.forEach(n => {
            counts[n.category] = (counts[n.category] || 0) + 1;
        });
        return counts;
    }, [notifications]);

    const handleMarkRead = async (id: string) => {
        if (currentUser) {
            await markNotificationAsRead(currentUser.id, id);
        }
    };

    const handleMarkAllRead = async () => {
        if (currentUser) {
            await markAllNotificationsAsRead(currentUser.id);
        }
    };

    const handleDelete = async (id: string) => {
        if (currentUser) {
            await deleteNotification(currentUser.id, id);
        }
    };

    const defaultTrigger = (
        <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center animate-bounce">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
        </Button>
    );

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                {trigger || defaultTrigger}
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
                <SheetHeader className="p-4 pb-0 border-b">
                    <div className="flex items-center justify-between">
                        <SheetTitle className="flex items-center gap-2">
                            <Bell className="h-5 w-5" />
                            Notifiche
                            {unreadCount > 0 && (
                                <Badge variant="secondary" className="ml-1">
                                    {unreadCount} nuove
                                </Badge>
                            )}
                        </SheetTitle>
                        {unreadCount > 0 && (
                            <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="gap-1">
                                <CheckCheck className="h-4 w-4" />
                                Leggi tutte
                            </Button>
                        )}
                    </div>
                    <SheetDescription>
                        Le tue notifiche più recenti
                    </SheetDescription>
                </SheetHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="mx-4 mt-4 flex-wrap h-auto gap-1 justify-start bg-transparent p-0">
                        <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            Tutte
                        </TabsTrigger>
                        <TabsTrigger value="unread" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            Non lette
                            {unreadCount > 0 && (
                                <span className="ml-1 text-xs">({unreadCount})</span>
                            )}
                        </TabsTrigger>
                        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                            const count = categoryCount[key] || 0;
                            if (count === 0) return null;
                            return (
                                <TabsTrigger
                                    key={key}
                                    value={key}
                                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                                >
                                    {config.label}
                                    <span className="ml-1 text-xs opacity-70">({count})</span>
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>

                    <ScrollArea className="flex-1 mt-4">
                        <div className="px-4 pb-4 space-y-4">
                            {Object.entries(groupedNotifications).map(([date, items]) => {
                                if (items.length === 0) return null;
                                return (
                                    <div key={date}>
                                        <h3 className="text-xs font-medium text-muted-foreground mb-2 sticky top-0 bg-background/95 backdrop-blur-sm py-1">
                                            {date}
                                        </h3>
                                        <div className="space-y-1">
                                            {items.map((notification) => (
                                                <NotificationItem
                                                    key={notification.id}
                                                    notification={notification}
                                                    onMarkRead={handleMarkRead}
                                                    onDelete={handleDelete}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}

                            {filteredNotifications.length === 0 && (
                                <div className="text-center py-12">
                                    <Bell className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                                    <p className="text-muted-foreground font-medium">Nessuna notifica</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {activeTab === 'unread'
                                            ? 'Hai letto tutte le notifiche!'
                                            : 'Le notifiche appariranno qui'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </Tabs>

                <SheetFooter className="p-4 border-t">
                    <p className="text-xs text-muted-foreground text-center w-full">
                        Le notifiche vengono conservate per 30 giorni
                    </p>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}

export default NotificationCenter;
