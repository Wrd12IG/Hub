'use client';

import { useState } from 'react';
import {
    Skeleton,
    SkeletonCard,
    SkeletonTaskList,
    SkeletonTable,
    SkeletonDashboard
} from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/components/analytics/metric-card';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

export default function SkeletonDemoPage() {
    const [showSkeleton, setShowSkeleton] = useState(true);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Skeleton Loaders Demo</h1>
                    <p className="text-muted-foreground mt-1">
                        Visualizza i placeholder di caricamento
                    </p>
                </div>

                <Button
                    onClick={() => setShowSkeleton(!showSkeleton)}
                    variant={showSkeleton ? 'default' : 'outline'}
                >
                    {showSkeleton ? '👁️ Mostra Contenuto Reale' : '💀 Mostra Skeleton'}
                </Button>
            </div>

            {/* Skeleton Base */}
            <section>
                <h2 className="text-xl font-semibold mb-4">1. Skeleton Base</h2>
                <div className="space-y-3 p-6 border rounded-lg">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <div className="flex gap-2">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Skeleton Cards */}
            <section>
                <h2 className="text-xl font-semibold mb-4">2. Skeleton Cards (Metriche)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {showSkeleton ? (
                        <>
                            <SkeletonCard />
                            <SkeletonCard />
                            <SkeletonCard />
                        </>
                    ) : (
                        <>
                            <MetricCard
                                title="Tasso Completamento"
                                value="75.5%"
                                subtitle="120 task totali"
                                icon={CheckCircle2}
                                color="green"
                            />
                            <MetricCard
                                title="Tempo Medio"
                                value="12.3h"
                                subtitle="Per completare un task"
                                icon={Clock}
                                color="blue"
                            />
                            <MetricCard
                                title="Task in Ritardo"
                                value={3}
                                subtitle="Da completare"
                                icon={AlertTriangle}
                                color="red"
                            />
                        </>
                    )}
                </div>
            </section>

            {/* Skeleton Task List */}
            <section>
                <h2 className="text-xl font-semibold mb-4">3. Skeleton Task List</h2>
                {showSkeleton ? (
                    <SkeletonTaskList count={5} />
                ) : (
                    <div className="space-y-3">
                        {[
                            { title: 'Implementare Analytics', status: 'In Lavorazione', user: 'Mario', date: 'Domani' },
                            { title: 'Fix bug login', status: 'Critico', user: 'Luca', date: 'Oggi' },
                            { title: 'Aggiornare documentazione', status: 'Da Fare', user: 'Sara', date: '3 giorni' },
                            { title: 'Review codice', status: 'In Approvazione', user: 'Paolo', date: 'Oggi' },
                            { title: 'Deploy produzione', status: 'Approvato', user: 'Admin', date: 'Completato' },
                        ].map((task, i) => (
                            <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h3 className="font-semibold">{task.title}</h3>
                                        <p className="text-sm text-muted-foreground">Descrizione del task</p>
                                    </div>
                                    <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                        {task.status}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">
                                            {task.user[0]}
                                        </div>
                                        {task.user}
                                    </div>
                                    <span>•</span>
                                    <span>📅 {task.date}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Skeleton Table */}
            <section>
                <h2 className="text-xl font-semibold mb-4">4. Skeleton Table</h2>
                {showSkeleton ? (
                    <SkeletonTable rows={5} columns={4} />
                ) : (
                    <div className="rounded-lg border">
                        <div className="border-b bg-muted/50 p-4">
                            <div className="flex items-center gap-4 font-semibold">
                                <div className="flex-1">Nome</div>
                                <div className="flex-1">Email</div>
                                <div className="flex-1">Ruolo</div>
                                <div className="flex-1">Status</div>
                            </div>
                        </div>
                        <div className="divide-y">
                            {[
                                { name: 'Mario Rossi', email: 'mario@example.com', role: 'Admin', status: 'Attivo' },
                                { name: 'Luca Bianchi', email: 'luca@example.com', role: 'PM', status: 'Attivo' },
                                { name: 'Sara Verdi', email: 'sara@example.com', role: 'Developer', status: 'Attivo' },
                                { name: 'Paolo Neri', email: 'paolo@example.com', role: 'Designer', status: 'Inattivo' },
                                { name: 'Anna Gialli', email: 'anna@example.com', role: 'Developer', status: 'Attivo' },
                            ].map((user, i) => (
                                <div key={i} className="p-4">
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1">{user.name}</div>
                                        <div className="flex-1 text-muted-foreground">{user.email}</div>
                                        <div className="flex-1">{user.role}</div>
                                        <div className="flex-1">
                                            <span className={`text-xs px-2 py-1 rounded-full ${user.status === 'Attivo'
                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                                    : 'bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400'
                                                }`}>
                                                {user.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {/* Skeleton Dashboard */}
            <section>
                <h2 className="text-xl font-semibold mb-4">5. Skeleton Dashboard Completa</h2>
                {showSkeleton ? (
                    <SkeletonDashboard />
                ) : (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <h3 className="text-2xl font-bold">Dashboard Analytics</h3>
                            <p className="text-muted-foreground">Panoramica completa delle performance</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="rounded-lg border bg-card p-6">
                                    <p className="text-sm text-muted-foreground mb-2">Metrica {i + 1}</p>
                                    <p className="text-3xl font-bold">100%</p>
                                    <p className="text-sm text-muted-foreground mt-2">Descrizione metrica</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {/* Info */}
            <section className="bg-blue-50 dark:bg-blue-950/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    💡 Come Funziona
                </h3>
                <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                    <li>• Gli skeleton mostrano la <strong>struttura</strong> del contenuto mentre carica</li>
                    <li>• L'animazione <strong>pulse</strong> indica che qualcosa sta caricando</li>
                    <li>• Migliora la <strong>percezione</strong> della velocità dell'app</li>
                    <li>• Usati da Facebook, LinkedIn, YouTube, Netflix</li>
                    <li>• Clicca il pulsante sopra per vedere la <strong>trasformazione</strong></li>
                </ul>
            </section>
        </div>
    );
}
