/**
 * lib/google-ads-transparency.ts
 *
 * Annunci Google dei competitor dal dataset PUBBLICO del Centro per la trasparenza pubblicitaria
 * (`bigquery-public-data.google_ads_transparency_center.creative_stats`), letto con il service account
 * dell'agenzia. È la stessa fonte dell'interfaccia web, ma interrogabile.
 *
 * ⚠️ Il dataset non ha il dominio dell'inserzionista, solo il nome: si cerca per nome (e per etichetta del dominio)
 * limitandosi agli inserzionisti con sede in Italia. Il risultato è per INSERZIONISTA, non per competitor: se più account
 * hanno un nome simile compaiono tutti e va letto il nome.
 *
 * ⚠️ La tabella pesa ~141 GB e non è partizionata: una query legge decine di GB. Per questo una sola query per tutti i
 * competitor, tetto di byte fatturabili, e il chiamante tiene il risultato in cache.
 *
 * Serve il ruolo "Utente job BigQuery" (roles/bigquery.jobUser) al service account sul progetto.
 */

import { JWT } from 'google-auth-library';
import { readPrivateKey } from './google-private-key';

const TABLE = 'bigquery-public-data.google_ads_transparency_center.creative_stats';
/** Tetto di sicurezza per query: oltre questo BigQuery rifiuta senza addebitare. */
export const MAX_BYTES_BILLED = 150_000_000_000;

export interface TransparencyTarget { id: string; nome: string; sito?: string }

export interface AdvertiserResult {
    competitorId: string;
    advertiserId: string;
    advertiser: string;
    /** Annunci distinti mostrati in Italia, di sempre. */
    creatives: number;
    /** Di questi, quelli mostrati negli ultimi 30 giorni. */
    recent: number;
    formats: { text: number; image: number; video: number };
    firstShown: string | null;
    lastShown: string | null;
}

const strip = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Modelli di ricerca per un competitor: il nome e, se diverso, l'etichetta del dominio ("finiguerra.it" → "finiguerra"). */
export function patternsFor(target: TransparencyTarget): string[] {
    const out = new Set<string>();
    const name = strip(target.nome);
    if (name.length >= 4) out.add(name);
    if (target.sito) {
        try {
            const host = new URL(/^https?:\/\//i.test(target.sito) ? target.sito : `https://${target.sito}`).hostname.replace(/^www\./, '');
            const label = strip(host.split('.')[0].replace(/-/g, ' '));
            if (label.length >= 4) out.add(label);
        } catch { /* sito non valido: si cerca solo per nome */ }
    }
    return Array.from(out);
}

const sqlString = (s: string) => `'${s.replace(/[\\']/g, '')}'`;

export function buildQuery(targets: TransparencyTarget[], since: string): string {
    const rows = targets.flatMap((t) =>
        patternsFor(t).map((p) => `SELECT ${sqlString(t.id)} AS k, ${sqlString(`%${p}%`)} AS pattern`));
    if (rows.length === 0) throw new Error('Nessun competitor con un nome utilizzabile');
    return `WITH targets AS (
  ${rows.join('\n  UNION ALL ')}
)
SELECT
  t.k AS competitor,
  c.advertiser_id AS advertiser_id,
  ANY_VALUE(c.advertiser_disclosed_name) AS advertiser,
  COUNT(DISTINCT c.creative_id) AS creatives,
  COUNT(DISTINCT IF(rs.last_shown >= ${sqlString(since)}, c.creative_id, NULL)) AS recent,
  COUNT(DISTINCT IF(c.ad_format_type = 'TEXT', c.creative_id, NULL)) AS text_ads,
  COUNT(DISTINCT IF(c.ad_format_type = 'IMAGE', c.creative_id, NULL)) AS image_ads,
  COUNT(DISTINCT IF(c.ad_format_type = 'VIDEO', c.creative_id, NULL)) AS video_ads,
  MIN(rs.first_shown) AS first_shown,
  MAX(rs.last_shown) AS last_shown
FROM \`${TABLE}\` AS c
CROSS JOIN UNNEST(c.region_stats) AS rs
JOIN targets AS t
  ON LOWER(c.advertiser_disclosed_name) LIKE t.pattern OR LOWER(c.advertiser_legal_name) LIKE t.pattern
WHERE rs.region_code = 'IT' AND c.advertiser_location = 'IT'
GROUP BY t.k, c.advertiser_id
ORDER BY recent DESC, creatives DESC
LIMIT 300`;
}

export function parseRows(fields: { name: string }[], rows: { f: { v: string | null }[] }[]): AdvertiserResult[] {
    const idx = Object.fromEntries(fields.map((f, i) => [f.name, i]));
    const get = (r: { f: { v: string | null }[] }, name: string) => r.f[idx[name]]?.v ?? null;
    const n = (v: string | null) => (v === null ? 0 : parseInt(v, 10) || 0);
    return rows.map((r) => ({
        competitorId: String(get(r, 'competitor')),
        advertiserId: String(get(r, 'advertiser_id')),
        advertiser: String(get(r, 'advertiser') ?? ''),
        creatives: n(get(r, 'creatives')),
        recent: n(get(r, 'recent')),
        formats: { text: n(get(r, 'text_ads')), image: n(get(r, 'image_ads')), video: n(get(r, 'video_ads')) },
        firstShown: get(r, 'first_shown'),
        lastShown: get(r, 'last_shown'),
    }));
}

/** Il 403 che capita davvero: manca il ruolo. Google lo dice in inglese e senza dire cosa fare. */
export function explainBigQueryError(status: number, message: string, project: string, email: string): string {
    if (status === 403 && /jobs\.create|bigquery\.jobs|permission/i.test(message)) {
        return `Manca il permesso BigQuery: in Google Cloud, progetto ${project}, IAM, dai al service account ${email} il ruolo «Utente job BigQuery» (BigQuery Job User).`;
    }
    if (/has not been used|is disabled|accessNotConfigured/i.test(message)) {
        return `L'API BigQuery non è attiva sul progetto ${project}: abilitala da Google Cloud, API e servizi.`;
    }
    if (/bytes billed|exceeds/i.test(message)) {
        return 'La ricerca supera il tetto di dati consentito per una singola lettura: riprova con meno competitor.';
    }
    return `BigQuery ha risposto ${status}: ${message.slice(0, 160)}`;
}

function getClient(): { jwt: JWT; project: string; email: string } {
    const email = process.env.GOOGLE_ANALYTICS_SERVICE_ACCOUNT_EMAIL;
    const key = readPrivateKey('GOOGLE_ANALYTICS_PRIVATE_KEY');
    if (!email || !key) throw new Error('Mancano credenziali Service Account Google (GOOGLE_ANALYTICS_*)');
    // Il progetto si ricava dall'email del service account (nome@PROGETTO.iam.gserviceaccount.com)
    const project = process.env.GOOGLE_BIGQUERY_PROJECT || email.split('@')[1]?.split('.')[0] || '';
    return { jwt: new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/bigquery'] }), project, email };
}

function isoDaysAgo(days: number, now = new Date()): string {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
}

/** Cerca gli inserzionisti italiani corrispondenti ai competitor. Lancia errori già spiegati in italiano. */
export async function searchAdvertisers(targets: TransparencyTarget[], now = new Date()): Promise<AdvertiserResult[]> {
    const { jwt, project, email } = getClient();
    const query = buildQuery(targets, isoDaysAgo(30, now));
    const base = `https://bigquery.googleapis.com/bigquery/v2/projects/${project}`;

    try {
        let res: any = (await jwt.request({
            url: `${base}/queries`, method: 'POST',
            data: { query, useLegacySql: false, maximumBytesBilled: String(MAX_BYTES_BILLED), timeoutMs: 50_000, maxResults: 1000 },
        })).data;

        // Se la query supera il timeout iniziale, si aspetta il risultato dello stesso job
        for (let i = 0; !res.jobComplete && i < 6; i++) {
            await new Promise((r) => setTimeout(r, 4000));
            res = (await jwt.request({
                url: `${base}/queries/${res.jobReference.jobId}?location=${res.jobReference.location ?? 'US'}&timeoutMs=8000&maxResults=1000`,
            })).data;
        }
        if (!res.jobComplete) throw new Error('La ricerca sta richiedendo troppo tempo: riprova tra poco.');
        return parseRows(res.schema?.fields ?? [], res.rows ?? []);
    } catch (e: any) {
        const status = e?.response?.status ?? e?.status ?? 0;
        const message = e?.response?.data?.error?.message ?? e?.message ?? 'errore sconosciuto';
        if (status === 0 && !e?.response) throw e;
        throw new Error(explainBigQueryError(status, message, project, email));
    }
}
