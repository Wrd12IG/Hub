'use client';

import { useState, useEffect } from 'react';
import { useLayoutData } from '@/app/(app)/layout-context';
import { SocialStrategy } from '@/lib/data';
import { getSocialStrategy, updateSocialStrategy, deleteSocialStrategy } from '@/lib/social-strategy-actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { notFound, useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Bot,
    Save,
    Trash2,
    Archive,
    Send,
    History,
    Calendar,
    NotebookPen,
    Loader2,
    Sparkles,
    RefreshCcw
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { SocialStrategyResults } from '@/components/social-strategy-results';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export default function SocialStrategyDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { clients, users, isLoadingLayout } = useLayoutData();
    const { toast } = useToast();

    const [strategy, setStrategy] = useState<SocialStrategy | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [note, setNote] = useState('');
    const [isSavingNote, setIsSavingNote] = useState(false);

    useEffect(() => {
        const fetchStrategy = async () => {
            if (!params.id) return;
            setIsLoading(true);
            const data = await getSocialStrategy(params.id as string);
            if (data) {
                setStrategy(data);
                setNote(data.manualNotes || '');
            }
            setIsLoading(false);
        };
        fetchStrategy();
    }, [params.id]);

    if (isLoadingLayout || isLoading) {
        return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
    }

    if (!strategy) {
        return notFound();
    }

    const client = clients.find(c => c.id === strategy.clientId);
    const creator = users.find(u => u.id === strategy.createdBy);

    const handleUpdateStatus = async (status: 'bozza' | 'inviata' | 'archiviata') => {
        try {
            await updateSocialStrategy(strategy.id, {
                status,
                sendDate: status === 'inviata' ? new Date().toISOString() : strategy.sendDate
            });
            setStrategy({ ...strategy, status, sendDate: status === 'inviata' ? new Date().toISOString() : strategy.sendDate });
            toast({ title: 'Aggiornato', description: `Stato cambiato in ${status}.` });
        } catch (error) {
            toast({ title: 'Errore', description: 'Impossibile aggiornare lo stato.', variant: 'destructive' });
        }
    };

    const handleSaveNote = async () => {
        setIsSavingNote(true);
        try {
            await updateSocialStrategy(strategy.id, { manualNotes: note });
            setStrategy({ ...strategy, manualNotes: note });
            toast({ title: 'Nota salvata', description: 'Le tue annotazioni sono state aggiornate.' });
        } catch (error) {
            toast({ title: 'Errore', description: 'Impossibile salvare la nota.', variant: 'destructive' });
        } finally {
            setIsSavingNote(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Sei sicuro di voler eliminare questa strategia?')) return;
        try {
            await deleteSocialStrategy(strategy.id);
            toast({ title: 'Eliminata', description: 'La strategia è stata rimossa.' });
            router.push('/social-strategies');
        } catch (error) {
            toast({ title: 'Errore', description: 'Impossibile eliminare.', variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/social-strategies">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-bold font-headline">{strategy.periodLabel}</h1>
                            <Badge variant={strategy.status === 'inviata' ? 'default' : strategy.status === 'archiviata' ? 'secondary' : 'outline'}>
                                {strategy.status}
                            </Badge>
                        </div>
                        <p className="text-muted-foreground flex items-center gap-2">
                            <Bot className="h-4 w-4" /> {client?.name || 'Cliente eliminato'} • <span className="capitalize">{strategy.frequency}</span>
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/social-strategies/new?duplicateId=${strategy.id}`}>
                            <RefreshCcw className="mr-2 h-4 w-4" /> Rigenera / Clona
                        </Link>
                    </Button>
                    {strategy.status === 'bozza' && (
                        <Button size="sm" onClick={() => handleUpdateStatus('inviata')}>
                            <Send className="mr-2 h-4 w-4" /> Segna come Inviata
                        </Button>
                    )}
                    {strategy.status !== 'archiviata' && (
                        <Button variant="outline" size="sm" onClick={() => handleUpdateStatus('archiviata')}>
                            <Archive className="mr-2 h-4 w-4" /> Archivia
                        </Button>
                    )}
                    <Button variant="outline" size="icon" className="text-destructive hover:bg-destructive/10" onClick={handleDelete}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-4">
                <div className="md:col-span-3 space-y-6">
                    <SocialStrategyResults
                        result={strategy.outputJson}
                        clientName={client?.name}
                        clientId={strategy.clientId}
                        userId={strategy.createdBy}
                        periodLabel={strategy.periodLabel}
                        toneOfVoice={client?.socialProfile?.toneOfVoice}
                    />
                </div>

                <div className="space-y-6">
                    <Card className="glass-card">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                <History className="h-4 w-4 text-primary" /> Info Strategia
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="space-y-1">
                                <p className="text-muted-foreground">Generata il:</p>
                                <p className="font-medium">{format(new Date(strategy.generationDate), 'dd MMM yyyy HH:mm', { locale: it })}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-muted-foreground">Creata da:</p>
                                <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: creator?.color + '20', color: creator?.color }}>
                                        {creator?.name.charAt(0) || 'U'}
                                    </div>
                                    <p className="font-medium">{creator?.name || 'Sistema'}</p>
                                </div>
                            </div>
                            {strategy.sendDate && (
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Inviata il:</p>
                                    <p className="font-medium text-green-600 dark:text-green-400">
                                        {format(new Date(strategy.sendDate), 'dd MMM yyyy', { locale: it })}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="glass-card">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                <NotebookPen className="h-4 w-4 text-primary" /> Note Manuali
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Textarea
                                placeholder="Aggiungi annotazioni post-generazione..."
                                className="min-h-[150px] text-sm"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                            />
                            <Button
                                className="w-full"
                                size="sm"
                                onClick={handleSaveNote}
                                disabled={isSavingNote || note === (strategy.manualNotes || '')}
                            >
                                {isSavingNote ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                Salva Note
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="glass-card border-l-4 border-l-primary">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold uppercase tracking-wider">Input Originale</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-xs text-muted-foreground">
                            <div>
                                <p className="font-bold text-foreground">Obiettivo:</p>
                                <p className="italic">{strategy.periodObjective}</p>
                            </div>
                            {strategy.periodEvents && (
                                <div>
                                    <p className="font-bold text-foreground">Eventi:</p>
                                    <p>{strategy.periodEvents}</p>
                                </div>
                            )}
                            {strategy.periodNotes && (
                                <div>
                                    <p className="font-bold text-foreground">Note:</p>
                                    <p>{strategy.periodNotes}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
