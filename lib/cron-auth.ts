import { NextResponse, type NextRequest } from 'next/server';

/**
 * lib/cron-auth.ts
 *
 * Il controllo del segreto per le route sotto /api/cron, in un posto solo.
 *
 * ⚠️ Vercel Cron invia `Authorization: Bearer <CRON_SECRET>`, NON un header
 * custom. Una route che accetta solo `x-cron-secret` risponde 401 a Vercel e
 * non gira mai — senza che nessuno se ne accorga, perché un cron che non parte
 * non produce errori da nessuna parte: produce silenzio.
 *
 * È già successo: `daily-digest` era schedulata alle 6:00 e accettava solo
 * l'header custom, quindi ha fallito ogni mattina per i tre mesi in cui
 * CRON_SECRET è esistito. `evening-report` accettava entrambi e funzionava.
 * La differenza stava in una copia del controllo rimasta indietro rispetto
 * all'altra — motivo per cui ora il controllo è qui e non duplicato.
 *
 * `x-cron-secret` resta accettato perché è quello che si usa a mano da curl.
 */
export function denyUnlessCron(request: NextRequest, tag: string): NextResponse | null {
    const cronSecret = process.env.CRON_SECRET;
    const headerSecret = request.headers.get('x-cron-secret');
    const authHeader = request.headers.get('authorization');
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const host = request.headers.get('host') || '';
    const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1');

    if (cronSecret) {
        if (headerSecret === cronSecret || bearer === cronSecret) return null;
        console.warn(`[${tag}] accesso non autorizzato da: ${host}`);
        return NextResponse.json({ error: 'Unauthorized. Secret non valido o mancante.' }, { status: 401 });
    }

    // Senza segreto configurato si passa solo in locale: in produzione una
    // route di cron aperta è una route che chiunque può far girare.
    if (isLocalhost) return null;
    return NextResponse.json(
        { error: 'Unauthorized. Configura CRON_SECRET nelle variabili ENV.' },
        { status: 401 }
    );
}
