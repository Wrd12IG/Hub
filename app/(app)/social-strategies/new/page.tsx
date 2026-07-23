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
import { Bot, Sparkles, ArrowLeft, Loader2, AlertTriangle, Save, Send, Target, Rocket, Megaphone, Briefcase, RefreshCw, CheckCircle2, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import { Badge } from '@/components/ui/badge';

const SocialStrategyResults = nextDynamic(
  () => import('@/components/social-strategy-results').then(m => ({ default: m.SocialStrategyResults })),
  { ssr: false }
);

const SOCIAL_HOLIDAYS: Record<string, string[]> = {
    'gennaio': ['Capodanno (1)', 'Epifania (6)', 'Blue Monday', 'Giorno della Memoria (27)'],
    'febbraio': ['San Valentino (14)', 'Carnevale', 'Giorno del Ricordo (10)', 'World Cancer Day (4)', 'Nutella Day (5)'],
    'marzo': ['Festa della Donna (8)', 'Festa del Papà (19)', 'San Patrizio (17)', 'Inizio Primavera (21)', 'Giorno della felicità (20)'],
    'aprile': ['Pesce d\'Aprile (1)', 'Pasqua', 'Pasquetta', 'Liberazione (25)', 'Giornata della Terra (22)', 'World Health Day (7)'],
    'maggio': ['Festa dei Lavoratori (1)', 'Festa della Mamma', 'World Red Cross Day (8)', 'Giornata dell\'Europa (9)'],
    'giugno': ['Festa della Repubblica (2)', 'Inizio Estate (21)', 'World Environment Day (5)', 'Ocean Day (8)', 'Pride Month'],
    'luglio': ['World Emoji Day (17)', 'Giornata dell\'Amicizia (30)', 'Amazon Prime Day'],
    'agosto': ['Ferragosto (15)', 'Giornata dell\'Umanità (19)', 'Gatto Day (8)'],
    'settembre': ['Inizio Scuole', 'Inizio Autunno (23)', 'Bicicletta Day (17)'],
    'ottobre': ['Halloween (31)', 'Festa dei Nonni (2)', 'World Mental Health Day (10)', 'Giornata del Pane (16)'],
    'novembre': ['Ognissanti (1)', 'Black Friday', 'Cyber Monday', 'Movember', 'Giorno della gentilezza (13)'],
    'dicembre': ['Immacolata (8)', 'Natale (25)', 'Santo Stefano (26)', 'San Silvestro (31)', 'Giorno dei Diritti Umani (10)']
};

const STRATEGY_PRESETS = [
    {
        id: 'launch',
        title: 'Lancio Prodotto/Servizio',
        icon: Rocket,
        period: 'Mese di Lancio',
        objective: 'Lancio sul mercato del nuovo servizio/prodotto. Focus su brand awareness, spiegazione dei benefici chiave e acquisizione primi clienti.',
        color: 'hover:border-blue-500/50 hover:bg-blue-500/5'
    },
    {
        id: 'growth',
        title: 'Growth & Engagement',
        icon: Sparkles,
        period: 'Piano Mensile Growth',
        objective: 'Aumentare l\'engagement organico e la community. Focus su Reels/TikTok di tendenza, format interattivi e domande nelle Storie.',
        color: 'hover:border-purple-500/50 hover:bg-purple-500/5'
    },
    {
        id: 'promo',
        title: 'Promozione Stagionale',
        icon: Megaphone,
        period: 'Campagna Promo / Saldi',
        objective: 'Generare vendite dirette e conversioni nel breve periodo. Focus su offerte a tempo, senso di scarsità e call to action chiare.',
        color: 'hover:border-amber-500/50 hover:bg-amber-500/5'
    },
    {
        id: 'b2b',
        title: 'B2B & Autorità',
        icon: Briefcase,
        period: 'Piano Posizionamento B2B',
        objective: 'Rafforzare l\'autorità e la credibilità nel settore B2B. Focus su case study di successo, articoli di approfondimento e posizionamento su LinkedIn.',
        color: 'hover:border-emerald-500/50 hover:bg-emerald-500/5'
    }
];

const GENERATION_STEPS = [
    { step: 1, text: 'Analisi profilo brand, target audience e tono di voce...', progress: 20 },
    { step: 2, text: 'Definizione pilastri di contenuto e messaggi chiave...', progress: 50 },
    { step: 3, text: 'Generazione calendario editoriale e format grafici/video...', progress: 80 },
    { step: 4, text: 'Finalizzazione idee WOW e KPI di rendimento...', progress: 95 }
];

function NewSocialStrategyForm() {
    const { clients, currentUser, isLoadingLayout } = useLayoutData();
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [frequency, setFrequency] = useState<'settimanale' | 'mensile'>('mensile');
    const [periodLabel, setPeriodLabel] = useState('');
    const [objective, setObjective] = useState('');
    const [events, setEvents] = useState('');
    const [extraNotes, setExtraNotes] = useState('');

    const [isGenerating, setIsGenerating] = useState(false);
    const [generationStepIdx, setGenerationStepIdx] = useState(0);
    const [generatedResult, setGeneratedResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [errorDetails, setErrorDetails] = useState<string | null>(null);
    const [detectedMonth, setDetectedMonth] = useState<string | null>(null);
    const [selectedHolidays, setSelectedHolidays] = useState<string[]>([]);

    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();

    // Stepper timer during generation
    useEffect(() => {
        let interval: any;
        if (isGenerating) {
            setGenerationStepIdx(0);
            interval = setInterval(() => {
                setGenerationStepIdx(prev => (prev < GENERATION_STEPS.length - 1 ? prev + 1 : prev));
            }, 4500);
        }
        return () => clearInterval(interval);
    }, [isGenerating]);

    // Load defaults from URL
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

    // Detect month from period label
    useEffect(() => {
        const lowerLabel = periodLabel.toLowerCase();
        const month = Object.keys(SOCIAL_HOLIDAYS).find(m => lowerLabel.includes(m));
        if (month !== detectedMonth) {
            setDetectedMonth(month || null);
            setSelectedHolidays([]);
        }
    }, [periodLabel, detectedMonth]);

    const toggleHoliday = (holiday: string) => {
        const newSelected = selectedHolidays.includes(holiday)
            ? selectedHolidays.filter(h => h !== holiday)
            : [...selectedHolidays, holiday];

        setSelectedHolidays(newSelected);
        const baseEvents = events.split(', ').filter(e => !Object.values(SOCIAL_HOLIDAYS).flat().includes(e) && e !== '');
        setEvents([...baseEvents, ...newSelected].join(', '));
    };

    const applyPreset = (preset: typeof STRATEGY_PRESETS[0]) => {
        setPeriodLabel(preset.period);
        setObjective(preset.objective);
        toast({ title: 'Template applicato', description: `Inizializzato con il modello "${preset.title}".` });
    };

    const selectedClient = clients.find(c => c.id === selectedClientId);

    useEffect(() => {
        if (selectedClient?.socialProfile?.frequencyDefault) {
            setFrequency(selectedClient.socialProfile.frequencyDefault);
        }
    }, [selectedClient]);

    const handleGenerate = async () => {
        if (!selectedClientId || !objective || !periodLabel) {
            toast({ title: 'Campi obbligatori', description: 'Seleziona un cliente e inserisci Periodo e Obiettivo.', variant: 'destructive' });
            return;
        }

        setIsGenerating(true);
        setError(null);
        setErrorDetails(null);
        setGeneratedResult(null);

        const profile = selectedClient?.socialProfile || {} as SocialProfile;

        const systemPrompt = `Sei un esperto di social media marketing e strategia digitale per agenzie web e comunicazione. 
Generi strategie professionali, altamente creative, concrete e actionable per i clienti. 
Rispondi SEMPRE in lingua italiana. 
Rispondi RIGOROSAMENTE SOLO con un oggetto JSON valido, senza blocchi markdown e senza commenti prima o dopo.`;

        const userPrompt = `Crea una strategia social e marketing completa per il seguente cliente.

PROFILO CLIENTE:
- Azienda: ${selectedClient?.name || 'Azienda'}
- Settore: ${profile.sector || 'Generico'}
- Piattaforme attive: ${profile.platforms?.join(', ') || 'Instagram, Facebook, LinkedIn'}
- Tono di voce: ${profile.toneOfVoice || 'Professionale ed empatico'}
- Target audience: ${profile.targetAudience || 'Target ampio interessato al settore'}
- Competitor principali: ${profile.competitors || 'N/D'}
- Cose da evitare: ${profile.thingsToAvoid || 'N/D'}
- Note permanenti: ${profile.aiInfo || 'N/D'}

DETTAGLI PERIODO CORRENTE:
- Frequenza: ${frequency}
- Periodo: ${periodLabel}
- Obiettivo: ${objective}
- Eventi/ricorrenze: ${events || 'Nessuno'}
- Note extra: ${extraNotes || 'Nessuna'}

ISTRUZIONI QUANTITATIVE:
- Se la frequenza è "settimanale", genera 4-5 post nel calendario.
- Se la frequenza è "mensile", genera 12-15 post bilanciati per coprire il mese sulle piattaforme del cliente.
- Ogni post deve avere formato specifico (Reel, Carosello, Foto, Infografica, Storia), topic rilevante, caption pronta e CTA d'impatto.

Genera il JSON con questa struttura esatta:
{
  "sommario_strategico": "descrizione panoramica 3-4 righe",
  "obiettivi": ["obiettivo 1", "obiettivo 2", "obiettivo 3"],
  "messaggio_chiave": "claim principale del periodo",
  "calendario": [
    {
      "giorno": "Lunedì 1",
      "piattaforma": "Instagram",
      "formato": "Reel",
      "topic": "argomento specifico",
      "caption": "testo completo del post",
      "cta": "call to action d'impatto"
    }
  ],
  "idee_wow": [
    {
      "titolo": "nome idea",
      "descrizione": "dettaglio esecuzione",
      "impatto_atteso": "risultato atteso"
    }
  ],
  "kpi": ["KPI 1", "KPI 2"],
  "testo_email": "email pronta da inviare al cliente per presentare la strategia"
}`;

        try {
            const response = await fetch('/api/social-strategy/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: userPrompt, systemPrompt })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.details || 'Errore durante la generazione della strategia AI.');
            }

            setGeneratedResult(data);
            toast({ title: '✨ Strategia Generata!', description: 'Il piano editoriale AI è stato creato con successo.' });
        } catch (err: any) {
            setError(err.message || 'Si è verificato un errore durante la chiamata AI.');
            setErrorDetails(err.details || null);
            toast({ title: 'Errore Generazione AI', description: err.message, variant: 'destructive' });
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
        return (
            <div className="p-12 flex justify-center items-center">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild className="rounded-xl">
                        <Link href="/social-strategies"><ArrowLeft className="h-5 w-5" /></Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold font-headline flex items-center gap-2.5">
                            <Sparkles className="h-7 w-7 text-primary animate-pulse" /> Generatore Strategie Social AI
                        </h1>
                        <p className="text-sm text-muted-foreground">Crea piani editoriali e strategie social ottimizzate per i clienti dell'agenzia</p>
                    </div>
                </div>
            </div>

            {/* Template Presets */}
            <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Rocket className="h-3.5 w-3.5 text-primary" /> Modelli Strategici Rapidi:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {STRATEGY_PRESETS.map(preset => {
                        const Icon = preset.icon;
                        return (
                            <button
                                key={preset.id}
                                type="button"
                                onClick={() => applyPreset(preset)}
                                className={`flex items-start gap-3 p-3 rounded-xl border border-border bg-card/60 transition-all duration-200 text-left shadow-sm hover:shadow ${preset.color}`}
                            >
                                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                                    <Icon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-foreground truncate">{preset.title}</p>
                                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{preset.objective}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Form + Results Container */}
            <div className="grid gap-6 lg:grid-cols-12">
                {/* Left Column: Input Form */}
                <div className="lg:col-span-5 space-y-6">
                    <Card className="border-border/60 shadow-xl bg-card/80 backdrop-blur-xl">
                        <CardHeader className="pb-4 border-b border-border/40">
                            <CardTitle className="text-lg font-bold flex items-center justify-between">
                                <span>Input Strategia</span>
                                {selectedClient && (
                                    <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                                        {selectedClient.name}
                                    </Badge>
                                )}
                            </CardTitle>
                            <CardDescription className="text-xs">Compila i parametri del periodo da pianificare</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">

                            {/* Client Selection */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Cliente *</Label>
                                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                                    <SelectTrigger className="rounded-xl">
                                        <SelectValue placeholder="Seleziona un cliente..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[...clients].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(c => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Client Social Profile Preview Card */}
                            {selectedClient && selectedClient.socialProfile && (
                                <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-xs space-y-1.5 animate-in fade-in-50">
                                    <div className="flex items-center justify-between text-muted-foreground">
                                        <span className="font-semibold text-foreground">Profilo Social Memorizzato</span>
                                        <span>{selectedClient.socialProfile.sector || 'Settore N/D'}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {selectedClient.socialProfile.toneOfVoice && (
                                            <Badge variant="secondary" className="text-[10px] py-0 px-2">
                                                🗣️ {selectedClient.socialProfile.toneOfVoice}
                                            </Badge>
                                        )}
                                        {selectedClient.socialProfile.platforms?.map(p => (
                                            <Badge key={p} variant="outline" className="text-[10px] py-0 px-2">
                                                📱 {p}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Frequency Toggle */}
                            <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/30">
                                <div>
                                    <p className="text-xs font-semibold text-foreground">Frequenza Piano</p>
                                    <p className="text-[11px] text-muted-foreground capitalize">{frequency} ({frequency === 'mensile' ? '12-15 post' : '4-5 post'})</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-muted-foreground">Settimanale</span>
                                    <Switch
                                        checked={frequency === 'mensile'}
                                        onCheckedChange={(v) => setFrequency(v ? 'mensile' : 'settimanale')}
                                    />
                                    <span className="text-xs font-medium text-foreground">Mensile</span>
                                </div>
                            </div>

                            {/* Period Label */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Periodo di Riferimento *</Label>
                                <Input
                                    placeholder="es. Aprile 2026 · Settimana 14"
                                    value={periodLabel}
                                    onChange={(e) => setPeriodLabel(e.target.value)}
                                    className="rounded-xl"
                                />
                            </div>

                            {/* Main Objective */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Obiettivo Principale del Periodo *</Label>
                                <Textarea
                                    placeholder="Qual è il focus o risultato chiave di questo periodo?"
                                    className="min-h-[80px] rounded-xl text-xs"
                                    value={objective}
                                    onChange={(e) => setObjective(e.target.value)}
                                />
                            </div>

                            {/* Social Holidays / Events */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold">Eventi / Ricorrenze Rilevanti</Label>

                                {detectedMonth && SOCIAL_HOLIDAYS[detectedMonth] && (
                                    <div className="p-3 bg-primary/5 border border-primary/15 rounded-xl space-y-2 animate-in fade-in duration-200">
                                        <p className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                                            <Sparkles className="h-3.5 w-3.5" /> Giornate Nazionali per {detectedMonth.toUpperCase()}:
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {SOCIAL_HOLIDAYS[detectedMonth].map(holiday => (
                                                <Badge
                                                    key={holiday}
                                                    variant={selectedHolidays.includes(holiday) ? 'default' : 'outline'}
                                                    className="cursor-pointer text-[10px] py-0.5 px-2 hover:scale-105 transition-all"
                                                    onClick={() => toggleHoliday(holiday)}
                                                >
                                                    {holiday}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <Textarea
                                    placeholder="es. Black Friday, Saldi, Evento aziendale..."
                                    value={events}
                                    onChange={(e) => setEvents(e.target.value)}
                                    className="min-h-[60px] rounded-xl text-xs"
                                />
                            </div>

                            {/* Extra Notes */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Note / Istruzioni Extra (opzionale)</Label>
                                <Input
                                    placeholder="es. Spingere i Reel parlati, evitare sconti..."
                                    value={extraNotes}
                                    onChange={(e) => setExtraNotes(e.target.value)}
                                    className="rounded-xl text-xs"
                                />
                            </div>

                            {/* Generate Button */}
                            <Button
                                onClick={handleGenerate}
                                className="w-full py-6 rounded-xl font-bold text-base bg-gradient-to-r from-primary to-amber-500 hover:from-primary/90 hover:to-amber-500/90 text-white shadow-lg shadow-primary/20 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                                disabled={isGenerating}
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generazione AI in corso...
                                    </>
                                ) : (
                                    <>
                                        Genera Strategia AI <Sparkles className="ml-2 h-5 w-5" />
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Output / Live Generation Stepper */}
                <div className="lg:col-span-7">
                    {isGenerating ? (
                        <Card className="h-full border-primary/30 shadow-2xl bg-card/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center min-h-[480px]">
                            <div className="relative mb-6">
                                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                                <div className="p-4 rounded-full bg-primary/10 border border-primary/30 text-primary relative">
                                    <Bot className="h-12 w-12 animate-bounce" />
                                </div>
                            </div>

                            <h3 className="text-xl font-bold font-headline text-foreground">
                                L'Intelligenza Artificiale sta creando la tua strategia
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1 max-w-md">
                                Elaborazione in tempo reale basata sul profilo cliente e gli obiettivi impostati
                            </p>

                            {/* Live Stepper Indicator */}
                            <div className="w-full max-w-md mt-6 space-y-3">
                                <div className="flex items-center justify-between text-xs font-semibold text-primary">
                                    <span>Passo {GENERATION_STEPS[generationStepIdx].step} di {GENERATION_STEPS.length}</span>
                                    <span>{GENERATION_STEPS[generationStepIdx].progress}%</span>
                                </div>
                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-primary to-amber-500 transition-all duration-700 ease-out rounded-full"
                                        style={{ width: `${GENERATION_STEPS[generationStepIdx].progress}%` }}
                                    />
                                </div>
                                <p className="text-xs font-medium text-foreground/80 animate-pulse transition-all">
                                    {GENERATION_STEPS[generationStepIdx].text}
                                </p>
                            </div>
                        </Card>
                    ) : generatedResult ? (
                        <div className="space-y-6">
                            {/* Action Bar */}
                            <div className="flex items-center justify-between sticky top-[80px] z-10 bg-background/95 backdrop-blur-xl p-3 rounded-2xl border shadow-lg border-border/80">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                    <span className="text-xs font-bold text-foreground">Strategia Pronta</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleSave('bozza')} className="rounded-xl text-xs">
                                        <Save className="mr-1.5 h-3.5 w-3.5" /> Salva Bozza
                                    </Button>
                                    <Button size="sm" onClick={() => handleSave('inviata')} className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-500 text-white">
                                        <Send className="mr-1.5 h-3.5 w-3.5" /> Segna Inviata
                                    </Button>
                                </div>
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
                        <Card className="h-full border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center p-8 text-center min-h-[440px]">
                            <ShieldAlert className="h-14 w-14 text-destructive mb-3" />
                            <h3 className="text-lg font-bold text-foreground">Generazione AI non riuscita</h3>
                            <p className="text-xs text-muted-foreground max-w-md mt-1 mb-2">{error}</p>
                            {errorDetails && (
                                <p className="text-[11px] font-mono bg-muted/60 p-2 rounded-lg text-muted-foreground max-w-md overflow-x-auto">
                                    {errorDetails}
                                </p>
                            )}
                            <Button onClick={handleGenerate} className="mt-4 rounded-xl" variant="outline">
                                <RefreshCw className="mr-2 h-4 w-4" /> Riprova Ora
                            </Button>
                        </Card>
                    ) : (
                        <Card className="h-full border-dashed border-2 flex flex-col items-center justify-center p-8 text-center min-h-[440px] bg-card/40">
                            <Bot className="h-16 w-16 text-muted-foreground/30 mb-3" />
                            <h3 className="text-lg font-semibold text-foreground">La strategia AI apparirà qui</h3>
                            <p className="text-xs text-muted-foreground max-w-sm mt-1">
                                Seleziona un cliente o scegli un modello rapido in alto per iniziare subito la generazione.
                            </p>
                        </Card>
                    )}
                </div>
            </div>
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
