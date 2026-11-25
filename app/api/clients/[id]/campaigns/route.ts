import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser, isStaffUser, ownsClientResource } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { getData } from '@/lib/windsor-client';

// Le query a livello campagna su Windsor sono le più lente dell'applicazione
// (~4s a 90 giorni, oltre vanno in timeout): serve un tetto esplicito.
export const maxDuration = 60;

// 1 ora (era 6, come /reporting): una campagna appena pubblicata deve comparire in giornata, non a fine pomeriggio.
// 15 minuti se una piattaforma è in errore.
const CACHE_TTL_MS = 60 * 60 * 1000;
const ERROR_TTL_MS = 15 * 60 * 1000;


export type CampaignStatus = 'active' | 'scheduled' | 'paused' | 'ended';

export interface UnifiedCampaign {
  id: string;
  platform: 'meta' | 'google_ads';
  name: string;
  status: CampaignStatus;
  startDate?: string;
  endDate?: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

/** ACTIVE/ENABLED → active, PAUSED → paused, everything else → ended. */
function normalizeStatus(raw: unknown): CampaignStatus {
  const s = String(raw || '').toUpperCase();
  if (s === 'ACTIVE' || s === 'ENABLED') return 'active';
  if (s === 'PAUSED') return 'paused';
  return 'ended';
}

/** Oggi a Roma in yyyy-MM-dd: le date di fine Meta sono nel fuso dell'account (Italia). */
function todayRome(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
}

/**
 * Meta lascia `ACTIVE` anche le campagne con la data di fine passata (la consegna è "completata", lo stato no):
 * misurato il 25/11/2026 su City Motors, 50+ campagne dal 2024 ancora ACTIVE. Una campagna attiva con la fine
 * già passata è finita.
 */
function withEndDate(status: CampaignStatus, endDate?: string, startDate?: string): CampaignStatus {
  if (status !== 'active') return status;
  const today = todayRome();
  if (endDate && endDate < today) return 'ended';
  // Attiva ma con l'inizio nel futuro: programmata (ATEL, 25/11/2026: «Carosello promo» parte il 26, «Ultime ore» il 29).
  if (startDate && startDate > today) return 'scheduled';
  return status;
}

/**
 * Google Ads lascia ENABLED anche le campagne finite o non ancora partite: lo dice `campaign_primary_status`
 * (ENDED / PENDING). Gli altri valori (ELIGIBLE, LIMITED, LEARNING, …) non cambiano lo stato.
 */
function withGooglePrimaryStatus(status: CampaignStatus, primary: unknown): CampaignStatus {
  if (status !== 'active') return status;
  const p = String(primary || '').toUpperCase();
  if (p === 'ENDED') return 'ended';
  if (p === 'PENDING') return 'scheduled';
  return status;
}

/**
 * Con `include_objects_without_insights` Meta restituisce TUTTE le campagne dell'account, anche quelle del 2024 mai
 * toccate nei 90 giorni. Una campagna senza nessun dato nel periodo resta solo se è ancora attiva o programmata:
 * serve a vedere quelle appena create o in partenza, non l'archivio.
 */
function isWorthShowing(c: UnifiedCampaign): boolean {
  const hasData = c.spend > 0 || c.impressions > 0 || c.clicks > 0;
  return hasData || c.status === 'active' || c.status === 'scheduled';
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : 0;
}

/** Windsor timestamps come as ISO strings; the UI compares yyyy-MM-dd. */
function toDay(v: unknown): string | undefined {
  const s = typeof v === 'string' ? v.slice(0, 10) : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
}

const PLATFORMS = {
  meta: {
    connector: 'facebook' as const,
    // campaign_start_time / campaign_stop_time exist on Meta only.
    // Conversions = leads + purchases, not purchases alone: for a car
    // dealership (the pilot client) nobody buys online — measuring only
    // actions_purchase reported 0 conversions for an account actually
    // producing 16 leads on €491 of spend, i.e. it would have called a
    // working account broken. Summing both covers lead-gen and e-commerce.
    fields: ['campaign', 'campaign_id', 'campaign_status', 'campaign_start_time', 'campaign_stop_time',
      'spend', 'clicks', 'impressions', 'actions_lead', 'actions_purchase'],
    conversionsFields: ['actions_lead', 'actions_purchase'],
    // Meta restituisce solo le campagne con impression/spesa nel periodo: senza questa opzione una campagna appena
    // creata o programmata non compare finché non spende (ATEL, 25/11/2026: 2 campagne su 3 invisibili).
    options: { include_objects_without_insights: 'true' } as Record<string, string> | undefined,
  },
  google_ads: {
    connector: 'google_ads' as const,
    // Google Ads on Windsor exposes no campaign start/end date. Its
    // `conversions` is already whatever conversion actions the account counts.
    fields: ['campaign', 'campaign_id', 'campaign_status', 'campaign_primary_status', 'cost', 'clicks', 'impressions', 'conversions'],
    conversionsFields: ['conversions'],
    options: undefined as Record<string, string> | undefined,
  },
};

/**
 * GET /api/clients/[id]/campaigns
 *
 * Every campaign on the platforms this client has mapped, via Windsor.ai —
 * the same data layer as the rest of the reporting. It replaced a version
 * built on the Hub's own Meta/Google Ads API clients, which needed a
 * per-client OAuth/System-User token that most clients don't have: the tab
 * came up empty for exactly that reason, even for clients with live campaigns.
 *
 * Windsor returns several rows per campaign (per day, per action type), so
 * rows are grouped by campaign id and their metrics summed.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();

  const clientId = params.id;
  const user = await getAppUser(auth.uid);
  if (!isStaffUser(user) && !ownsClientResource(user, clientId)) return forbiddenResponse();

  // 90 days is the practical ceiling for campaign-level queries: measured
  // against the real account, last_90d returns in ~4s while last_180d and
  // last_365d both time out at 60s (and Vercel would kill the function first).
  // Widening this needs a different approach — paging, or per-campaign queries
  // — not just a bigger preset. ("maximum" is not a valid Windsor preset at
  // all; the allowed forms are last_Xd/Xw/Xm/Xy, last_year, last_2years,
  // this_month, this_year.)
  // `T` include oggi: senza, una campagna partita oggi non compare fino a domani. Misurato il 25/11/2026 su ATEL:
  // €12,53 spesi oggi su «Motion countdown», scheda vuota ("Nessuna campagna") perché la finestra finiva ieri.
  const datePreset = request.nextUrl.searchParams.get('date_preset') || 'last_90dT';

  const snap = await adminDb.collection('clients').doc(clientId).get();
  if (!snap.exists) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  const client = snap.data() as any;

  const accounts: Partial<Record<keyof typeof PLATFORMS, string>> = {
    meta: client?.metaAdAccountId,
    google_ads: client?.googleAdAccountId,
  };

  const refresh = request.nextUrl.searchParams.get('refresh') === '1';
  const cacheRef = adminDb.collection('clients').doc(clientId)
    // v2: scarta le copie scritte con dati vecchi e senza il controllo sulla data di fine.
    .collection('cache').doc(`campaigns_v3_${datePreset}`);
  if (!refresh) {
    const cached = await cacheRef.get().catch(() => null);
    const hit = cached?.exists ? (cached.data() as any) : null;
    if (hit && Date.now() - hit.computedAtMs < (hit.hasErrors ? ERROR_TTL_MS : CACHE_TTL_MS)) {
      // Lo stato si ricalcola anche dalla cache: una campagna può finire mentre la copia è ancora valida.
      const fromCache = (hit.campaigns as UnifiedCampaign[]).map((c) => ({ ...c, status: withEndDate(c.status, c.endDate, c.startDate) }));
      return NextResponse.json({ campaigns: fromCache, errors: hit.errors, cached: true });
    }
  }

  const campaigns: UnifiedCampaign[] = [];
  const errors: Record<string, string> = {};

  await Promise.all(
    (Object.keys(PLATFORMS) as (keyof typeof PLATFORMS)[]).map(async (platform) => {
      const accountId = accounts[platform];
      if (!accountId) return;
      const { connector, fields, conversionsFields, options } = PLATFORMS[platform];
      const sumConversions = (row: Record<string, unknown>) =>
        conversionsFields.reduce((t, f) => t + num(row[f]), 0);

      try {
        const read = (withOptions: boolean) => getData({
          connector,
          accountId,
          fields: [...fields, 'account_id'],
          datePreset,
          ...(withOptions && options ? { options } : {}),
          // Sempre lettura diretta: questa rotta ha già la sua cache di 6 ore su Firestore. Passando anche dalla
          // cache dati di Next (revalidate 300, stale-while-revalidate) il 25/11/2026 City Motors mostrava ancora i
          // numeri di inizio novembre: Federico Costa €563,68 «Attiva» contro €639,64 in pausa su Meta, e nessuna
          // delle 4 campagne partite il 23-24/11, che Windsor invece restituiva già.
          fresh: true,
          ...(platform === 'meta' && client?.metaCampaignFilter ? { campaignPrefix: client.metaCampaignFilter } : {}),
        });
        // Se Windsor rifiutasse l'opzione, si torna alla lettura di prima: meglio le sole campagne con dati che nessuna.
        const rows = await read(true).catch((err) => {
          if (!options) throw err;
          console.warn(`[campaigns] ${platform}: lettura con opzioni fallita (${err.message}), riprovo senza`);
          return read(false);
        });

        // Group by campaign id (falling back to the name when Windsor has no
        // id on a row) and sum the metrics across that campaign's rows.
        const byCampaign = new Map<string, UnifiedCampaign>();
        for (const row of rows) {
          const key = String(row.campaign_id || row.campaign || '');
          if (!key) continue;

          const existing = byCampaign.get(key);
          const spend = num(row.spend) + num(row.cost);
          if (existing) {
            existing.spend += spend;
            existing.clicks += num(row.clicks);
            existing.impressions += num(row.impressions);
            existing.conversions += sumConversions(row);
            existing.startDate = existing.startDate || toDay(row.campaign_start_time);
            existing.endDate = existing.endDate || toDay(row.campaign_stop_time);
          } else {
            byCampaign.set(key, {
              id: key,
              platform,
              name: String(row.campaign || key),
              status: platform === 'google_ads'
                ? withGooglePrimaryStatus(normalizeStatus(row.campaign_status), row.campaign_primary_status)
                : normalizeStatus(row.campaign_status),
              startDate: toDay(row.campaign_start_time),
              endDate: toDay(row.campaign_stop_time),
              spend,
              clicks: num(row.clicks),
              impressions: num(row.impressions),
              conversions: sumConversions(row),
            });
          }
        }
        for (const c of Array.from(byCampaign.values())) c.status = withEndDate(c.status, c.endDate, c.startDate);
        campaigns.push(...Array.from(byCampaign.values()).filter(isWorthShowing));
      } catch (err: any) {
        console.error(`[campaigns] ${platform} fetch failed for client ${clientId}:`, err.message);
        errors[platform] = err.message;
      }
    })
  );

  campaigns.sort((a, b) => b.spend - a.spend);

  // Il giro JSON toglie gli `undefined` (startDate/endDate), che Firestore rifiuta.
  await cacheRef
    .set(JSON.parse(JSON.stringify({
      campaigns, errors, hasErrors: Object.keys(errors).length > 0, computedAtMs: Date.now(),
    })))
    .catch((err) => console.error(`[campaigns] cache non scritta per ${clientId}:`, err.message));

  return NextResponse.json({ campaigns, errors, cached: false });
}
