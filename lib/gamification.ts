// Gamification System for WRDigital HUB
// Sistema di badge, XP, livelli e streak

export interface Badge {
    id: string;
    name: string;
    description: string;
    icon: string; // Emoji o nome icona Lucide
    category: 'speed' | 'quality' | 'streak' | 'leadership' | 'collaboration' | 'expertise';
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    xpReward: number;
    requirement: BadgeRequirement;
    unlockedAt?: Date;
}

export interface BadgeRequirement {
    type: 'task_count' | 'approval_rate' | 'streak_days' | 'project_count' | 'messages' | 'on_time_rate';
    value: number;
    period?: 'daily' | 'weekly' | 'monthly' | 'all_time';
}

export interface UserGamification {
    userId: string;
    xp: number;
    level: number;
    badges: string[]; // Array di badge IDs
    currentStreak: number;
    longestStreak: number;
    lastActivityDate?: Date;
    stats: UserStats;
}

export interface UserStats {
    tasksCompleted: number;
    tasksApprovedFirstTry: number;
    tasksCompletedOnTime: number;
    projectsCompleted: number;
    messagesSent: number;
    totalWorkHours: number;
}

// Definizione livelli
export const LEVELS = [
    { level: 1, name: 'Rookie', minXp: 0, maxXp: 100, color: '#9ca3af' },
    { level: 2, name: 'Junior', minXp: 101, maxXp: 300, color: '#22c55e' },
    { level: 3, name: 'Specialist', minXp: 301, maxXp: 600, color: '#3b82f6' },
    { level: 4, name: 'Expert', minXp: 601, maxXp: 1000, color: '#a855f7' },
    { level: 5, name: 'Master', minXp: 1001, maxXp: 2000, color: '#f59e0b' },
    { level: 6, name: 'Legend', minXp: 2001, maxXp: Infinity, color: '#ef4444' },
] as const;

// Definizione badge
export const BADGES: Badge[] = [
    // Speed badges
    {
        id: 'speed_demon',
        name: 'Speed Demon',
        description: 'Completa 10 task in anticipo rispetto alla deadline',
        icon: '⚡',
        category: 'speed',
        rarity: 'common',
        xpReward: 50,
        requirement: { type: 'on_time_rate', value: 10, period: 'all_time' },
    },
    {
        id: 'time_master',
        name: 'Time Master',
        description: 'Completa 50 task in anticipo',
        icon: '⏰',
        category: 'speed',
        rarity: 'rare',
        xpReward: 150,
        requirement: { type: 'on_time_rate', value: 50, period: 'all_time' },
    },
    {
        id: 'lightning_bolt',
        name: 'Lightning Bolt',
        description: 'Completa 100 task in anticipo',
        icon: '🔥',
        category: 'speed',
        rarity: 'epic',
        xpReward: 300,
        requirement: { type: 'on_time_rate', value: 100, period: 'all_time' },
    },

    // Quality badges
    {
        id: 'perfectionist',
        name: 'Perfezionista',
        description: '10 task approvati al primo tentativo',
        icon: '✨',
        category: 'quality',
        rarity: 'common',
        xpReward: 50,
        requirement: { type: 'approval_rate', value: 10, period: 'all_time' },
    },
    {
        id: 'flawless',
        name: 'Impeccabile',
        description: '50 task approvati al primo tentativo',
        icon: '💎',
        category: 'quality',
        rarity: 'rare',
        xpReward: 150,
        requirement: { type: 'approval_rate', value: 50, period: 'all_time' },
    },
    {
        id: 'quality_king',
        name: 'Re della Qualità',
        description: '100 task approvati al primo tentativo',
        icon: '👑',
        category: 'quality',
        rarity: 'legendary',
        xpReward: 500,
        requirement: { type: 'approval_rate', value: 100, period: 'all_time' },
    },

    // Streak badges
    {
        id: 'on_fire',
        name: 'On Fire!',
        description: '3 giorni consecutivi di attività',
        icon: '🔥',
        category: 'streak',
        rarity: 'common',
        xpReward: 30,
        requirement: { type: 'streak_days', value: 3 },
    },
    {
        id: 'unstoppable',
        name: 'Inarrestabile',
        description: '7 giorni consecutivi di attività',
        icon: '🚀',
        category: 'streak',
        rarity: 'rare',
        xpReward: 100,
        requirement: { type: 'streak_days', value: 7 },
    },
    {
        id: 'marathon_runner',
        name: 'Maratoneta',
        description: '30 giorni consecutivi di attività',
        icon: '🏃',
        category: 'streak',
        rarity: 'epic',
        xpReward: 300,
        requirement: { type: 'streak_days', value: 30 },
    },
    {
        id: 'legend',
        name: 'Leggenda',
        description: '100 giorni consecutivi di attività',
        icon: '🏆',
        category: 'streak',
        rarity: 'legendary',
        xpReward: 1000,
        requirement: { type: 'streak_days', value: 100 },
    },

    // Leadership badges
    {
        id: 'contributor',
        name: 'Contributore',
        description: 'Completa 25 task',
        icon: '📝',
        category: 'leadership',
        rarity: 'common',
        xpReward: 50,
        requirement: { type: 'task_count', value: 25, period: 'all_time' },
    },
    {
        id: 'workhorse',
        name: 'Stacanovista',
        description: 'Completa 100 task',
        icon: '💪',
        category: 'leadership',
        rarity: 'rare',
        xpReward: 200,
        requirement: { type: 'task_count', value: 100, period: 'all_time' },
    },
    {
        id: 'mvp',
        name: 'MVP',
        description: 'Completa 500 task',
        icon: '⭐',
        category: 'leadership',
        rarity: 'legendary',
        xpReward: 1000,
        requirement: { type: 'task_count', value: 500, period: 'all_time' },
    },

    // Collaboration badges
    {
        id: 'team_player',
        name: 'Team Player',
        description: 'Invia 50 messaggi nella chat',
        icon: '💬',
        category: 'collaboration',
        rarity: 'common',
        xpReward: 30,
        requirement: { type: 'messages', value: 50, period: 'all_time' },
    },
    {
        id: 'communicator',
        name: 'Comunicatore',
        description: 'Invia 200 messaggi nella chat',
        icon: '📢',
        category: 'collaboration',
        rarity: 'rare',
        xpReward: 100,
        requirement: { type: 'messages', value: 200, period: 'all_time' },
    },

    // Expertise badges
    {
        id: 'project_starter',
        name: 'Project Starter',
        description: 'Partecipa a 5 progetti completati',
        icon: '📁',
        category: 'expertise',
        rarity: 'common',
        xpReward: 50,
        requirement: { type: 'project_count', value: 5, period: 'all_time' },
    },
    {
        id: 'project_master',
        name: 'Project Master',
        description: 'Partecipa a 20 progetti completati',
        icon: '🎯',
        category: 'expertise',
        rarity: 'epic',
        xpReward: 250,
        requirement: { type: 'project_count', value: 20, period: 'all_time' },
    },
];

// XP rewards per azione
export const XP_REWARDS = {
    taskCompleted: 10,
    taskApprovedFirstTry: 25,
    taskCompletedOnTime: 15,
    projectCompleted: 50,
    messageSent: 1,
    badgeUnlocked: 0, // Definito nel badge stesso
    dailyLogin: 5,
    streakBonus: 2, // Moltiplicatore per giorno di streak
} as const;

// Funzioni utility

export function getLevelFromXp(xp: number): typeof LEVELS[number] {
    return LEVELS.find(l => xp >= l.minXp && xp <= l.maxXp) || LEVELS[LEVELS.length - 1];
}

export function getXpProgress(xp: number): { current: number; max: number; percentage: number } {
    const level = getLevelFromXp(xp);
    const current = xp - level.minXp;
    const max = level.maxXp === Infinity ? level.minXp + 1000 : level.maxXp - level.minXp;
    const percentage = Math.min((current / max) * 100, 100);
    return { current, max, percentage };
}

export function getBadgesByCategory(category: Badge['category']): Badge[] {
    return BADGES.filter(b => b.category === category);
}

export function getRarityColor(rarity: Badge['rarity']): string {
    switch (rarity) {
        case 'common': return '#9ca3af';
        case 'rare': return '#3b82f6';
        case 'epic': return '#a855f7';
        case 'legendary': return '#f59e0b';
        default: return '#9ca3af';
    }
}

export function calculateStreakBonus(streak: number): number {
    if (streak < 3) return 0;
    if (streak < 7) return 5;
    if (streak < 14) return 10;
    if (streak < 30) return 20;
    return 50;
}

export function checkBadgeUnlock(stats: UserStats, streak: number): Badge[] {
    const unlockedBadges: Badge[] = [];

    for (const badge of BADGES) {
        let achieved = false;

        switch (badge.requirement.type) {
            case 'task_count':
                achieved = stats.tasksCompleted >= badge.requirement.value;
                break;
            case 'approval_rate':
                achieved = stats.tasksApprovedFirstTry >= badge.requirement.value;
                break;
            case 'streak_days':
                achieved = streak >= badge.requirement.value;
                break;
            case 'project_count':
                achieved = stats.projectsCompleted >= badge.requirement.value;
                break;
            case 'messages':
                achieved = stats.messagesSent >= badge.requirement.value;
                break;
            case 'on_time_rate':
                achieved = stats.tasksCompletedOnTime >= badge.requirement.value;
                break;
        }

        if (achieved) {
            unlockedBadges.push(badge);
        }
    }

    return unlockedBadges;
}

// Funzione per formattare XP
export function formatXp(xp: number): string {
    if (xp >= 1000000) return `${(xp / 1000000).toFixed(1)}M`;
    if (xp >= 1000) return `${(xp / 1000).toFixed(1)}K`;
    return xp.toString();
}

// Funzione per calcolare rank in classifica
export function calculateRank(userXp: number, allUsersXp: number[]): number {
    const sorted = [...allUsersXp].sort((a, b) => b - a);
    return sorted.findIndex(xp => xp === userXp) + 1;
}
