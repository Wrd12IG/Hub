'use client';

import { useState, useEffect, Suspense } from 'react';
import { useLayoutData } from '@/app/(app)/layout-context';
import { SocialProfile, SocialStrategy } from '@/lib/data';
import { addSocialStrategy, getSocialStrategy } from '@/lib/social-strategy-actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bot, Sparkles, ArrowLeft, Loader2, AlertTriangle, Save, Send } from 'lucide-react';
import Link from 'next/link';
import { SocialStrategyResults } from '@/components/social-strategy-results';

function NewSocialStrategyForm() {
    const { clients, currentUser, isLoadingLayout } = useLayoutData();
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [frequency, setFrequency] = useState<'settimanale' | 'mensile'>('mensile');
    const [periodLabel, setPeriodLabel] = useState('');
    const [objective, setObjective] = useState('');
    const [events, setEvents] = useState('');
    const [extraNotes, setExtraNotes] = useState('');

    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedResult, setGeneratedResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();

    // Default values logic
    useEffect(() => {
        const clientId = searchParams.get('clientId');
        if (clientId) setSelectedClientId(clientId);

        const duplicateId = searchParams.get('duplicateId');
        if (duplicateId) {
            const fetchOriginal = async () => {
                const original = await getSocialStrategy(duplicateId);
                if (original) {
                    setSelectedClientId(original.clientId);
                    setFrequency(original.frequency);
                    setObjective(original.periodObjective);
                    setEvents(original.periodEvents);
                    setExtraNotes(original.periodNotes);
                    setPeriodLabel(original.periodLabel + ' (Copia)');
                }
            };
            fetchOriginal();
        }
    }, [searchParams]);

    const selectedClient = clients.find(c => c.id === selectedClientId);

    useEffect(() => {
        if (selectedClient?.socialProfile?.frequencyDefault) {
            setFrequency(selectedClient.socialProfile.frequencyDefault);
        }
    }, [selectedClient]);

    const handleGenerate = async () => {
        if (!selectedClientId || !objective || !periodLabel) {
            toast({ title: 'Campi obbligatori', description: 'Completa i campi obbligatori (*).', variant: 'destructive' });
            return;
        }

        setIsGenerating(true);
        setError(null);
        setGeneratedResult(null);

        const profile = selectedClient?.socialProfile || {} as SocialProfile;

        const systemPrompt = `Sei un esperto di social media marketing e strategia digitale. 
Generi strategie professionali, creative e actionable per agenzie. 
Rispondi SEMPRE in italiano. Rispondi SOLO in formato JSON valido, 
senza markdown, senza backtick, senza testo prima o dopo.`;

        const userPrompt = `Crea una strategia social e marketing completa per questo cliente.

PROFILO CLIENTE:
- Azienda: ${selectedClient?.name || 'Azienda Inc.'}
- Settore comunicativo: ${profile.sector || 'N/D'}
- Piattaforme attive: ${profile.platforms?.join(', ') || 'N/D'}
- Tono di voce: ${profile.toneOfVoice || 'N/D'}
- Target audience: ${profile.targetAudience || 'N/D'}
- Competitor principali: ${profile.competitors || 'N/D'}
- Cose da evitare: ${profile.thingsToAvoid || 'N/D'}
- Brief permanente: ${profile.aiInfo || 'N/D'}

QUESTO PERIODO:
- Frequenza: ${frequency}
- Periodo: ${periodLabel}
- Obiettivo: ${objective}
- Eventi/ricorrenze: ${events}
- Note extra: ${extraNotes}

ISTRUZIONI QUANTITÀ E STRUTTURA:
- Se la frequenza è "settimanale", genera un calendario di circa 5 post totali.
- Se la frequenza è "mensile", genera un calendario MOLTO CORPOSO con almeno 20-24 post (circa 5-6 post a settimana) ben distribuiti su tutto il mese per coprire tutte le piattaforme attive (${profile.platforms?.join(', ') || 'tutte'}).
- OGNI giorno nel calendario deve essere diverso o coprire una diversa combinazione di piattaforma/argomento.
- NON limitarti a 2 post a settimana per un mese intero.

Genera un JSON con questa struttura esatta:
{
  "sommario_strategico": "paragrafo 3-4 righe",
  "obiettivi": ["obiettivo 1", "obiettivo 2", "obiettivo 3"],
  "messaggio_chiave": "claim centrale del periodo",
  "calendario": [
    {
      "giorno": "Lunedì 1",
      "piattaforma": "Instagram",
      "formato": "Reel",
      "topic": "argomento",
      "caption": "testo",
      "cta": "call to action"
    }
  ],
  "idee_wow": [
    {
      "titolo": "nome",
      "descrizione": "come eseguirla",
      "impatto_atteso": "perché"
    }
  ],
  "kpi": ["KPI 1"],
  "testo_email": "email pronta"
}`;

        try {
            const response = await fetch('/api/social-strategy/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: userPrompt, systemPrompt })
            });

            if (!response.ok) {
                throw new Error('Errore nella generazione della strategia.');
            }

            const data = await response.json();
            setGeneratedResult(data);
        } catch (err: any) {
            setError(err.message);
            toast({ title: 'Errore', description: err.message, variant: 'destructive' });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async (status: 'bozza' | 'inviata') => {
        if (!generatedResult || !currentUser) return;

        try {
            const strategyData: Omit<SocialStrategy, 'id'> = {
                clientId: selectedClientId,
                createdBy: currentUser.id,
                frequency,
                periodLabel,
                generationDate: new Date().toISOString(),
                sendDate: status === 'inviata' ? new Date().toISOString() : undefined,
                periodObjective: objective,
                periodEvents: events,
                periodNotes: extraNotes,
                outputJson: generatedResult,
                status
            };

            const id = await addSocialStrategy(strategyData);
            toast({ title: 'Salvata', description: 'Strategia salvata con successo.' });
            router.push(`/social-strategies/${id}`);
        } catch (error) {
            toast({ title: 'Errore', description: 'Impossibile salvare la strategia.', variant: 'destructive' });
        }
    };

    if (isLoadingLayout) {
        return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-20 animate-in fade-in duration-500">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/social-strategies"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-2">
                        <Sparkles className="h-8 w-8 text-primary" /> Genera Strategia Social
                    </h1>
                    <p className="text-muted-foreground">Utilizza l'AI per creare un piano editoriale strategico</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-12">
                <div className="md:col-span-5 space-y-6">
                    <Card className="glass-card sticky top-24">
                        <CardHeader>
                            <CardTitle>Input Strategia</CardTitle>
                            <CardDescription>Inserisci i dettagli per la generazione</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Cliente *</Label>
                                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                                    <SelectTrigger><SelectValue placeholder="Seleziona un cliente..." /></SelectTrigger>
                                    <SelectContent>
                                        {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center justify-between p-3 border rounded-lg bg-accent/20">
                                <div>
                                    <p className="text-sm font-medium">Frequenza</p>
                                    <p className="text-xs text-muted-foreground capitalize">{frequency}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium">Settimanale</span>
                                    <Switch
                                        checked={frequency === 'mensile'}
                                        onCheckedChange={(v) => setFrequency(v ? 'mensile' : 'settimanale')}
                                    />
                                    <span className="text-xs font-medium">Mensile</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Periodo di Riferimento *</Label>
                                <Input
                                    placeholder="es. Settimana 14 · Aprile 2026"
                                    value={periodLabel}
                                    onChange={(e) => setPeriodLabel(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Obiettivo del Periodo *</Label>
                                <Textarea
                                    placeholder="Qual è il focus principale di questo periodo?"
                                    className="min-h-[80px]"
                                    value={objective}
                                    onChange={(e) => setObjective(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Eventi/Ricorrenze Rilevanti</Label>
                                <Input
                                    placeholder="es. Black Friday"
                                    value={events}
                                    onChange={(e) => setEvents(e.target.value)}
                                />
                            </div>

                            <Button
                                onClick={handleGenerate}
                                className="w-full rainbow-border items-center justify-center py-6 text-lg"
                                disabled={isGenerating}
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Elaborazione...
                                    </>
                                ) : (
                                    <>
                                        Genera Ora <Sparkles className="ml-2 h-5 w-5" />
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="md:col-span-7">
                    {isGenerating ? (
                        <div className="h-full flex flex-col items-center justify-center min-h-[400px] gap-4 bg-card border rounded-lg animate-pulse p-8 text-center">
                            <Bot className="h-20 w-20 text-primary animate-bounce" />
                            <h3 className="text-2xl font-bold font-headline">Sto elaborando...</h3>
                            <div className="w-full max-w-xs h-2 bg-accent rounded-full overflow-hidden">
                                <div className="h-full bg-primary animate-[progress_5s_ease-in-out_infinite]" style={{ width: '100%' }} />
                            </div>
                        </div>
                    ) : generatedResult ? (
                        <div className="space-y-6">
                            <div className="flex justify-end gap-2 sticky top-[100px] z-10 bg-background/80 backdrop-blur p-2 rounded-md border shadow-sm">
                                <Button variant="outline" size="sm" onClick={() => handleSave('bozza')}>
                                    <Save className="mr-2 h-4 w-4" /> Salva Bozza
                                </Button>
                                <Button size="sm" onClick={() => handleSave('inviata')}>
                                    <Send className="mr-2 h-4 w-4" /> Segna come Inviata
                                </Button>
                            </div>
                            <SocialStrategyResults
                                result={generatedResult}
                                clientName={selectedClient?.name}
                                clientId={selectedClientId}
                                userId={currentUser?.id}
                                periodLabel={periodLabel}
                                toneOfVoice={selectedClient?.socialProfile?.toneOfVoice}
                            />
                        </div>
                    ) : error ? (
                        <div className="h-full flex flex-col items-center justify-center min-h-[400px] gap-4 bg-destructive/5 border-destructive/20 border rounded-lg p-8 text-center">
                            <AlertTriangle className="h-16 w-16 text-destructive" />
                            <p className="text-muted-foreground">{error}</p>
                            <Button variant="outline" onClick={handleGenerate}>Riprova</Button>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center min-h-[400px] gap-4 bg-card border rounded-lg border-dashed p-8 text-center">
                            <Bot className="h-16 w-16 text-muted-foreground/30" />
                            <h3 className="text-xl font-medium text-muted-foreground">La strategia apparirà qui</h3>
                        </div>
                    )}
                </div>
            </div>
            <style jsx global>{`
                @keyframes progress {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(0); }
                }
            `}</style>
        </div>
    );
}

export default function NewSocialStrategyPage() {
    return (
        <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>}>
            <NewSocialStrategyForm />
        </Suspense>
    );
}

export const dynamic = 'force-dynamic';
