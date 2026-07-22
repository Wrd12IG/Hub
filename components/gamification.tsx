'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import {
    Badge,
    BADGES,
    UserGamification,
    getLevelFromXp,
    getXpProgress,
    getRarityColor,
    formatXp,
    LEVELS,
} from '@/lib/gamification';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Flame, Trophy, Star, Zap, Target, MessageCircle, Award } from 'lucide-react';

// ============================================
// BADGE DISPLAY COMPONENT
// ============================================

interface BadgeDisplayProps {
    badge: Badge;
    unlocked?: boolean;
    size?: 'sm' | 'md' | 'lg';
    showTooltip?: boolean;
}

export function BadgeDisplay({
    badge,
    unlocked = false,
    size = 'md',
    showTooltip = true,
}: BadgeDisplayProps) {
    const sizeClasses = {
        sm: 'w-8 h-8 text-sm',
        md: 'w-12 h-12 text-lg',
        lg: 'w-16 h-16 text-2xl',
    };

    const rarityClasses = {
        common: 'bg-gray-100 dark:bg-gray-800',
        rare: 'bg-blue-100 dark:bg-blue-900/50',
        epic: 'bg-purple-100 dark:bg-purple-900/50',
        legendary: 'bg-amber-100 dark:bg-amber-900/50',
    };

    const BadgeContent = (
        <div
            className={cn(
                'rounded-full flex items-center justify-center transition-all duration-300',
                sizeClasses[size],
                rarityClasses[badge.rarity],
                unlocked ? 'opacity-100 badge-glow' : 'opacity-40 grayscale',
                unlocked && badge.rarity === 'legendary' && 'animate-pulse-slow'
            )}
            style={{
                borderColor: unlocked ? getRarityColor(badge.rarity) : undefined,
                borderWidth: unlocked ? 2 : 0,
            }}
        >
            <span className={cn(!unlocked && 'filter grayscale')}>{badge.icon}</span>
        </div>
    );

    if (!showTooltip) return BadgeContent;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>{BadgeContent}</TooltipTrigger>
                <TooltipContent className="max-w-xs">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold">{badge.name}</span>
                            <span
                                className="text-xs px-1.5 py-0.5 rounded capitalize"
                                style={{ backgroundColor: getRarityColor(badge.rarity), color: 'white' }}
                            >
                                {badge.rarity}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{badge.description}</p>
                        <p className="text-xs">
                            <span className="text-primary">+{badge.xpReward} XP</span>
                        </p>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

// ============================================
// BADGE GRID COMPONENT
// ============================================

interface BadgeGridProps {
    unlockedBadges: string[];
    category?: Badge['category'];
    showLocked?: boolean;
}

export function BadgeGrid({ unlockedBadges, category, showLocked = true }: BadgeGridProps) {
    const badges = category ? BADGES.filter(b => b.category === category) : BADGES;

    return (
        <div className="flex flex-wrap gap-3">
            {badges.map(badge => {
                const isUnlocked = unlockedBadges.includes(badge.id);
                if (!showLocked && !isUnlocked) return null;

                return (
                    <BadgeDisplay
                        key={badge.id}
                        badge={badge}
                        unlocked={isUnlocked}
                        size="md"
                    />
                );
            })}
        </div>
    );
}

// ============================================
// XP PROGRESS BAR
// ============================================

interface XpProgressBarProps {
    xp: number;
    showLabel?: boolean;
    className?: string;
}

export function XpProgressBar({ xp, showLabel = true, className }: XpProgressBarProps) {
    const level = getLevelFromXp(xp);
    const progress = getXpProgress(xp);

    return (
        <div className={cn('space-y-1', className)}>
            {showLabel && (
                <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                        Livello {level.level} - {level.name}
                    </span>
                    <span className="font-medium">
                        {formatXp(progress.current)} / {formatXp(progress.max)} XP
                    </span>
                </div>
            )}
            <div className="xp-bar">
                <div
                    className="xp-bar-fill progress-animated"
                    style={{ width: `${progress.percentage}%` }}
                />
            </div>
        </div>
    );
}

// ============================================
// LEVEL BADGE
// ============================================

interface LevelBadgeProps {
    xp: number;
    size?: 'sm' | 'md' | 'lg';
    showName?: boolean;
}

export function LevelBadge({ xp, size = 'md', showName = false }: LevelBadgeProps) {
    const level = getLevelFromXp(xp);

    const sizeClasses = {
        sm: 'w-6 h-6 text-xs',
        md: 'w-8 h-8 text-sm',
        lg: 'w-10 h-10 text-base',
    };

    return (
        <div className="flex items-center gap-2">
            <div
                className={cn(
                    'level-badge',
                    sizeClasses[size]
                )}
                style={{ background: `linear-gradient(135deg, ${level.color} 0%, ${level.color}cc 100%)` }}
            >
                {level.level}
            </div>
            {showName && (
                <span className="text-sm font-medium">{level.name}</span>
            )}
        </div>
    );
}

// ============================================
// STREAK DISPLAY
// ============================================

interface StreakDisplayProps {
    currentStreak: number;
    longestStreak?: number;
    size?: 'sm' | 'md' | 'lg';
}

export function StreakDisplay({ currentStreak, longestStreak, size = 'md' }: StreakDisplayProps) {
    const sizeClasses = {
        sm: 'text-sm gap-1',
        md: 'text-base gap-2',
        lg: 'text-lg gap-3',
    };

    const iconSizes = {
        sm: 14,
        md: 18,
        lg: 24,
    };

    return (
        <div className={cn('flex items-center', sizeClasses[size])}>
            <Flame
                className={cn('streak-flame', currentStreak > 0 && 'text-orange-500')}
                size={iconSizes[size]}
            />
            <span className="streak-counter">{currentStreak}</span>
            <span className="text-muted-foreground text-xs">giorni</span>
            {longestStreak !== undefined && longestStreak > currentStreak && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger>
                            <span className="text-xs text-muted-foreground ml-2">
                                (max: {longestStreak})
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>Record personale: {longestStreak} giorni</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
    );
}

// ============================================
// LEADERBOARD COMPONENT
// ============================================

interface LeaderboardUser {
    id: string;
    name: string;
    avatar?: string;
    xp: number;
    level: number;
    streak: number;
}

interface LeaderboardProps {
    users: LeaderboardUser[];
    currentUserId?: string;
    limit?: number;
}

export function Leaderboard({ users, currentUserId, limit = 10 }: LeaderboardProps) {
    const sortedUsers = [...users].sort((a, b) => b.xp - a.xp).slice(0, limit);
    const topThree = sortedUsers.slice(0, 3);
    const rest = sortedUsers.slice(3);

    // Order top three as [2nd, 1st, 3rd] for classic podium display on desktop
    const podiumOrder = topThree.length === 3 ? [topThree[1], topThree[0], topThree[2]] : topThree;

    return (
        <div className="space-y-6">
            {/* Top 3 Podium Cards */}
            {topThree.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    {podiumOrder.map((user) => {
                        const rank = sortedUsers.findIndex(u => u.id === user.id) + 1;
                        const isFirst = rank === 1;
                        const isSecond = rank === 2;
                        const isThird = rank === 3;
                        const isCurrentUser = user.id === currentUserId;

                        return (
                            <div
                                key={user.id}
                                className={cn(
                                    "relative rounded-xl p-4 flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-1",
                                    isFirst && "bg-amber-500/10 border-2 border-amber-500/50 shadow-lg shadow-amber-500/10 md:order-2 md:-translate-y-2",
                                    isSecond && "bg-slate-400/10 border border-slate-400/40 md:order-1",
                                    isThird && "bg-amber-700/10 border border-amber-700/40 md:order-3",
                                    isCurrentUser && "ring-2 ring-primary"
                                )}
                            >
                                <div className="absolute -top-3 px-3 py-0.5 rounded-full text-xs font-bold shadow-md bg-background border flex items-center gap-1">
                                    <span>{['🥇 1°', '🥈 2°', '🥉 3°'][rank - 1]}</span>
                                </div>

                                <div className="mt-2 relative">
                                    <LevelBadge xp={user.xp} size={isFirst ? "lg" : "md"} showName={false} />
                                </div>

                                <h4 className={cn("font-bold text-sm mt-2 truncate w-full", isFirst && "text-amber-500 text-base")}>
                                    {user.name}
                                </h4>

                                <div className="mt-1 flex items-center justify-center gap-2">
                                    <span className="text-xs font-mono font-bold text-primary">{formatXp(user.xp)} XP</span>
                                    {user.streak > 0 && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-orange-500/30 text-orange-500">
                                            <Flame className="w-3 h-3 mr-0.5" />
                                            {user.streak}d
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Rest of the leaderboard as sleek cards */}
            {rest.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border/40">
                    {rest.map((user) => {
                        const rank = sortedUsers.findIndex(u => u.id === user.id) + 1;
                        const isCurrentUser = user.id === currentUserId;

                        return (
                            <div
                                key={user.id}
                                className={cn(
                                    'flex items-center gap-3 p-2.5 rounded-lg border bg-card/50 hover:bg-card transition-all',
                                    isCurrentUser && 'bg-primary/10 border-primary/30'
                                )}
                            >
                                <span className="w-6 text-center text-xs font-bold text-muted-foreground">{rank}°</span>
                                <LevelBadge xp={user.xp} size="sm" />
                                <div className="flex-1 min-w-0">
                                    <p className={cn('text-xs font-semibold truncate', isCurrentUser && 'text-primary')}>
                                        {user.name}
                                    </p>
                                    <span className="text-[10px] text-muted-foreground font-mono">{formatXp(user.xp)} XP</span>
                                </div>
                                {user.streak > 0 && (
                                    <span className="flex items-center gap-0.5 text-[10px] text-orange-500 font-semibold shrink-0">
                                        <Flame className="w-3 h-3" />
                                        {user.streak}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ============================================
// USER GAMIFICATION CARD
// ============================================

interface UserGamificationCardProps {
    gamification: UserGamification;
    userName: string;
    className?: string;
}

export function UserGamificationCard({
    gamification,
    userName,
    className,
}: UserGamificationCardProps) {
    const level = getLevelFromXp(gamification.xp);
    const recentBadges = gamification.badges.slice(-3);

    return (
        <div className={cn('glass-card rounded-xl p-4 space-y-4', className)}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <LevelBadge xp={gamification.xp} size="lg" showName />
                </div>
                <StreakDisplay
                    currentStreak={gamification.currentStreak}
                    longestStreak={gamification.longestStreak}
                    size="md"
                />
            </div>

            {/* XP Progress */}
            <XpProgressBar xp={gamification.xp} />

            {/* Recent Badges */}
            {recentBadges.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Badge recenti</h4>
                    <div className="flex gap-2">
                        {recentBadges.map(badgeId => {
                            const badge = BADGES.find(b => b.id === badgeId);
                            if (!badge) return null;
                            return (
                                <BadgeDisplay
                                    key={badgeId}
                                    badge={badge}
                                    unlocked
                                    size="sm"
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                <div className="text-center">
                    <div className="text-lg font-bold">{gamification.stats.tasksCompleted}</div>
                    <div className="text-xs text-muted-foreground">Task</div>
                </div>
                <div className="text-center">
                    <div className="text-lg font-bold">{gamification.badges.length}</div>
                    <div className="text-xs text-muted-foreground">Badge</div>
                </div>
                <div className="text-center">
                    <div className="text-lg font-bold">{gamification.stats.projectsCompleted}</div>
                    <div className="text-xs text-muted-foreground">Progetti</div>
                </div>
            </div>
        </div>
    );
}

// ============================================
// XP GAIN NOTIFICATION
// ============================================

interface XpGainProps {
    amount: number;
    reason?: string;
}

export function XpGain({ amount, reason }: XpGainProps) {
    return (
        <div className="animate-fade-in-up inline-flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-full">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">+{amount} XP</span>
            {reason && <span className="text-xs text-muted-foreground">• {reason}</span>}
        </div>
    );
}

// ============================================
// BADGE UNLOCK ANIMATION
// ============================================

interface BadgeUnlockProps {
    badge: Badge;
    onClose?: () => void;
}

export function BadgeUnlock({ badge, onClose }: BadgeUnlockProps) {
    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 animate-fade-in">
            <div className="glass-card rounded-2xl p-8 text-center space-y-4 animate-scale-in max-w-sm mx-4">
                <div className="text-4xl animate-bounce-subtle">{badge.icon}</div>
                <div>
                    <h3 className="text-xl font-bold gradient-text">Nuovo Badge Sbloccato!</h3>
                    <p className="text-lg font-semibold mt-2">{badge.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">{badge.description}</p>
                </div>
                <div className="flex items-center justify-center gap-2">
                    <span
                        className="px-2 py-0.5 rounded text-xs text-white capitalize"
                        style={{ backgroundColor: getRarityColor(badge.rarity) }}
                    >
                        {badge.rarity}
                    </span>
                    <span className="text-sm font-medium text-primary">+{badge.xpReward} XP</span>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="btn-gradient-primary px-6 py-2 rounded-lg font-medium"
                    >
                        Fantastico!
                    </button>
                )}
            </div>
        </div>
    );
}

// ============================================
// CATEGORY ICONS
// ============================================

export function CategoryIcon({ category, className }: { category: Badge['category']; className?: string }) {
    const icons = {
        speed: Zap,
        quality: Star,
        streak: Flame,
        leadership: Trophy,
        collaboration: MessageCircle,
        expertise: Target,
    };

    const Icon = icons[category];
    return <Icon className={className} />;
}
