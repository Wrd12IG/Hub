'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, limit, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SocialStrategy } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Sparkles, Calendar, MessageSquare, ThumbsUp } from 'lucide-react';

export default function ClientSharePage() {
    const { id } = useParams();
    const [strategy, setStrategy] = useState<SocialStrategy | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLatest = async () => {
            try {
                const q = query(
                    collection(db, 'social_strategies'),
                    where('clientId', '==', id),
                    orderBy('generationDate', 'desc'),
                    limit(1)
                );
                const snap = await getDocs(q);
                if (!snap.empty) {
                    setStrategy({ id: snap.docs[0].id, ...snap.docs[0].data() } as SocialStrategy);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchLatest();
    }, [id]);

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-black text-white">Caricamento strategia premium...</div>;
    if (!strategy) return <div className="min-h-screen flex items-center justify-center">Strategia non trovata.</div>;

    const data = strategy.outputJson;

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 font-sans selection:bg-primary selection:text-white">
            <div className="max-w-5xl mx-auto space-y-12">

                {/* Header Premium */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-white/10 pb-12">
                    <div className="space-y-4">
                        <Badge className="bg-primary hover:bg-primary py-1 px-4 text-xs font-bold tracking-[0.2em] uppercase rounded-full">Proposta Strategica</Badge>
                        <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
                            Piano Social <br />
                            <span className="text-primary italic">{strategy.periodLabel}</span>
                        </h1>
                        <p className="text-white/50 max-w-lg text-lg">Questa è la visione strategica curata dal team WRDigital per elevare il tuo brand nel prossimo periodo.</p>
                    </div>
                    <div className="flex flex-col items-center gap-2 p-6 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl">
                        <p className="text-[10px] uppercase tracking-widest text-white/40">Pronti a iniziare?</p>
                        <Button size="lg" className="rounded-2xl px-8 h-14 text-lg font-bold shadow-2xl shadow-primary/40 hover:scale-105 transition-all">
                            Approvazione Rapida <ThumbsUp className="ml-2 h-5 w-5" />
                        </Button>
                    </div>
                </header>

                <main className="grid gap-12">

                    {/* Strategia Vision */}
                    <section className="grid md:grid-cols-3 gap-8 items-center">
                        <div className="md:col-span-2 p-8 bg-white/5 border border-white/10 rounded-[2.5rem] relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 text-primary/10">
                                <Sparkles className="h-40 w-40" />
                            </div>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                                <div className="h-1.5 w-8 bg-primary rounded-full" /> Visione d'Insieme
                            </h3>
                            <p className="text-2xl md:text-3xl font-medium leading-relaxed relative z-10">"{data.sommario_strategico}"</p>
                        </div>
                        <div className="p-8 bg-primary/10 border border-primary/20 rounded-[2.5rem] flex flex-col justify-center text-center">
                            <h3 className="text-primary italic font-serif text-3xl mb-2">Claim Centrale</h3>
                            <p className="text-xl font-bold tracking-tight">"{data.messaggio_chiave}"</p>
                        </div>
                    </section>

                    {/* Calendario Visivo */}
                    <section className="space-y-8">
                        <h2 className="text-3xl font-bold flex items-center gap-4">
                            Il Calendario Editoriale
                            <div className="flex-1 h-px bg-white/10" />
                        </h2>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {data.calendario.map((post: any, i: number) => (
                                <Card key={i} className="bg-white/5 border-white/5 hover:border-primary/50 transition-colors group rounded-[2rem] overflow-hidden">
                                    <CardHeader className="p-6 bg-white/[0.02] flex flex-row items-center justify-between border-b border-white/5">
                                        <Badge variant="outline" className="border-white/20 text-white/60 group-hover:bg-primary group-hover:text-white transition-all">{post.piattaforma}</Badge>
                                        <span className="text-[10px] uppercase font-black text-white/30 tracking-widest">{post.giorno}</span>
                                    </CardHeader>
                                    <CardContent className="p-8 space-y-6">
                                        <div className="space-y-2">
                                            <p className="text-[10px] uppercase font-bold text-primary tracking-widest">Topic & Obiettivo</p>
                                            <p className="text-lg font-bold leading-tight">{post.topic}</p>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Contenuto (Caption)</p>
                                            <p className="text-sm text-white/80 italic leading-relaxed line-clamp-4">{post.caption}</p>
                                        </div>
                                        <div className="pt-4 flex items-center gap-2">
                                            <Badge className="bg-white/10 hover:bg-white/10 text-[9px] uppercase py-1">{post.formato}</Badge>
                                            <Badge variant="outline" className="text-[9px] border-white/10 uppercase py-1">{post.cta}</Badge>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </section>
                </main>

                <footer className="pt-24 pb-12 text-center space-y-8 border-t border-white/10">
                    <p className="text-white/40 text-sm">Realizzato con passione per il tuo futuro digitale.</p>
                    <div className="flex justify-center gap-12">
                        <div className="text-left">
                            <p className="text-[10px] uppercase tracking-widest text-primary font-bold">WRDigital Hub</p>
                            <p className="text-xs text-white/40 mt-1">Social Strategy v1.1</p>
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] uppercase tracking-widest text-primary font-bold">Contatti</p>
                            <p className="text-xs text-white/40 mt-1">info@wrdigital.it</p>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}
