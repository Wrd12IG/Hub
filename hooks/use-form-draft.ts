import * as React from 'react';

/**
 * Salva una bozza in localStorage e la ripropone alla riapertura.
 *
 * ⚠️ Non ripristina da sé. Restituisce la bozza trovata e lascia decidere a
 * chi apre, perché sovrascrivere in silenzio un form già popolato è peggio del
 * problema che si sta risolvendo: su un task esistente significherebbe
 * rimpiazzare i valori veri del server con una bozza vecchia di tre giorni,
 * senza che nessuno lo capisca.
 *
 * Perché serve, oltre alla guardia su beforeunload ([[useUnsavedGuard]]):
 * quella chiede conferma, ma se si clicca "esci" il lavoro è perso comunque, e
 * non copre un crash del browser né la batteria a zero.
 *
 * Limiti noti, da tenere in conto in chi la usa:
 * - `localStorage` può lanciare o tornare vuoto (finestra anonima, dati del
 *   sito bloccati o cancellati). Ogni lettura e scrittura è protetta, e chi
 *   chiama deve funzionare anche senza bozza;
 * - vive solo nel browser di quella persona: non è un salvataggio, è una rete;
 * - JSON non conserva i tipi. Date e oggetti non serializzabili (un `File`)
 *   vanno gestiti da chi chiama, prima di passare i valori qui.
 */

const PREFIX = 'hub:draft:';

export interface Draft<T> {
    values: T;
    savedAt: string;
    /** Note da mostrare a chi riprende: cosa la bozza NON ha potuto salvare. */
    notes?: string[];
}

export function useFormDraft<T>(
    key: string | null,
    options: { ttlMs?: number } = {}
) {
    const { ttlMs = 7 * 24 * 60 * 60 * 1000 } = options;
    const storageKey = key ? PREFIX + key : null;

    /**
     * Letta una volta al mount e tenuta ferma: se si rileggesse a ogni render,
     * il banner "c'è una bozza" sparirebbe appena si inizia a scrivere,
     * perché il primo salvataggio sovrascriverebbe ciò che si sta proponendo.
     */
    const [found, setFound] = React.useState<Draft<T> | null>(null);
    const readOnce = React.useRef(false);

    React.useEffect(() => {
        if (!storageKey || readOnce.current) return;
        readOnce.current = true;
        try {
            const raw = window.localStorage.getItem(storageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw) as Draft<T>;
            if (!parsed?.savedAt) return;
            if (Date.now() - Date.parse(parsed.savedAt) > ttlMs) {
                window.localStorage.removeItem(storageKey);
                return;
            }
            setFound(parsed);
        } catch {
            // Bozza illeggibile o storage negato: si prosegue senza.
        }
    }, [storageKey, ttlMs]);

    const save = React.useCallback((values: T, notes?: string[]) => {
        if (!storageKey) return;
        try {
            const draft: Draft<T> = { values, savedAt: new Date().toISOString(), notes };
            window.localStorage.setItem(storageKey, JSON.stringify(draft));
        } catch {
            // Quota piena o storage negato: la bozza è un extra, non un blocco.
        }
    }, [storageKey]);

    const clear = React.useCallback(() => {
        setFound(null);
        if (!storageKey) return;
        try {
            window.localStorage.removeItem(storageKey);
        } catch {
            /* niente da fare */
        }
    }, [storageKey]);

    /** Chiude il banner senza cancellare: la bozza resta per la volta dopo. */
    const dismiss = React.useCallback(() => setFound(null), []);

    return { draft: found, save, clear, dismiss };
}
