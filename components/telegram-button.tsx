'use client';

/**
 * components/telegram-button.tsx
 *
 * Collegamento personale a Telegram, dall'intestazione del Hub: ognuno collega la propria chat con un clic (il Hub genera
 * un link del bot valido 15 minuti), prova il messaggio e può scollegare. Gli amministratori attivano il bot una volta.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, Send, Unplug } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/client-api-auth';
import { cn } from '@/lib/utils';

interface Status { configured: boolean; linked: boolean; isAdmin: boolean; botUsername?: string | null; webhookReady?: boolean | null; error?: string }

export function TelegramButton() {
    const [open, setOpen] = useState(false);
    const [st, setSt] = useState<Status | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [message, setMessage] = useState('');
    const [waiting, setWaiting] = useState(false);
    const poll = useRef<ReturnType<typeof setInterval> | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await authFetch('/api/telegram');
            const d = await res.json().catch(() => ({}));
            if (res.ok) setSt(d as Status);
        } catch { /* resta l'ultimo stato */ }
    }, []);

    const stopPolling = () => { if (poll.current) { clearInterval(poll.current); poll.current = null; } setWaiting(false); };
    useEffect(() => () => stopPolling(), []);
    useEffect(() => { if (open) { setMessage(''); load(); } else stopPolling(); }, [open, load]);
    useEffect(() => { if (st?.linked && waiting) { stopPolling(); setMessage('Collegato!'); } }, [st?.linked, waiting]);

    const run = async (action: 'link' | 'test' | 'unlink' | 'setup') => {
        setBusy(action); setMessage('');
        try {
            const res = await authFetch('/api/telegram', { method: 'POST', body: JSON.stringify({ action }) });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(d.error || 'Operazione non riuscita.');
            if (action === 'link') {
                window.open(d.url, '_blank', 'noopener');
                setWaiting(true);
                setMessage('Apri Telegram, premi «Avvia» (o Start) nel bot: qui si aggiorna da solo.');
                // Il bot salva la chat quando riceve il codice: si controlla ogni 3 secondi per 2 minuti
                const until = Date.now() + 120_000;
                poll.current = setInterval(() => { if (Date.now() > until) { stopPolling(); setMessage('Tempo scaduto: premi di nuovo «Collega Telegram».'); } else load(); }, 3000);
            } else if (action === 'test') setMessage('Messaggio inviato: controlla Telegram.');
            else if (action === 'unlink') setMessage('Scollegato.');
            else if (action === 'setup') setMessage('Bot attivato.');
            await load();
        } catch (e: any) {
            setMessage(e?.message || 'Operazione non riuscita.');
        } finally { setBusy(null); }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9" title="Telegram">
                    <Send className={cn('h-5 w-5 transition-colors', st?.linked ? 'text-sky-500' : 'text-muted-foreground hover:text-foreground')} />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-3 text-sm">
                <div className="flex items-center gap-2 font-semibold"><Send className="h-4 w-4 text-sky-500" /> Telegram</div>
                {!st && <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carico…</p>}

                {st && !st.configured && (
                    <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                        Il bot non è ancora attivo: manca la variabile <b>TELEGRAM_BOT_TOKEN</b> su Vercel.
                    </p>
                )}
                {st?.error && <p className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-800">{st.error}</p>}

                {st?.configured && st.isAdmin && st.webhookReady === false && (
                    <div className="space-y-1.5 rounded-md border border-sky-300 bg-sky-50 p-2">
                        <p className="text-xs text-sky-900">Da fare una volta sola: attiva il collegamento del bot con il Hub.</p>
                        <Button size="sm" className="w-full" disabled={!!busy} onClick={() => run('setup')}>{busy === 'setup' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Attiva il bot</Button>
                    </div>
                )}

                {st?.configured && !st.error && (st.webhookReady !== false || !st.isAdmin) && (
                    st.linked ? (
                        <div className="space-y-2">
                            <p className="flex items-center gap-1.5 text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Collegato: gli avvisi arrivano su Telegram.</p>
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" className="flex-1" disabled={!!busy} onClick={() => run('test')}>{busy === 'test' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Messaggio di prova</Button>
                                <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run('unlink')} title="Scollega"><Unplug className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">Ricevi su Telegram gli avvisi del Hub, per esempio le storie da completare a mano.</p>
                            <Button size="sm" className="w-full" disabled={!!busy || waiting} onClick={() => run('link')}>
                                {busy === 'link' || waiting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}Collega Telegram
                            </Button>
                        </div>
                    )
                )}
                {message && <p className="text-xs text-muted-foreground">{message}</p>}
            </PopoverContent>
        </Popover>
    );
}
