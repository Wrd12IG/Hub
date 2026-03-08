'use client';

import { useState, useEffect } from 'react';
import { Client, SocialProfile, SocialStrategy } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { updateClientSocialProfile, getSocialStrategiesByClient } from '@/lib/social-strategy-actions';
import { Bot, Plus, ArrowRight, History, Save, Sparkles, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface SocialProfileSectionProps {
    client: Client;
}

const PLATFORMS = ['Instagram', 'LinkedIn', 'Facebook', 'TikTok', 'X', 'YouTube'];
const TONES = ['Professionale', 'Creativo & Bold', 'Empatico', 'Ironico & Fun', 'Luxury & Elegante', 'Motivazionale'];
const SECTORS = ['Moda & Lifestyle', 'Food & Beverage', 'Tech & SaaS', 'TECH & IT', 'Automotive', 'Marketing', 'Real Estate', 'Salute & Benessere', 'Retail', 'B2B', 'Turismo', 'Educazione', 'Altro'];

export function SocialProfileSection({ client }: SocialProfileSectionProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [strategies, setStrategies] = useState<SocialStrategy[]>([]);
    const { toast } = useToast();

    const [profile, setProfile] = useState<SocialProfile>(client.socialProfile || {
        platforms: [],
        toneOfVoice: '',
        sector: '',
        targetAudience: '',
        competitors: '',
        thingsToAvoid: '',
        aiInfo: '',
        frequencyDefault: 'mensile'
    });

    useEffect(() => {
        const fetchStrategies = async () => {
            const data = await getSocialStrategiesByClient(client.id);
            setStrategies(data);
        };
        fetchStrategies();
    }, [client.id]);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            await updateClientSocialProfile(client.id, profile);
            toast({ title: 'Salvato', description: 'Profilo social aggiornato con successo.' });
            setIsEditing(false);
        } catch (error) {
            toast({ title: 'Errore', description: 'Impossibile salvare il profilo.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const togglePlatform = (platform: string) => {
        setProfile(prev => ({
            ...prev,
            platforms: prev.platforms.includes(platform)
                ? prev.platforms.filter(p => p !== platform)
                : [...prev.platforms, platform]
        }));
    };

    const lastStrategy = strategies[0];
    const isProfileComplete = profile.platforms.length > 0 && profile.toneOfVoice && profile.sector;

    return (
        <div className="space-y-6">
            {!isProfileComplete && (
                <Card className="bg-yellow-500/10 border-yellow-500/20">
                    <CardContent className="pt-6 flex items-center gap-4">
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                        <div className="flex-1 text-sm text-yellow-700 dark:text-yellow-400">
                            <strong>Profilo incompleto:</strong> Completa il profilo social del cliente per ottenere strategie più accurate dall'AI.
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>Completa ora</Button>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="glass-card h-full">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <Bot className="h-5 w-5 text-primary" /> Profilo Social & Marketing
                            </CardTitle>
                            <CardDescription>Configurazione del tono di voce e strategia</CardDescription>
                        </div>
                        {!isEditing && (
                            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>Modifica</Button>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isEditing ? (
                            <div className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <Label>Piattaforme Attive</Label>
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {PLATFORMS.map(p => (
                                            <div key={p} className="flex items-center space-x-2 bg-accent/50 px-3 py-2 rounded-md border">
                                                <Checkbox
                                                    id={`p-${p}`}
                                                    checked={profile.platforms.includes(p)}
                                                    onCheckedChange={() => togglePlatform(p)}
                                                />
                                                <label htmlFor={`p-${p}`} className="text-sm font-medium leading-none cursor-pointer">{p}</label>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Tono di Voce</Label>
                                        <Select value={profile.toneOfVoice} onValueChange={(v) => setProfile({ ...profile, toneOfVoice: v })}>
                                            <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                                            <SelectContent>
                                                {TONES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Settore Comunicativo</Label>
                                        <Select value={profile.sector} onValueChange={(v) => setProfile({ ...profile, sector: v })}>
                                            <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                                            <SelectContent>
                                                {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Target Audience</Label>
                                    <Input
                                        placeholder="es. donne 30-45, Milano, interesse moda"
                                        value={profile.targetAudience}
                                        onChange={(e) => setProfile({ ...profile, targetAudience: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Competitor Principali</Label>
                                    <Input
                                        placeholder="es. Competitor A, Competitor B"
                                        value={profile.competitors}
                                        onChange={(e) => setProfile({ ...profile, competitors: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Cose da Evitare</Label>
                                    <Input
                                        placeholder="es. no politica, no prezzi espliciti"
                                        value={profile.thingsToAvoid}
                                        onChange={(e) => setProfile({ ...profile, thingsToAvoid: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Informazioni utili per l'AI (Brief Permanente)</Label>
                                    <Textarea
                                        placeholder="Note fisse che l'AI userà sempre in ogni strategia..."
                                        className="min-h-[100px]"
                                        value={profile.aiInfo}
                                        onChange={(e) => setProfile({ ...profile, aiInfo: e.target.value })}
                                    />
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <div className="flex items-center gap-2">
                                        <Label>Frequenza Default:</Label>
                                        <Badge variant="outline" className="capitalize">{profile.frequencyDefault}</Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">Settimanale</span>
                                        <Switch
                                            checked={profile.frequencyDefault === 'mensile'}
                                            onCheckedChange={(v) => setProfile({ ...profile, frequencyDefault: v ? 'mensile' : 'settimanale' })}
                                        />
                                        <span className="text-sm font-medium">Mensile</span>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-4">
                                    <Button className="flex-1" onClick={handleSave} disabled={isLoading}>
                                        {isLoading ? 'Salvataggio...' : 'Salva Profilo'} <Save className="ml-2 h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" onClick={() => {
                                        setProfile(client.socialProfile || {
                                            platforms: [],
                                            toneOfVoice: '',
                                            sector: '',
                                            targetAudience: '',
                                            competitors: '',
                                            thingsToAvoid: '',
                                            aiInfo: '',
                                            frequencyDefault: 'mensile'
                                        });
                                        setIsEditing(false);
                                    }}>Annulla</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6 pt-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground uppercase font-semibold">Tono di Voce</p>
                                        <p className="text-sm">{profile.toneOfVoice || '-'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground uppercase font-semibold">Settore</p>
                                        <p className="text-sm">{profile.sector || '-'}</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-xs text-muted-foreground uppercase font-semibold">Piattaforme</p>
                                    <div className="flex flex-wrap gap-2">
                                        {profile.platforms.length > 0 ? (
                                            profile.platforms.map(p => <Badge key={p} variant="secondary">{p}</Badge>)
                                        ) : (
                                            <p className="text-sm italic">- Nessuna selezionata -</p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground uppercase font-semibold">Target Audience</p>
                                    <p className="text-sm">{profile.targetAudience || '-'}</p>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground uppercase font-semibold">Brief Permanente</p>
                                    <p className="text-sm line-clamp-4 whitespace-pre-wrap">{profile.aiInfo || '-'}</p>
                                </div>

                                <div className="pt-4 flex items-center justify-between border-t border-dashed">
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground uppercase font-semibold">Frequenza</p>
                                        <Badge className="capitalize">{profile.frequencyDefault}</Badge>
                                    </div>
                                    <Button asChild className="rainbow-border">
                                        <Link href={`/social-strategies/new?clientId=${client.id}`}>
                                            Genera Strategia <Sparkles className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="glass-card h-full flex flex-col">
                    <CardHeader>
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <History className="h-5 w-5 text-primary" /> Ultime Strategie Generated
                        </CardTitle>
                        <CardDescription>Storico rapido per {client.name}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-4">
                        <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                            <div className="text-center p-3 bg-accent/20 rounded-lg">
                                <p className="text-2xl font-bold text-primary">{strategies.length}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Totali</p>
                            </div>
                            <div className="text-center p-3 bg-accent/20 rounded-lg">
                                <p className="text-xs font-semibold">{lastStrategy ? format(new Date(lastStrategy.generationDate), 'dd/MM/yy', { locale: it }) : '-'}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ultima</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {strategies.slice(0, 5).map(s => (
                                <Link
                                    key={s.id}
                                    href={`/social-strategies/${s.id}`}
                                    className="flex items-center justify-between p-3 border rounded-md hover:bg-accent/50 transition-colors group"
                                >
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">{s.periodLabel}</span>
                                        <span className="text-[10px] text-muted-foreground capitalize">{s.frequency}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge variant={s.status === 'inviata' ? 'default' : s.status === 'archiviata' ? 'secondary' : 'outline'} className="text-[10px]">
                                            {s.status}
                                        </Badge>
                                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                </Link>
                            ))}
                            {strategies.length === 0 && (
                                <p className="text-center py-8 text-sm text-muted-foreground italic">Nessuna strategia ancora generata.</p>
                            )}
                        </div>
                    </CardContent>
                    <div className="p-6 pt-0 mt-auto">
                        <Button variant="outline" className="w-full" asChild>
                            <Link href={`/social-strategies?clientId=${client.id}`}>Vedi tutto lo storico</Link>
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
}
