'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ActivityIssue, DataQualityReport, TaskIssue } from '@/lib/data-quality';

const PREVIEW = 8;

function Section<T extends { id: string; hours: number }>({
    title, hint, items, render,
}: { title: string; hint: string; items: T[]; render: (item: T) => React.ReactNode }) {
    const [expanded, setExpanded] = useState(false);
    const shown = expanded ? items : items.slice(0, PREVIEW);
    const hours = items.reduce((sum, i) => sum + i.hours, 0);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h4 className="text-sm font-semibold">{title}</h4>
                    <p className="text-xs text-muted-foreground">{hint}</p>
                </div>
                <Badge variant={items.length > 0 ? 'destructive' : 'secondary'} className="font-mono shrink-0">
                    {items.length} · {hours.toFixed(1)}h
                </Badge>
            </div>
            {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nessun problema nel periodo selezionato.</p>
            ) : (
                <>
                    <ul className="divide-y divide-border/50 rounded-lg border border-border/50">
                        {shown.map(item => (
                            <li key={item.id} className="flex items-start justify-between gap-3 px-3 py-2 text-xs">
                                {render(item)}
                            </li>
                        ))}
                    </ul>
                    {items.length > PREVIEW && (
                        <Button variant="ghost" size="sm" onClick={() => setExpanded(e => !e)}>
                            {expanded ? 'Mostra meno' : `Mostra tutti (${items.length})`}
                        </Button>
                    )}
                </>
            )}
        </div>
    );
}

const renderTask = (t: TaskIssue) => (
    <>
        <div className="min-w-0">
            <div className="font-medium truncate">{t.title}</div>
            <div className="text-muted-foreground truncate">Cliente: {t.clientName} · Assegnato: {t.userName} · {t.status}</div>
        </div>
        <span className="font-mono shrink-0">{t.hours}h</span>
    </>
);

const renderActivity = (a: ActivityIssue) => (
    <>
        <div className="min-w-0">
            <div className="font-medium truncate">{a.title}</div>
            <div className="text-muted-foreground truncate">
                {a.date} · Cliente: {a.clientName} · Utente: {a.userName}
            </div>
            <div className="text-amber-600 dark:text-amber-400">{a.reason}</div>
        </div>
        <span className="font-mono shrink-0">{a.hours}h</span>
    </>
);

interface RateProps {
    /** Utenti il cui costo orario salvato non è 30 €. */
    usersToFix: number;
    onSetRates: () => Promise<void>;
}

export function DataQualityPanel({ report, usersToFix, onSetRates }: { report: DataQualityReport } & RateProps) {
    const [saving, setSaving] = useState(false);
    const eur = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" /> Dati incompleti
                </CardTitle>
                <CardDescription>
                    Ore registrate che falsano i totali del periodo selezionato.
                    Non attribuite a nessun cliente: <strong>{report.unassignedClientHours}h ({eur(report.unassignedClientCost)})</strong>.
                    Attività sospette: <strong>{report.suspiciousHours}h</strong>.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="xl:col-span-2 flex items-center justify-between gap-3 rounded-lg border border-border/50 p-3">
                    <div className="text-xs">
                        <div className="font-semibold">Costo orario degli utenti</div>
                        <div className="text-muted-foreground">
                            {usersToFix === 0
                                ? 'Tutti gli utenti hanno 30 €/h salvati nel profilo.'
                                : `${usersToFix} utenti non hanno 30 €/h nel profilo. I costi partono dal valore salvato in ogni utente.`}
                        </div>
                    </div>
                    {usersToFix > 0 && (
                        <Button
                            size="sm"
                            disabled={saving}
                            onClick={async () => {
                                if (!window.confirm(`Imposta 30 €/h come costo orario di ${usersToFix} utenti? Sovrascrive le tariffe attuali.`)) return;
                                setSaving(true);
                                try { await onSetRates(); } finally { setSaving(false); }
                            }}
                        >
                            {saving ? 'Salvataggio…' : 'Imposta 30 €/h a tutti'}
                        </Button>
                    )}
                </div>
                <Section
                    title="Task con ore senza assegnatario"
                    hint="Il costo c'è (30 €/h) ma non si sa a chi attribuirlo."
                    items={report.tasksNoAssignee} render={renderTask}
                />
                <Section
                    title="Task con ore senza cliente"
                    hint="Non compaiono in nessun cliente di Costi e Redditività."
                    items={report.tasksNoClient} render={renderTask}
                />
                <Section
                    title="Attività calendario senza cliente"
                    hint="Ore perse nei costi per cliente: finiscono solo in «Senza Cliente»."
                    items={report.activitiesNoClient} render={renderActivity}
                />
                <Section
                    title="Attività calendario senza utente"
                    hint="Nessuna persona a cui attribuire le ore."
                    items={report.activitiesNoUser} render={renderActivity}
                />
                <div className="xl:col-span-2">
                    <Section
                        title="Attività sospette"
                        hint="Durate enormi, eventi su più giorni, orari invalidi o anni anomali: gonfiano ore e costi."
                        items={report.activitiesSuspicious} render={renderActivity}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
