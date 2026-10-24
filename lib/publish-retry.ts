/**
 * lib/publish-retry.ts
 *
 * Instagram a volte risponde «Media ID is not available» (codice 9007 / sottocodice 2207027, «il contenuto non è ancora
 * pronto»): il file non è ancora stato elaborato nel momento in cui Windsor prova a pubblicare. Il post NON è stato
 * creato, quindi riprovare dopo qualche secondo è sicuro; lo stesso file poco dopo esce regolarmente (visto il 24/10/2026:
 * due errori di fila e poi la stessa immagine pubblicata). Solo questo errore si riprova: gli altri restano falliti subito.
 * Funzioni pure, con l'attesa passata da fuori per poterle collaudare.
 */

const TRANSIENT = /media id is not available|not ready for publishing|media is not ready|\b2207027\b/i;

export function isMediaNotReadyError(message: string | undefined | null): boolean {
    return !!message && TRANSIENT.test(message);
}

/** Pause prima di ogni nuovo tentativo (ms): 3 tentativi in tutto, ~28 s al massimo. */
export const RETRY_DELAYS_MS = [8_000, 20_000];

export async function executeWithRetry<T>(
    run: () => Promise<T>,
    opts: { delaysMs?: number[]; sleep?: (ms: number) => Promise<void>; canRetry?: () => boolean; onRetry?: (attempt: number, message: string) => void } = {},
): Promise<T> {
    const delays = opts.delaysMs ?? RETRY_DELAYS_MS;
    const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    let attempt = 0;
    for (;;) {
        try {
            return await run();
        } catch (err: any) {
            const message = String(err?.message || err || '');
            const wait = delays[attempt];
            if (!isMediaNotReadyError(message) || wait === undefined || (opts.canRetry && !opts.canRetry())) throw err;
            attempt++;
            opts.onRetry?.(attempt, message);
            await sleep(wait);
        }
    }
}
