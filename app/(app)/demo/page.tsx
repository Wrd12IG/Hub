'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkline, SparklineTrend, KpiSparkline } from '@/components/sparkline';
import { useCountUpInt, useCountUpPercent } from '@/hooks';
import {
    BadgeDisplay,
    BadgeGrid,
    XpProgressBar,
    LevelBadge,
    StreakDisplay,
    Leaderboard,
    UserGamificationCard,
    XpGain,
    BadgeUnlock,
} from '@/components/gamification';
import { BADGES, UserGamification, UserStats } from '@/lib/gamification';
import { TrendingUp, TrendingDown, Users, CheckCircle, Clock, Zap } from 'lucide-react';

// Mock data per la demo
const mockSparklineData = [12, 19, 15, 25, 22, 30, 28, 35, 32, 40, 38, 45];
const mockSparklineData2 = [45, 42, 38, 35, 32, 30, 28, 25, 22, 20, 18, 15];

const mockGamification: UserGamification = {
    userId: 'demo-user',
    xp: 750,
    level: 4,
    badges: ['speed_demon', 'perfectionist', 'on_fire', 'contributor'],
    currentStreak: 12,
    longestStreak: 25,
    lastActivityDate: new Date(),
    stats: {
        tasksCompleted: 87,
        tasksApprovedFirstTry: 62,
        tasksCompletedOnTime: 71,
        projectsCompleted: 8,
        messagesSent: 234,
        totalWorkHours: 412,
    },
};

const mockLeaderboard = [
    { id: '1', name: 'Marco Rossi', xp: 2150, level: 6, streak: 45 },
    { id: '2', name: 'Laura Bianchi', xp: 1820, level: 5, streak: 23 },
    { id: '3', name: 'Giuseppe Verdi', xp: 1450, level: 5, streak: 12 },
    { id: '4', name: 'Anna Ferrari', xp: 980, level: 4, streak: 8 },
    { id: '5', name: 'Tu', xp: 750, level: 4, streak: 12 },
];

export default function DemoPage() {
    const [showBadgeUnlock, setShowBadgeUnlock] = useState(false);

    // Animazioni count-up
    const tasksCount = useCountUpInt(156);
    const completionRate = useCountUpPercent(87.5);
    const hoursWorked = useCountUpInt(412);

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-8">
            <div className="max-w-7xl mx-auto space-y-12">
                {/* Header */}
                <div className="text-center space-y-4">
                    <h1 className="text-4xl font-bold gradient-text">
                        🎨 Demo Nuovi Stili Premium
                    </h1>
                    <p className="text-muted-foreground max-w-2xl mx-auto">
                        Questa pagina mostra tutti i nuovi elementi visivi: glassmorphism, gradient buttons,
                        animazioni count-up, sparkline e il sistema di gamification.
                    </p>
                </div>

                {/* SEZIONE 1: Glassmorphism Cards */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold">✨ Glassmorphism Cards</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Glass Card Base */}
                        <div className="glass-card rounded-xl p-6 space-y-2">
                            <div className="text-4xl">🎯</div>
                            <h3 className="font-semibold">Glass Card Base</h3>
                            <p className="text-sm text-muted-foreground">
                                Effetto vetro con blur e bordi luminosi
                            </p>
                        </div>

                        {/* Glass Card Primary */}
                        <div className="glass-card glass-card-primary rounded-xl p-6 space-y-2">
                            <div className="text-4xl">💜</div>
                            <h3 className="font-semibold">Glass Primary</h3>
                            <p className="text-sm text-muted-foreground">
                                Variante con sfumatura viola
                            </p>
                        </div>

                        {/* Glass Card Success */}
                        <div className="glass-card glass-card-success rounded-xl p-6 space-y-2">
                            <div className="text-4xl">💚</div>
                            <h3 className="font-semibold">Glass Success</h3>
                            <p className="text-sm text-muted-foreground">
                                Variante con sfumatura verde
                            </p>
                        </div>

                        {/* Glass Card Warning */}
                        <div className="glass-card glass-card-warning rounded-xl p-6 space-y-2">
                            <div className="text-4xl">🧡</div>
                            <h3 className="font-semibold">Glass Warning</h3>
                            <p className="text-sm text-muted-foreground">
                                Variante con sfumatura arancione
                            </p>
                        </div>
                    </div>
                </section>

                {/* SEZIONE 2: Gradient Buttons */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold">🎨 Gradient Buttons</h2>

                    <div className="flex flex-wrap gap-4">
                        <button className="btn-gradient-primary px-6 py-3 rounded-lg font-medium">
                            Primary Gradient
                        </button>
                        <button className="btn-gradient-success px-6 py-3 rounded-lg font-medium">
                            Success Gradient
                        </button>
                        <button className="btn-gradient-warning px-6 py-3 rounded-lg font-medium">
                            Warning Gradient
                        </button>
                        <button className="btn-gradient-dark px-6 py-3 rounded-lg font-medium">
                            Dark Gradient
                        </button>
                        <button className="btn-gradient-gold px-6 py-3 rounded-lg font-medium">
                            Gold Gradient ✨
                        </button>
                    </div>
                </section>

                {/* SEZIONE 3: Count-Up Animations */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold">🔢 Animazioni Count-Up</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="glass-card kpi-card rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <CheckCircle className="w-5 h-5 text-primary" />
                                </div>
                                <span className="text-sm text-muted-foreground">Task Completati</span>
                            </div>
                            <div className="kpi-value animate-count-up">{tasksCount.value}</div>
                            <div className="flex items-center gap-1 mt-2 kpi-trend-up">
                                <TrendingUp className="w-4 h-4 animate-trend" />
                                <span className="text-sm">+12% vs mese scorso</span>
                            </div>
                        </div>

                        <div className="glass-card kpi-card rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-lg bg-green-500/10">
                                    <Zap className="w-5 h-5 text-green-500" />
                                </div>
                                <span className="text-sm text-muted-foreground">Tasso Completamento</span>
                            </div>
                            <div className="kpi-value animate-count-up">{completionRate.value}%</div>
                            <div className="flex items-center gap-1 mt-2 kpi-trend-up">
                                <TrendingUp className="w-4 h-4 animate-trend" />
                                <span className="text-sm">+5% vs mese scorso</span>
                            </div>
                        </div>

                        <div className="glass-card kpi-card rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-lg bg-orange-500/10">
                                    <Clock className="w-5 h-5 text-orange-500" />
                                </div>
                                <span className="text-sm text-muted-foreground">Ore Lavorate</span>
                            </div>
                            <div className="kpi-value animate-count-up">{hoursWorked.value}</div>
                            <div className="flex items-center gap-1 mt-2 kpi-trend-down">
                                <TrendingDown className="w-4 h-4" />
                                <span className="text-sm">-3% vs mese scorso</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* SEZIONE 4: Sparkline Charts */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold">📈 Sparkline Mini Charts</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="glass-card rounded-xl p-4">
                            <KpiSparkline
                                value={45}
                                label="Task questa settimana"
                                data={mockSparklineData}
                                color="primary"
                            />
                        </div>

                        <div className="glass-card rounded-xl p-4">
                            <KpiSparkline
                                value={92}
                                label="Tasso approvazione %"
                                data={mockSparklineData}
                                format={(v) => `${v}%`}
                                color="success"
                            />
                        </div>

                        <div className="glass-card rounded-xl p-4">
                            <KpiSparkline
                                value={15}
                                label="Task in ritardo"
                                data={mockSparklineData2}
                                color="danger"
                            />
                        </div>

                        <div className="glass-card rounded-xl p-4">
                            <KpiSparkline
                                value={8}
                                label="Progetti attivi"
                                data={[5, 6, 5, 7, 6, 8, 7, 8, 9, 8, 8, 8]}
                                color="warning"
                            />
                        </div>
                    </div>

                    <div className="glass-card rounded-xl p-6">
                        <h3 className="font-semibold mb-4">Sparkline con Trend</h3>
                        <div className="flex flex-wrap gap-8">
                            <SparklineTrend
                                data={mockSparklineData}
                                width={120}
                                height={30}
                                trendLabel="vs settimana scorsa"
                            />
                            <SparklineTrend
                                data={mockSparklineData2}
                                width={120}
                                height={30}
                                trendLabel="vs settimana scorsa"
                            />
                        </div>
                    </div>
                </section>

                {/* SEZIONE 5: Skeleton Loading */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold">⏳ Skeleton Loading Premium</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="glass-card rounded-xl p-4 space-y-3">
                            <div className="skeleton-premium skeleton-avatar" />
                            <div className="skeleton-premium skeleton-title" />
                            <div className="skeleton-premium skeleton-text w-full" />
                            <div className="skeleton-premium skeleton-text w-3/4" />
                        </div>

                        <div className="glass-card rounded-xl p-4">
                            <div className="skeleton-premium skeleton-card" />
                        </div>

                        <div className="glass-card rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="skeleton-premium skeleton-avatar" />
                                <div className="flex-1 space-y-2">
                                    <div className="skeleton-premium skeleton-text w-3/4" />
                                    <div className="skeleton-premium skeleton-text w-1/2" />
                                </div>
                            </div>
                            <div className="skeleton-premium h-2 w-full rounded" />
                        </div>
                    </div>
                </section>

                {/* SEZIONE 6: Progress Bar Animata */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold">📊 Progress Bar Animate</h2>

                    <div className="glass-card rounded-xl p-6 space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Progresso Progetto</span>
                                <span>75%</span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div className="h-full w-3/4 progress-gradient progress-animated rounded-full" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Task Completati</span>
                                <span>60%</span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div className="h-full w-3/5 bg-green-500 progress-animated rounded-full" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Budget Utilizzato</span>
                                <span>45%</span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div className="h-full w-[45%] bg-orange-500 progress-animated rounded-full" />
                            </div>
                        </div>
                    </div>
                </section>

                {/* SEZIONE 7: Gamification - Badges */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold">🏆 Sistema Gamification</h2>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Badge Sbloccati */}
                        <div className="glass-card rounded-xl p-6 space-y-4">
                            <h3 className="font-semibold">Badge Disponibili</h3>
                            <p className="text-sm text-muted-foreground">
                                I badge sbloccati sono colorati, quelli bloccati sono grigi
                            </p>
                            <BadgeGrid
                                unlockedBadges={['speed_demon', 'perfectionist', 'on_fire', 'contributor', 'team_player']}
                                showLocked={true}
                            />
                        </div>

                        {/* XP e Livello */}
                        <div className="glass-card rounded-xl p-6 space-y-6">
                            <h3 className="font-semibold">Progressione XP</h3>

                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <LevelBadge xp={100} size="lg" showName />
                                    <span className="text-muted-foreground">→</span>
                                    <LevelBadge xp={350} size="lg" showName />
                                    <span className="text-muted-foreground">→</span>
                                    <LevelBadge xp={750} size="lg" showName />
                                    <span className="text-muted-foreground">→</span>
                                    <LevelBadge xp={1500} size="lg" showName />
                                    <span className="text-muted-foreground">→</span>
                                    <LevelBadge xp={2500} size="lg" showName />
                                </div>

                                <XpProgressBar xp={750} />

                                <div className="flex flex-wrap gap-2">
                                    <XpGain amount={10} reason="Task completato" />
                                    <XpGain amount={25} reason="Approvato al primo tentativo" />
                                    <XpGain amount={50} reason="Progetto completato" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Streak */}
                        <div className="glass-card rounded-xl p-6 space-y-4">
                            <h3 className="font-semibold">Streak 🔥</h3>
                            <div className="flex flex-wrap gap-6">
                                <StreakDisplay currentStreak={0} size="lg" />
                                <StreakDisplay currentStreak={3} size="lg" />
                                <StreakDisplay currentStreak={12} longestStreak={25} size="lg" />
                                <StreakDisplay currentStreak={45} size="lg" />
                            </div>
                        </div>

                        {/* Card Utente Completa */}
                        <UserGamificationCard
                            gamification={mockGamification}
                            userName="Demo User"
                        />
                    </div>

                    {/* Leaderboard */}
                    <div className="glass-card rounded-xl p-6 space-y-4">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            Classifica Settimanale
                        </h3>
                        <Leaderboard
                            users={mockLeaderboard}
                            currentUserId="5"
                        />
                    </div>

                    {/* Badge Unlock Demo */}
                    <div className="flex justify-center">
                        <button
                            className="btn-gradient-gold px-6 py-3 rounded-lg font-medium"
                            onClick={() => setShowBadgeUnlock(true)}
                        >
                            🎉 Mostra Animazione Sblocco Badge
                        </button>
                    </div>

                    {showBadgeUnlock && (
                        <BadgeUnlock
                            badge={BADGES.find(b => b.id === 'quality_king')!}
                            onClose={() => setShowBadgeUnlock(false)}
                        />
                    )}
                </section>

                {/* Footer */}
                <div className="text-center py-8 text-muted-foreground">
                    <p>Tutte queste modifiche sono pronte per essere integrate nelle pagine esistenti.</p>
                    <p className="text-sm mt-2">
                        <a href="/dashboard" className="text-primary hover:underline">← Torna alla Dashboard</a>
                    </p>
                </div>
            </div>
        </div>
    );
}
