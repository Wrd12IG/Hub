'use client';

/**
 * components/story-editor/ai-panel.tsx
 *
 * Il pannello «AI»: descrivi un'immagine e Magnific la crea in formato storia (9:16). Ogni operazione consuma crediti Magnific:
 * c'è un tetto giornaliero per utente, deciso sul server. La chiave non è mai nel browser.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { ProxiedImg } from './ProxiedImg';
import { authFetch } from '@/lib/client-api-auth';
import { Field, inputCls } from './ui';

const IDEAS = ['Auto sportiva su una strada di montagna al tramonto', 'Showroom moderno luminoso con auto nuove', 'Sfondo astratto con sfumature viola e arancio', 'Famiglia che parte per le vacanze in auto'];
const POLL_MS = 3000;
const MAX_WAIT_MS = 150_000;

interface Props {
    onAdd: (url: string) => void;
    onBackground: (url: string) => void;
}

export function AiPanel({ onAdd, onBackground }: Props) {
    const [prompt, setPrompt] = useState('');
    const [quality, setQuality] = useState<'1k' | '2k'>('2k');
    const [phase, setPhase] = useState<'idle' | 'working' | 'done' | 'error' | 'unconfigured'>('idle');
    const [message, setMessage] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);
    const alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

    const generate = async () => {
        setPhase('working'); setMessage('Sto creando l\'immagine… può richiedere fino a un minuto.'); setImages([]);
        try {
            const start = await authFetch('/api/stories/magnific/generate', { method: 'POST', body: JSON.stringify({ prompt, resolution: quality }) });
            const d = await start.json().catch(() => ({}));
            if (d.configured === false) { setPhase('unconfigured'); return; }
            if (!start.ok || !d.taskId) throw new Error(d.error || 'Non riesco ad avviare la generazione.');
            if (typeof d.used === 'number') setQuota({ used: d.used, limit: d.limit });

            const began = Date.now();
            while (alive.current && Date.now() - began < MAX_WAIT_MS) {
                await new Promise((r) => setTimeout(r, POLL_MS));
                const res = await authFetch(`/api/stories/magnific/generate?taskId=${encodeURIComponent(d.taskId)}`);
                const s = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(s.error || 'Non riesco a leggere lo stato.');
                if (s.status === 'FAILED') throw new Error(s.error || 'Generazione non riuscita.');
                if (s.status === 'COMPLETED') { setImages(s.images || []); setPhase('done'); setMessage(''); return; }
            }
            if (alive.current) throw new Error('Ci sta mettendo troppo: riprova tra poco (l\'operazione conta comunque nel limite di oggi).');
        } catch (e: any) {
            if (alive.current) { setPhase('error'); setMessage(e?.message || 'Errore imprevisto.'); }
        }
    };

    const busy = phase === 'working';
    return (
        <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-100">AI · Magnific</h3>
            <p className="rounded-md border border-sky-500/30 bg-sky-500/10 p-2 text-[11px] text-sky-100">
                Crea un&apos;immagine verticale da una descrizione. Consuma crediti Magnific{quota ? ` (oggi ${quota.used} di ${quota.limit})` : ''}. Se è realistica, valuta di segnalarla su Instagram come contenuto creato con l&apos;AI.
            </p>
            <Field label="Descrizione">
                <textarea className={inputCls} rows={4} maxLength={600} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Descrivi l'immagine: soggetto, luogo, luce, stile…" />
            </Field>
            <div className="flex flex-wrap gap-1.5">
                {IDEAS.map((i) => <button key={i} type="button" onClick={() => setPrompt(i)} className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:border-sky-500">{i}</button>)}
            </div>
            <Field label="Qualità">
                <select className={inputCls} value={quality} onChange={(e) => setQuality(e.target.value as '1k' | '2k')}>
                    <option value="2k">Alta (2K)</option>
                    <option value="1k">Standard (1K, più veloce)</option>
                </select>
            </Field>
            <button type="button" disabled={busy || prompt.trim().length < 5} onClick={generate}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{busy ? 'Creo…' : 'Genera immagine'}
            </button>
            {phase === 'unconfigured' && <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200">Servizio non ancora attivo: manca la chiave <b>MAGNIFIC_API_KEY</b> tra le variabili di Vercel.</p>}
            {message && <p role="status" className={`text-xs ${phase === 'error' ? 'text-red-300' : 'text-slate-300'}`}>{message}</p>}
            <div className="grid grid-cols-2 gap-2">
                {images.map((u) => (
                    <div key={u} className="group/card relative overflow-hidden rounded-lg border border-slate-700">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <ProxiedImg url={u} alt="Immagine creata" className="h-44 w-full object-cover" />
                        <div className="absolute inset-0 flex flex-col justify-end gap-1 bg-black/50 p-1 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100">
                            <button type="button" onClick={() => onAdd(u)} className="rounded bg-slate-900/90 py-1 text-[11px] text-white hover:bg-sky-600">Aggiungi</button>
                            <button type="button" onClick={() => onBackground(u)} className="rounded bg-slate-900/90 py-1 text-[11px] text-white hover:bg-sky-600">Usa come sfondo</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
