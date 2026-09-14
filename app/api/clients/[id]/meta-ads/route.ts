import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessClientAllowed } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { getData } from '@/lib/windsor-client';

export const maxDuration = 60;

/**
 * GET /api/clients/[id]/meta-ads
 *
 * Campagne Meta da Windsor, la stessa fonte della scheda nella Overview e
 * della tab Campagne.
 *
 * Prima passava dai client API interni, che pretendono un token OAuth **per
 * singolo cliente**: nessun cliente ce l'ha, quindi la pagina mostrava zeri
 * da sempre — spesa €0,00, CPA €0,00, ROAS 0,00x — senza distinguere fra
 * "questo cliente non fa campagne Meta" e "il Hub non sa leggerle". È lo
 * stesso difetto che avevamo tolto a Google Ads e alla tab Campagne.
 */
/**
 * Gli acquisti, in ordine di affidabilità. Se l'account ne registra, la
 * conversione è quella: è l'unica legata al fatturato.
 */
const PURCHASE_FIELDS = [
  'actions_omni_purchase',
  'actions_offsite_conversion_fb_pixel_purchase',
  'actions_purchase',
] as const;

/**
 * Le altre azioni possibili. Quando non ci sono acquisti si prende quella con
 * **più volume**, non la prima di una classifica teorica.
 *
 * Il primo tentativo ordinava per "vicinanza al fatturato" e su un account
 * reale ha scelto 9 registrazioni invece di 267 aggiunte al carrello,
 * producendo un CPA di €95 su €858 di spesa: un numero costruito sul rumore.
 * Le campagne di quell'account si chiamano letteralmente "Add to cart".
 */
const OTHER_ACTION_FIELDS = [
  'actions_lead',
  'actions_complete_registration',
  'actions_initiate_checkout',
  'actions_add_to_cart',
] as const;

const ACTION_FIELDS = [...PURCHASE_FIELDS, ...OTHER_ACTION_FIELDS] as const;

const ACTION_LABELS: Record<string, string> = {
  actions_omni_purchase: 'Acquisti',
  actions_offsite_conversion_fb_pixel_purchase: 'Acquisti (pixel)',
  actions_purchase: 'Acquisti',
  actions_lead: 'Lead',
  actions_complete_registration: 'Registrazioni',
  actions_initiate_checkout: 'Checkout avviati',
  actions_add_to_cart: 'Aggiunte al carrello',
};

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  const denied = await denyUnlessClientAllowed(auth.uid, params.id);
  if (denied) return denied;

  const snap = await adminDb.collection('clients').doc(params.id).get();
  const accountId = snap.exists ? (snap.data() as any)?.metaAdAccountId : null;
  if (!accountId) {
    return NextResponse.json(
      { campaigns: [], error: 'Questo cliente non ha un Meta Ad Account ID: inseriscilo in Setup API.' },
      { status: 503 }
    );
  }

  const raw = request.nextUrl.searchParams.get('days');
  const days = raw === '7' ? 7 : raw === '90' ? 90 : 30;

  try {
    const rows = await getData({
      connector: 'facebook',
      accountId,
      fields: ['campaign', 'campaign_id', 'campaign_status', 'spend', 'clicks', 'impressions',
        ...ACTION_FIELDS, 'action_values_omni_purchase', 'action_values_purchase', 'account_id'],
      datePreset: `last_${days}d`,
    });

    const num = (v: unknown) => (typeof v === 'number' ? v : 0);

    // Windsor restituisce più righe per campagna (per giorno, per tipo di
    // azione): vanno raggruppate e sommate.
    const byCampaign = new Map<string, any>();
    for (const r of rows) {
      const key = String(r.campaign_id || r.campaign || '');
      if (!key) continue;
      const e = byCampaign.get(key) || {
        id: key, name: String(r.campaign || key),
        status: String(r.campaign_status || 'UNKNOWN'),
        spend: 0, clicks: 0, impressions: 0, conversionValue: 0,
        actions: Object.fromEntries(ACTION_FIELDS.map((f) => [f, 0])) as Record<string, number>,
      };
      e.spend += num(r.spend);
      e.clicks += num(r.clicks);
      e.impressions += num(r.impressions);
      for (const f of ACTION_FIELDS) e.actions[f] += num(r[f]);
      e.conversionValue += num(r.action_values_omni_purchase) || num(r.action_values_purchase);
      byCampaign.set(key, e);
    }

    const round = (n: number) => Math.round(n * 100) / 100;
    const all = Array.from(byCampaign.values());

    // Qual è l'azione che *questo* account registra davvero. Verificato su un
    // account reale: zero acquisti e zero lead su tutti i campi disponibili,
    // ma 267 add-to-cart — perché le campagne ottimizzano su quello. Fissare
    // la conversione su "acquisto" avrebbe mostrato CPA €0 e ROAS 0,00x su un
    // account che spende €858 al mese e funziona.
    const totals = (f: string) => all.reduce((s, c) => s + c.actions[f], 0);
    const basis =
        PURCHASE_FIELDS.find((f) => totals(f) > 0)
        ?? OTHER_ACTION_FIELDS
            .filter((f) => totals(f) > 0)
            .sort((a, b) => totals(b) - totals(a))[0]
        ?? null;

    const campaigns = all
      .map((c) => {
        const conversions = basis ? c.actions[basis] : 0;
        return {
          id: c.id,
          name: c.name,
          status: c.status,
          spend: round(c.spend),
          clicks: c.clicks,
          impressions: c.impressions,
          conversions: round(conversions),
          // Medie ricalcolate sui totali, non sommate.
          cpa: conversions > 0 ? round(c.spend / conversions) : 0,
          // Senza valore delle conversioni il ROAS non esiste: null, non 0.
          // Uno zero si legge come "pessimo", un vuoto come "non misurabile".
          roas: c.conversionValue > 0 && c.spend > 0 ? round(c.conversionValue / c.spend) : null,
        };
      })
      .sort((a, b) => b.spend - a.spend);

    return NextResponse.json({
      campaigns,
      summary: {
        activeCampaigns: campaigns.filter((c) => c.status.toUpperCase() === 'ACTIVE').length,
        totalSpend: round(campaigns.reduce((s, c) => s + c.spend, 0)),
        avgCpa: (() => {
          const spend = campaigns.reduce((s, c) => s + c.spend, 0);
          const conv = campaigns.reduce((s, c) => s + c.conversions, 0);
          return conv > 0 ? round(spend / conv) : 0;
        })(),
        avgRoas: (() => {
          const spend = all.reduce((s, c) => s + c.spend, 0);
          const value = all.reduce((s, c) => s + c.conversionValue, 0);
          return value > 0 && spend > 0 ? round(value / spend) : null;
        })(),
      },
      // Su quale azione stiamo contando le conversioni, e come chiamarla in
      // pagina: senza questa indicazione un CPA è un numero senza unità.
      conversionBasis: basis,
      conversionLabel: basis ? ACTION_LABELS[basis] : null,
      _meta: { source: 'windsor', days },
    });
  } catch (err: any) {
    console.error(`[meta-ads] fallita per ${params.id}:`, err.message);
    return NextResponse.json({ campaigns: [], error: err.message }, { status: 503 });
  }
}
