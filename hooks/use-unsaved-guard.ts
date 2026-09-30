import * as React from 'react';

/**
 * Chiede conferma prima che la pagina venga abbandonata, mentre c'è lavoro
 * non salvato.
 *
 * Nata per un problema concreto: il Hub aveva `reloadOnOnline: true` in
 * next.config.js, che next-pwa traduce in
 * `window.addEventListener('online', () => location.reload())`. L'evento
 * `online` non vuol dire "è tornata la rete dopo un'ora" — scatta a ogni
 * singhiozzo del WiFi, al risveglio del portatile, a una VPN che si
 * riconnette. Chi stava scrivendo un task si vedeva ricaricare la pagina e
 * perdeva tutto, in silenzio. Quell'opzione ora è spenta, ma restano tutti gli
 * altri modi di perdere il lavoro: chiudere la scheda per sbaglio, un chunk
 * mancante dopo un deploy, un Cmd+R di troppo.
 *
 * `beforeunload` scatta anche sui reload, non solo sulle chiusure: è per
 * questo che funziona come rete di sicurezza.
 *
 * Due limiti del browser, non di questo codice:
 * - il testo del messaggio è deciso dal browser e non è personalizzabile;
 * - il dialogo compare solo se l'utente ha già interagito con la pagina
 *   (sticky activation). Per un form è sempre vero: per sporcarlo ci ha
 *   scritto dentro.
 *
 * Non impedisce le navigazioni interne di Next.js (il router non passa da
 * `beforeunload`); per quelle serve una guardia sul router, che è un'altra
 * cosa e non è questo hook.
 */
export function useUnsavedGuard(active: boolean): void {
    React.useEffect(() => {
        if (!active) return;

        const handler = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            // I browser basati su Chromium vogliono ancora returnValue, e
            // Safari il valore di ritorno. Il contenuto viene ignorato da
            // entrambi: conta solo che ci sia.
            event.returnValue = '';
            return '';
        };

        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [active]);
}
