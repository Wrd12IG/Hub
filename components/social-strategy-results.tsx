'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
    Calendar,
    Sparkles,
    Mail,
    Lightbulb,
    Target,
    CheckCircle2,
    Info,
    Copy,
    FileText,
    Download,
    Layers,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveAs } from 'file-saver';

interface SocialStrategyResultsProps {
    result: {
        sommario_strategico: string;
        obiettivi: string[];
        messaggio_chiave: string;
        calendario: Array<{
            giorno: string;
            piattaforma: string;
            formato: string;
            topic: string;
            caption: string;
            cta: string;
        }>;
        idee_wow: Array<{
            titolo: string;
            descrizione: string;
            impatto_atteso: string;
        }>;
        kpi: string[];
        testo_email: string;
    };
    clientName?: string;
    periodLabel?: string;
}

export function SocialStrategyResults({ result, clientName, periodLabel }: SocialStrategyResultsProps) {
    const { toast } = useToast();
    const [emailText, setEmailText] = useState(result.testo_email);
    const [expandedIdea, setExpandedIdea] = useState<number | null>(null);

    const copyToClipboard = (text: string, title: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: 'Copiato', description: `${title} copiato negli appunti.` });
    };

    const exportToWord = async () => {
        const { Document, Packer, Paragraph, HeadingLevel } = await import('docx');

        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    new Paragraph({ text: `Strategia Social - ${clientName || 'Cliente'}`, heading: HeadingLevel.HEADING_1 }),
                    new Paragraph({ text: `Periodo: ${periodLabel || 'N/D'}`, heading: HeadingLevel.HEADING_2 }),
                    new Paragraph({ text: "" }),
                    new Paragraph({ text: "Sommario Strategico", heading: HeadingLevel.HEADING_3 }),
                    new Paragraph({ text: result.sommario_strategico }),
                    new Paragraph({ text: "" }),
                    new Paragraph({ text: "Obiettivi", heading: HeadingLevel.HEADING_3 }),
                    ...result.obiettivi.map(o => new Paragraph({ text: `• ${o}`, bullet: { level: 0 } })),
                    new Paragraph({ text: "" }),
                    new Paragraph({ text: "Messaggio Chiave", heading: HeadingLevel.HEADING_3 }),
                    new Paragraph({ text: result.messaggio_chiave, style: "Strong" }),
                    new Paragraph({ text: "" }),
                    new Paragraph({ text: "Calendario Editoriale", heading: HeadingLevel.HEADING_3 }),
                    ...result.calendario.flatMap(c => [
                        new Paragraph({ text: `${c.giorno} - ${c.piattaforma} (${c.formato})`, heading: HeadingLevel.HEADING_4 }),
                        new Paragraph({ text: `Topic: ${c.topic}` }),
                        new Paragraph({ text: `caption: ${c.caption}` }),
                        new Paragraph({ text: `CTA: ${c.cta}` }),
                        new Paragraph({ text: "" }),
                    ])
                ],
            }],
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, `Strategia_${clientName || 'Social'}_${periodLabel || ''}.docx`);
    };

    const exportToPPTX = async () => {
        toast({ title: 'Esportazione in corso', description: 'Preparazione del file PowerPoint...' });

        try {
            // Dynamic import of pptxgenjs
            const pptxgenModule = await import('pptxgenjs');
            const PptxGenJS = pptxgenModule.default || pptxgenModule;
            const pres = new PptxGenJS();

            const PRIMARY_COLOR = '2563EB'; // Blue primary from globals.css

            // Slide 1: Copertina
            const slide1 = pres.addSlide();
            slide1.addText(`Strategia Social`, { x: 1, y: 1.5, w: '80%', h: 1, fontSize: 44, bold: true, color: '363636', align: 'center' });
            slide1.addText(clientName || 'Cliente', { x: 1, y: 2.5, w: '80%', h: 0.5, fontSize: 32, color: 'FFD700', align: 'center' });
            slide1.addText(periodLabel || '', { x: 1, y: 3.2, w: '80%', h: 0.5, fontSize: 18, color: '808080', align: 'center' });

            // Slide 2: Sommario & Obiettivi
            const slide2 = pres.addSlide();
            slide2.addText('Visione Strategica', { x: 0.5, y: 0.5, fontSize: 28, bold: true, color: PRIMARY_COLOR });
            slide2.addText(result.sommario_strategico, { x: 0.5, y: 1.2, w: '90%', fontSize: 14 });
            slide2.addText('Obiettivi:', { x: 0.5, y: 2.5, fontSize: 18, bold: true });
            slide2.addText(result.obiettivi.map(o => `• ${o}`).join('\n'), { x: 0.5, y: 2.9, w: '90%', fontSize: 12 });

            // Slide 3: Messaggio Chiave
            const slide3 = pres.addSlide();
            slide3.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: PRIMARY_COLOR } });
            slide3.addText('MESSAGGIO CHIAVE', { x: 0, y: 1.5, w: '100%', h: 1, fontSize: 24, color: 'ffffff', align: 'center', bold: true });
            slide3.addText(`"${result.messaggio_chiave}"`, { x: 1, y: 2.5, w: '80%', h: 2, fontSize: 36, color: 'ffffff', align: 'center', italic: true });

            // Slide 4+: Calendario (Simplified for export)
            result.calendario.forEach((c, idx) => {
                if (idx % 2 === 0) {
                    const slide = pres.addSlide();
                    slide.addText(`Piano Editoriale - Parte ${Math.floor(idx / 2) + 1}`, { x: 0.5, y: 0.3, fontSize: 24, bold: true });

                    // Item 1
                    slide.addText(`${c.giorno} | ${c.piattaforma}`, { x: 0.5, y: 1, w: 4, fontSize: 16, bold: true, color: PRIMARY_COLOR });
                    slide.addText(`Formato: ${c.formato}\nTopic: ${c.topic}\nCTA: ${c.cta}`, { x: 0.5, y: 1.5, w: 4, fontSize: 11 });
                    slide.addText(c.caption || '', { x: 0.5, y: 2.8, w: 4, h: 2.5, fontSize: 9, italic: true, color: '666666' });

                    // Item 2 (if exists)
                    const next = result.calendario[idx + 1];
                    if (next) {
                        slide.addText(`${next.giorno} | ${next.piattaforma}`, { x: 5.5, y: 1, w: 4, fontSize: 16, bold: true, color: PRIMARY_COLOR });
                        slide.addText(`Formato: ${next.formato}\nTopic: ${next.topic}\nCTA: ${next.cta}`, { x: 5.5, y: 1.5, w: 4, fontSize: 11 });
                        slide.addText(next.caption || '', { x: 5.5, y: 2.8, w: 4, h: 2.5, fontSize: 9, italic: true, color: '666666' });
                    }
                }
            });

            // Final Slide: Idee WOW & KPI
            const slideFinal = pres.addSlide();
            slideFinal.addText('Idee WOW ✨', { x: 0.5, y: 0.5, fontSize: 28, bold: true, color: PRIMARY_COLOR });
            slideFinal.addText(result.idee_wow.map(i => `★ ${i.titolo}: ${i.descrizione}`).join('\n\n'), { x: 0.5, y: 1.2, w: '90%', fontSize: 11 });
            slideFinal.addText('Principali KPI:', { x: 0.5, y: 4, fontSize: 18, bold: true });
            slideFinal.addText(result.kpi.join('  |  '), { x: 0.5, y: 4.4, w: '90%', fontSize: 12 });

            const fileName = `Strategia_Social_${clientName || ''}_${new Date().toISOString().split('T')[0]}.pptx`;
            await pres.writeFile({ fileName });

            toast({ title: 'Completato', description: 'File PowerPoint generato con successo.' });
        } catch (error) {
            console.error('Error exporting to PPTX:', error);
            toast({
                title: 'Errore',
                description: 'Impossibile generare il file PowerPoint. Controlla la console per i dettagli.',
                variant: 'destructive'
            });
        }
    };

    return (
        <Card className="glass-card overflow-hidden">
            <Tabs defaultValue="strategia" className="w-full">
                <div className="bg-accent/50 p-1 border-b">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="strategia" className="flex gap-2"><Target className="h-4 w-4" /> Strategia</TabsTrigger>
                        <TabsTrigger value="calendario" className="flex gap-2"><Calendar className="h-4 w-4" /> Calendario</TabsTrigger>
                        <TabsTrigger value="idee" className="flex gap-2"><Sparkles className="h-4 w-4 ml-1" /> Idee WOW</TabsTrigger>
                        <TabsTrigger value="email" className="flex gap-2"><Mail className="h-4 w-4" /> Email</TabsTrigger>
                    </TabsList>
                </div>

                <div className="p-6">
                    <TabsContent value="strategia" className="space-y-6 mt-0">
                        <section className="space-y-2">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
                                <Info className="h-4 w-4" /> Sommario Strategico
                            </h3>
                            <p className="text-lg font-medium leading-relaxed">{result.sommario_strategico}</p>
                        </section>

                        <div className="grid gap-6 md:grid-cols-2">
                            <section className="space-y-3">
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">Obiettivi del Periodo</h3>
                                <div className="space-y-2">
                                    {result.obiettivi.map((o, i) => (
                                        <div key={i} className="flex gap-3 items-start p-3 bg-card border rounded-lg">
                                            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                                            <span className="text-sm">{o}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="space-y-3">
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">Messaggio Chiave / Claim</h3>
                                <div className="p-6 bg-primary/5 border border-primary/20 rounded-xl relative overflow-hidden group">
                                    <Sparkles className="absolute -right-4 -top-4 h-24 w-24 text-primary/10 group-hover:scale-110 transition-transform" />
                                    <p className="text-2xl font-bold italic text-center text-primary relative z-10">"{result.messaggio_chiave}"</p>
                                </div>
                                <div className="pt-4 space-y-2">
                                    <h3 className="text-xs font-bold uppercase text-muted-foreground">KPI di Riferimento</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {result.kpi.map(k => <Badge key={k} variant="outline" className="bg-background">{k}</Badge>)}
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div className="flex gap-2 pt-4 border-t">
                            <Button variant="outline" size="sm" onClick={exportToWord}><FileText className="mr-2 h-4 w-4" /> Word .docx</Button>
                            <Button variant="outline" size="sm" onClick={exportToPPTX}><Download className="mr-2 h-4 w-4" /> PowerPoint .pptx</Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="calendario" className="mt-0">
                        <div className="grid gap-4 md:grid-cols-2">
                            {result.calendario.map((item, i) => (
                                <Card key={i} className="overflow-hidden border-l-4 border-l-primary group">
                                    <div className="bg-accent/30 p-3 flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Badge className="bg-primary">{item.piattaforma}</Badge>
                                            <span className="text-xs font-bold uppercase">{item.giorno}</span>
                                        </div>
                                        <Badge variant="outline" className="text-[10px]">{item.formato}</Badge>
                                    </div>
                                    <CardContent className="p-4 space-y-3">
                                        <div>
                                            <p className="text-xs font-bold text-muted-foreground uppercase">Topic</p>
                                            <p className="text-sm font-medium">{item.topic}</p>
                                        </div>
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <p className="text-xs font-bold text-muted-foreground uppercase">Caption</p>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => copyToClipboard(item.caption, 'Caption')}
                                                >
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            <p className="text-xs whitespace-pre-wrap italic bg-accent/20 p-2 rounded">{item.caption}</p>
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t">
                                            <span className="text-[10px] font-bold text-primary italic">CTA: {item.cta}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="idee" className="mt-0 space-y-4">
                        {result.idee_wow.map((idea, i) => (
                            <Card key={i} className={`transition-all ${expandedIdea === i ? 'ring-2 ring-primary' : 'hover:bg-accent/50 cursor-pointer'}`} onClick={() => setExpandedIdea(expandedIdea === i ? null : i)}>
                                <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-yellow-400/20 flex items-center justify-center text-yellow-600">
                                            <Lightbulb className="h-6 w-6" />
                                        </div>
                                        <CardTitle className="text-lg">{idea.titolo}</CardTitle>
                                    </div>
                                    {expandedIdea === i ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                </CardHeader>
                                {expandedIdea === i && (
                                    <CardContent className="p-4 pt-0 space-y-4 animate-in slide-in-from-top-2">
                                        <div className="p-4 bg-accent/30 rounded-lg">
                                            <p className="text-sm font-bold mb-1">Come eseguirla:</p>
                                            <p className="text-sm leading-relaxed">{idea.descrizione}</p>
                                        </div>
                                        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                                            <p className="text-sm font-bold text-green-700 dark:text-green-400 mb-1 flex items-center gap-2">
                                                <Sparkles className="h-4 w-4" /> Impatto Atteso:
                                            </p>
                                            <p className="text-sm text-green-800 dark:text-green-300 italic">{idea.impatto_atteso}</p>
                                        </div>
                                    </CardContent>
                                )}
                            </Card>
                        ))}
                    </TabsContent>

                    <TabsContent value="email" className="mt-0 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Preview Email per il Cliente</h3>
                            <Button variant="outline" size="sm" onClick={() => copyToClipboard(emailText, 'Email')}>
                                <Copy className="mr-2 h-4 w-4" /> Copia Testo
                            </Button>
                        </div>
                        <Textarea
                            className="min-h-[400px] font-serif p-6 bg-card leading-relaxed text-sm h-auto"
                            value={emailText}
                            onChange={(e) => setEmailText(e.target.value)}
                        />
                    </TabsContent>
                </div>
            </Tabs>
        </Card>
    );
}
