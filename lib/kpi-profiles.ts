/**
 * lib/kpi-profiles.ts
 *
 * I profili KPI della mail mensile: a seconda del business del cliente cambia COSA si guarda per capire come va.
 * Questa è la Fase 1: catalogo, assegnazione dei clienti ai profili e flag «includi nella mail». Non calcola ancora
 * nessun valore e non invia nulla.
 *
 * Due regole di prodotto decise con Roberto (10/11/2026):
 *  - la mail è UNA sola, con tutti i clienti, e parte solo per i clienti con il flag `monthlyKpiMail` acceso: il flag è
 *    opt-in (un cliente nuovo NON entra finché qualcuno non lo accende);
 *  - al massimo 5 KPI per cliente.
 *
 * ⚠️ `source` dice da dove arriva il numero, NON è ancora il nome del campo Windsor. Quando in Fase 3 si collegano i
 * valori, ogni field id va verificato con get_fields: un id sbagliato non dà errore, Windsor risponde con una colonna
 * piena di null e la mail esce con zeri (stessa famiglia di errore già vista con actions_purchase).
 */

export const KPI_PROFILES = ['auto', 'ecommerce', 'locale', 'b2b', 'social'] as const;
export type KpiProfile = (typeof KPI_PROFILES)[number];

export const MAX_KPIS = 5;

export type KpiUnit = 'int' | 'eur' | 'pct' | 'ratio' | 'rating';
export type KpiSource =
    | 'meta' | 'google_ads' | 'ga4' | 'gbp' | 'instagram' | 'facebook_page' | 'linkedin' | 'tiktok'
    | 'searchconsole' | 'klaviyo' | 'awin' | 'manual';

export const SOURCE_LABELS: Record<KpiSource, string> = {
    meta: 'Meta', google_ads: 'Google Ads', ga4: 'Sito (GA4)', gbp: 'Google Maps', instagram: 'Instagram', facebook_page: 'Facebook',
    linkedin: 'LinkedIn', tiktok: 'TikTok', searchconsole: 'Ricerca Google', klaviyo: 'Email (Klaviyo)', awin: 'Awin', manual: 'Dato inserito a mano',
};

export interface KpiDef {
    id: string;
    label: string;
    unit: KpiUnit;
    /** `up`: più è alto meglio è. `down`: un costo, meglio se scende. Decide il colore della freccia nella mail. */
    better: 'up' | 'down';
    source: KpiSource;
    /** Se il dato manuale del mese manca, la mail usa questo KPI al suo posto e lo scrive («proxy»). */
    fallbackId?: string;
}

export const KPI_CATALOG: Record<string, KpiDef> = {
    // Dati inseriti a mano (sezione «Dati reali», Fase 2): ciò che la piattaforma non può sapere
    leads_real:      { id: 'leads_real',      label: 'Lead ricevuti',               unit: 'int',    better: 'up',   source: 'manual', fallbackId: 'leads_meta' },
    appointments:    { id: 'appointments',    label: 'Appuntamenti',                unit: 'int',    better: 'up',   source: 'manual' },
    test_drives:     { id: 'test_drives',     label: 'Test drive',                  unit: 'int',    better: 'up',   source: 'manual' },
    sales:           { id: 'sales',           label: 'Vendite',                     unit: 'int',    better: 'up',   source: 'manual' },
    // Pubblicità
    leads_meta:      { id: 'leads_meta',      label: 'Lead Meta',                   unit: 'int',    better: 'up',   source: 'meta' },
    cost_per_lead:   { id: 'cost_per_lead',   label: 'Costo per lead',              unit: 'eur',    better: 'down', source: 'meta' },
    ads_spend:       { id: 'ads_spend',       label: 'Spesa pubblicitaria',         unit: 'eur',    better: 'down', source: 'meta' },
    roas:            { id: 'roas',            label: 'ROAS',                        unit: 'ratio',  better: 'up',   source: 'google_ads' },
    cpa:             { id: 'cpa',             label: 'Costo per acquisto',          unit: 'eur',    better: 'down', source: 'google_ads' },
    // Sito
    sessions:        { id: 'sessions',        label: 'Sessioni sito',               unit: 'int',    better: 'up',   source: 'ga4' },
    revenue:         { id: 'revenue',         label: 'Fatturato del sito',          unit: 'eur',    better: 'up',   source: 'ga4' },
    orders:          { id: 'orders',          label: 'Ordini',                      unit: 'int',    better: 'up',   source: 'ga4' },
    conversion_rate: { id: 'conversion_rate', label: 'Tasso di conversione',        unit: 'pct',    better: 'up',   source: 'ga4' },
    email_revenue:   { id: 'email_revenue',   label: 'Fatturato da email',          unit: 'eur',    better: 'up',   source: 'klaviyo' },
    search_clicks:   { id: 'search_clicks',   label: 'Click da ricerca Google',     unit: 'int',    better: 'up',   source: 'searchconsole' },
    // Presenza locale
    gbp_calls:       { id: 'gbp_calls',       label: 'Chiamate da Google Maps',     unit: 'int',    better: 'up',   source: 'gbp' },
    gbp_directions:  { id: 'gbp_directions',  label: 'Indicazioni stradali',        unit: 'int',    better: 'up',   source: 'gbp' },
    review_rating:   { id: 'review_rating',   label: 'Valutazione media recensioni', unit: 'rating', better: 'up',  source: 'gbp' },
    review_count:    { id: 'review_count',    label: 'Nuove recensioni',            unit: 'int',    better: 'up',   source: 'gbp' },
    // Social
    social_reach:    { id: 'social_reach',    label: 'Copertura social',            unit: 'int',    better: 'up',   source: 'instagram' },
    followers:       { id: 'followers',       label: 'Follower',                    unit: 'int',    better: 'up',   source: 'instagram' },
    profile_views:   { id: 'profile_views',   label: 'Visite al profilo',           unit: 'int',    better: 'up',   source: 'instagram' },
    linkedin_impr:   { id: 'linkedin_impr',   label: 'Impression LinkedIn',         unit: 'int',    better: 'up',   source: 'linkedin' },
    linkedin_follow: { id: 'linkedin_follow', label: 'Follower LinkedIn',           unit: 'int',    better: 'up',   source: 'linkedin' },
};

export interface ManualField { id: string; label: string }

export interface ProfileDef {
    id: KpiProfile;
    label: string;
    description: string;
    /** In ordine di importanza: sono i KPI della mail se il cliente non ne sceglie altri. Mai più di MAX_KPIS. */
    defaultKpis: string[];
    /** Cosa si può caricare a mano ogni mese (Fase 2). */
    manualFields: ManualField[];
}

export const PROFILE_DEFS: Record<KpiProfile, ProfileDef> = {
    auto: {
        id: 'auto', label: 'Auto e moto', description: 'Concessionarie e officine: contano lead, costo per lead e contatti da Google Maps.',
        defaultKpis: ['leads_real', 'cost_per_lead', 'gbp_calls', 'sessions', 'ads_spend'],
        manualFields: [
            { id: 'leads_real', label: 'Lead ricevuti' }, { id: 'appointments', label: 'Appuntamenti' },
            { id: 'test_drives', label: 'Test drive' }, { id: 'sales', label: 'Vendite' },
        ],
    },
    ecommerce: {
        id: 'ecommerce', label: 'E-commerce', description: 'Vendita online: contano fatturato, ordini, ritorno sulla spesa e conversione.',
        defaultKpis: ['revenue', 'orders', 'roas', 'conversion_rate', 'email_revenue'],
        manualFields: [{ id: 'orders', label: 'Ordini (se diversi da quelli del sito)' }],
    },
    locale: {
        id: 'locale', label: 'Locale e servizi', description: 'Negozi, ristoranti, showroom, studi: contano chiamate, indicazioni e recensioni.',
        defaultKpis: ['gbp_calls', 'gbp_directions', 'review_rating', 'review_count', 'social_reach'],
        manualFields: [{ id: 'leads_real', label: 'Contatti / prenotazioni ricevuti' }],
    },
    b2b: {
        id: 'b2b', label: 'B2B e lead generation', description: 'Aziende che cercano contatti commerciali: contano lead, costo per lead e presenza su LinkedIn.',
        defaultKpis: ['leads_real', 'cost_per_lead', 'sessions', 'search_clicks', 'linkedin_impr'],
        manualFields: [{ id: 'leads_real', label: 'Lead ricevuti' }, { id: 'appointments', label: 'Appuntamenti' }],
    },
    social: {
        id: 'social', label: 'Solo social e brand', description: 'Presenza e visibilità: contano follower, copertura e visite al profilo.',
        defaultKpis: ['followers', 'social_reach', 'profile_views', 'linkedin_follow'],
        manualFields: [],
    },
};

export const isKpiProfile = (v: unknown): v is KpiProfile => typeof v === 'string' && (KPI_PROFILES as readonly string[]).includes(v);

export function defaultKpiIds(profile: KpiProfile): string[] {
    return PROFILE_DEFS[profile].defaultKpis.slice(0, MAX_KPIS);
}

/** Le scelte dell'agenzia: per un profilo, l'elenco di KPI al posto di quello predefinito. Un profilo assente usa il predefinito. */
export type KpiOverrides = Partial<Record<KpiProfile, string[]>>;

/**
 * Controlla un elenco di KPI scelto a mano: da 1 a MAX_KPIS voci, tutte nel catalogo, senza ripetizioni. L'ordine è
 * quello scelto (è anche l'ordine nella mail: il primo è il KPI principale).
 */
export function validateKpiSelection(ids: unknown): { ok: true; ids: string[] } | { ok: false; error: string } {
    if (!Array.isArray(ids) || ids.some((x) => typeof x !== 'string')) return { ok: false, error: 'L\'elenco dei KPI non è valido.' };
    if (ids.length === 0) return { ok: false, error: 'Serve almeno un KPI.' };
    if (ids.length > MAX_KPIS) return { ok: false, error: `Al massimo ${MAX_KPIS} KPI per profilo.` };
    if (new Set(ids).size !== ids.length) return { ok: false, error: 'Un KPI è ripetuto.' };
    const unknown = ids.find((id) => !KPI_CATALOG[id]);
    if (unknown) return { ok: false, error: `KPI sconosciuto: ${unknown}.` };
    return { ok: true, ids: ids as string[] };
}

/** Rilegge le scelte salvate scartando ciò che non è valido (un KPI tolto dal catalogo non deve rompere la mail). */
export function sanitizeOverrides(raw: unknown): KpiOverrides {
    const out: KpiOverrides = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const p of KPI_PROFILES) {
        const v = (raw as Record<string, unknown>)[p];
        const valid = v === undefined ? null : validateKpiSelection(v);
        if (valid && valid.ok) out[p] = valid.ids;
    }
    return out;
}

/** I KPI di un profilo: la scelta dell'agenzia se c'è, altrimenti i predefiniti. */
export function kpiIdsFor(profile: KpiProfile, overrides?: KpiOverrides): string[] {
    return overrides?.[profile] ?? defaultKpiIds(profile);
}

/**
 * I KPI di un cliente: il suo elenco personale se ne ha uno valido, altrimenti quelli del suo profilo (con le scelte
 * dell'agenzia). Senza elenco personale e senza profilo non c'è nulla da mostrare: restituisce null.
 */
export function kpiIdsForClient(
    client: { kpiProfile?: unknown; kpiSelection?: unknown },
    overrides?: KpiOverrides,
): string[] | null {
    const own = client.kpiSelection == null ? null : validateKpiSelection(client.kpiSelection);
    if (own && own.ok) return own.ids;
    return isKpiProfile(client.kpiProfile) ? kpiIdsFor(client.kpiProfile, overrides) : null;
}

/** I KPI (definizioni complete) di un profilo, nell'ordine di importanza. */
export function kpisForProfile(profile: KpiProfile, overrides?: KpiOverrides): KpiDef[] {
    return kpiIdsFor(profile, overrides).map((id) => KPI_CATALOG[id]).filter(Boolean);
}

/**
 * Validazione dei campi della mail mensile nel PATCH del cliente. Restituisce il messaggio d'errore, o null se va bene.
 * `kpiProfile` può essere null (toglie il profilo); `monthlyKpiMail` deve essere un vero booleano: un "false" stringa
 * da un form sarebbe truthy e metterebbe il cliente nella mail.
 */
export function validateKpiFields(body: Record<string, unknown>): string | null {
    if ('kpiProfile' in body && body.kpiProfile !== null && !isKpiProfile(body.kpiProfile)) {
        return `Profilo KPI non valido: usa ${KPI_PROFILES.join(', ')} oppure null.`;
    }
    if ('monthlyKpiMail' in body && typeof body.monthlyKpiMail !== 'boolean') {
        return 'monthlyKpiMail deve essere true o false.';
    }
    // Elenco KPI personale del cliente: null = usa quello del profilo
    if ('kpiSelection' in body && body.kpiSelection !== null) {
        const v = validateKpiSelection(body.kpiSelection);
        if (!v.ok) return v.error;
    }
    return null;
}

export type MonthlyMailState = 'included' | 'excluded' | 'no_profile';

/** Entra nella mail solo con il flag acceso E un profilo: senza profilo non si sa quali KPI mostrare. */
export function monthlyMailState(client: { kpiProfile?: unknown; monthlyKpiMail?: unknown }): MonthlyMailState {
    if (client.monthlyKpiMail !== true) return 'excluded';
    return isKpiProfile(client.kpiProfile) ? 'included' : 'no_profile';
}

/** «Bettin - BGF SRL» e «BETTIN - BGF SRL » devono essere lo stesso cliente: minuscolo, senza accenti né segni. */
export function normalizeName(name: string): string {
    return String(name ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export interface Suggestion { profile: KpiProfile | null; include: boolean }

const group = (profile: KpiProfile | null, include: boolean, names: string[]) => names.map((n) => [normalizeName(n), { profile, include }] as const);

/**
 * L'assegnazione concordata con Roberto il 10/11/2026 sui nomi esatti del Hub. Serve al pulsante «Applica proposta
 * iniziale» della pagina: riempie SOLO i clienti che non hanno ancora né profilo né flag, mai sovrascrive una scelta.
 */
export const SUGGESTED = new Map<string, Suggestion>([
    ...group('auto', true, [
        'CENTRO CARCAZZARO', "GRUPPO L'AUTO", 'EUROPEA AUTO SUZUKI', 'AUTOSTRIATTO SRL', 'QUACQUARELLI', 'BETTIN - BGF SRL', 'CITY MOTORS',
        'HYBRID VILLAGE', 'DALMA FOR YOU', 'AUTOFORMULA', 'SANGALLI', 'MARTIGNONI', 'YAMAHA MOTORTIMES',
    ]),
    ...group('ecommerce', true, [
        'YEPPON', 'MIMMO DORMIO S.R.L. - HELP COMPUTER', 'BRIXIA COMPUTER STORE', 'NEXT HARDWARE & SOFTWARE', 'EURO PC', 'COSMETIK', 'MECHREVO',
    ]),
    ...group('locale', true, [
        'MANGIAFUOCO RISTORANTE', 'OSTARIA ALLA TORRE', 'BOTTEGA MASSIMO', 'OTTICA DEL CENTRO', 'MEDICAL - PARAFARMACIA', 'MEDICAL SPA - AMBULATORIO',
        'ROVI', 'DALLA LONGA', 'BRIANZA SERRAMENTI', 'MOOD ARREDAMENTI', 'GAVAZZI', 'ATEL MILANO', 'CA BELA', 'Edilproposte CESATE - CERCO VENDO AFFITTO CASA',
    ]),
    ...group('b2b', true, [
        'BAOLI EMEA S.P.A.', 'BREVI', 'WRDIGITAL', 'ARZUFFI PVD S.R.L.', 'OVERING', 'B2VIBE', 'DIGITALITIS', 'ELETTROMECCANICA FBS',
        'ESSEDI UTENSILI', 'SAOMEC', 'FURECO', 'PLATO HOLDING', 'WINBLU',
    ]),
    // Esclusi dalla mail su indicazione di Roberto: il flag resta spento, il profilo non è assegnato
    ...group(null, false, [
        'TITANIUM COMPONENTS', 'PROTESI TITANIUM', 'IMPRESA EDILE SPARTAK', 'LA BUSSOLA ON THE ROAD', 'SIDE STUDIO SRL', 'STUDIO AKANTUS',
        'CRISMATICA NETWORK', 'LUCA E ANDREA BAR', "L'ALTRO LUCA E ANDREA", 'BIKE HOUSE', 'CYBERWISE', 'MEDIAWARE', 'YASHI ITALIA',
    ]),
]);

export function suggestionFor(name: string): Suggestion | undefined {
    return SUGGESTED.get(normalizeName(name));
}
