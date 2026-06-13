'use client';

import { usePresenceList, useResourceViewers, UserPresence } from '@/lib/presence';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, getInitials } from '@/lib/utils';
import { Eye, MessageSquare } from 'lucide-react';

// Status indicator colors
const STATUS_COLORS = {
    online: 'bg-green-500',
    idle: 'bg-amber-500',
    away: 'bg-gray-400'
};

interface PresenceAvatarProps {
    presence: UserPresence;
    size?: 'sm' | 'md' | 'lg';
    showStatus?: boolean;
}

export function PresenceAvatar({ presence, size = 'md', showStatus = true }: PresenceAvatarProps) {
    const sizeClasses = {
        sm: 'h-6 w-6 text-xs',
        md: 'h-8 w-8 text-sm',
        lg: 'h-10 w-10 text-base'
    };

    const statusSizeClasses = {
        sm: 'h-2 w-2 -bottom-0.5 -right-0.5',
        md: 'h-2.5 w-2.5 -bottom-0.5 -right-0.5',
        lg: 'h-3 w-3 -bottom-0.5 -right-0.5'
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="relative inline-flex">
                        <Avatar
                            className={cn(
                                sizeClasses[size],
                                "border-2 border-background ring-2 ring-background",
                                presence.isTyping && "ring-primary animate-pulse"
                            )}
                            style={{
                                backgroundColor: presence.userColor || 'hsl(var(--muted))'
                            }}
                        >
                            <AvatarFallback
                                className="font-medium"
                                style={{ color: 'white' }}
                            >
                                {getInitials(presence.userName)}
                            </AvatarFallback>
                        </Avatar>
                        {showStatus && (
                            <span
                                className={cn(
                                    "absolute rounded-full border-2 border-background",
                                    statusSizeClasses[size],
                                    STATUS_COLORS[presence.status],
                                    presence.isTyping && "animate-pulse"
                                )}
                            />
                        )}
                    </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                    <div className="space-y-1">
                        <p className="font-medium">{presence.userName}</p>
                        <p className="text-muted-foreground">
                            {presence.status === 'online' ? '🟢 Online' :
                                presence.status === 'idle' ? '🟡 Inattivo' :
                                    '⚪ Assente'}
                        </p>
                        {presence.isTyping && (
                            <p className="text-primary flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                Sta scrivendo...
                            </p>
                        )}
                        <p className="text-muted-foreground flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {presence.currentPage}
                        </p>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

interface PresenceAvatarGroupProps {
    presenceList?: UserPresence[];
    resourceType?: string;
    resourceId?: string;
    max?: number;
    size?: 'sm' | 'md' | 'lg';
}

export function PresenceAvatarGroup({
    presenceList: externalList,
    resourceType,
    resourceId,
    max = 5,
    size = 'sm'
}: PresenceAvatarGroupProps) {
    // Use either provided list or fetch based on resource
    const allPresence = usePresenceList();
    const resourceViewers = resourceType && resourceId
        ? useResourceViewers(resourceType, resourceId)
        : [];

    const presenceList = externalList || (resourceType && resourceId ? resourceViewers : allPresence);

    if (presenceList.length === 0) return null;

    const visibleUsers = presenceList.slice(0, max);
    const remainingCount = presenceList.length - max;

    return (
        <div className="flex items-center -space-x-2">
            {visibleUsers.map((presence) => (
                <PresenceAvatar
                    key={presence.id}
                    presence={presence}
                    size={size}
                />
            ))}
            {remainingCount > 0 && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div
                                className={cn(
                                    "relative inline-flex items-center justify-center rounded-full bg-muted border-2 border-background text-muted-foreground font-medium",
                                    size === 'sm' && "h-6 w-6 text-xs",
                                    size === 'md' && "h-8 w-8 text-sm",
                                    size === 'lg' && "h-10 w-10 text-base"
                                )}
                            >
                                +{remainingCount}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <ul className="text-xs space-y-1">
                                {presenceList.slice(max).map((p) => (
                                    <li key={p.id}>{p.userName}</li>
                                ))}
                            </ul>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
    );
}

interface TypingIndicatorProps {
    typingUsers: UserPresence[];
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
    if (typingUsers.length === 0) return null;

    const names = typingUsers.map(u => u.userName.split(' ')[0]);
    let message: string;

    if (names.length === 1) {
        message = `${names[0]} sta scrivendo`;
    } else if (names.length === 2) {
        message = `${names[0]} e ${names[1]} stanno scrivendo`;
    } else {
        message = `${names[0]} e altri ${names.length - 1} stanno scrivendo`;
    }

    return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
            <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>{message}</span>
        </div>
    );
}

interface OnlineIndicatorProps {
    isOnline: boolean;
    size?: 'sm' | 'md' | 'lg';
}

export function OnlineIndicator({ isOnline, size = 'sm' }: OnlineIndicatorProps) {
    const sizeClasses = {
        sm: 'h-2 w-2',
        md: 'h-2.5 w-2.5',
        lg: 'h-3 w-3'
    };

    return (
        <span
            className={cn(
                "rounded-full",
                sizeClasses[size],
                isOnline ? 'bg-green-500' : 'bg-gray-400',
                isOnline && 'animate-pulse'
            )}
        />
    );
}

/**
 * Component to show who else is viewing a specific resource
 */
interface ResourceViewersProps {
    resourceType: 'task' | 'project' | 'brief' | 'document' | 'chat';
    resourceId: string;
    label?: string;
}

export function ResourceViewers({ resourceType, resourceId, label }: ResourceViewersProps) {
    const viewers = useResourceViewers(resourceType, resourceId);

    if (viewers.length === 0) return null;

    return (
        <div className="flex items-center gap-2">
            {label && (
                <span className="text-xs text-muted-foreground">{label}</span>
            )}
            <PresenceAvatarGroup
                presenceList={viewers}
                size="sm"
                max={3}
            />
            <span className="text-xs text-muted-foreground">
                {viewers.length === 1
                    ? 'sta visualizzando'
                    : `stanno visualizzando`}
            </span>
        </div>
    );
}
