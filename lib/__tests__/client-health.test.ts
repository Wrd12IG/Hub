import { describe, expect, it } from 'vitest'
import { computeClientHealth, MIN_BASE_CONVERSIONS } from '@/lib/client-health'
import type { PlatformReport } from '@/lib/reporting'

function p(
    platform: PlatformReport['platform'],
    rows: Record<string, number>,
    previousRows: Record<string, number> | null
): PlatformReport {
    return {
        platform,
        connected: true,
        rows: [rows],
        previousRows: previousRows ? [previousRows] : [],
    }
}

describe('computeClientHealth', () => {
    it('giudica sul fatturato quando c\'è, e dichiara la fonte', () => {
        const h = computeClientHealth({
            platforms: [p('ga4', { purchase_revenue: 6200, transactions: 80 }, { purchase_revenue: 10000, transactions: 130 })],
            days: 30,
        })
        expect(h.state).toBe('down')
        expect(h.metric).toBe('revenue')
        expect(h.deltaPct).toBe(-38)
        expect(h.source).toContain('GA4')
    })

    /**
     * La regola che impedisce al badge di mentire verso l'alto: Klaviyo e Awin
     * misurano fette dello stesso fatturato che GA4 misura tutto. Se si
     * sommassero, questo cliente passerebbe da −38% a un delta inventato.
     */
    it('non somma i ricavi di GA4, Klaviyo e Awin', () => {
        const h = computeClientHealth({
            platforms: [
                p('ga4', { purchase_revenue: 6200, transactions: 80 }, { purchase_revenue: 10000, transactions: 130 }),
                p('klaviyo', { conversion_value: 3000, conversions: 40 }, { conversion_value: 1000, conversions: 12 }),
                p('awin', { sale_amount: 2000, transactions: 20 }, { sale_amount: 500, transactions: 6 }),
            ],
            days: 30,
        })
        expect(h.current).toBe(6200)
        expect(h.previous).toBe(10000)
        expect(h.deltaPct).toBe(-38)
    })

    it('ripiega sulle conversioni quando nessuna fonte ha ricavi', () => {
        const h = computeClientHealth({
            platforms: [p('google_ads', { conversions: 140, cost: 3000 }, { conversions: 100, cost: 2800 })],
            days: 30,
        })
        expect(h.metric).toBe('conversions')
        expect(h.state).toBe('up')
        expect(h.deltaPct).toBe(40)
    })

    it('resta neutro dentro la banda del 10%', () => {
        const h = computeClientHealth({
            platforms: [p('ga4', { purchase_revenue: 10400, transactions: 100 }, { purchase_revenue: 10000, transactions: 98 })],
            days: 30,
        })
        expect(h.state).toBe('flat')
        expect(h.deltaPct).toBe(4)
    })

    /** Il caso che rende inutile qualunque badge: 3 → 2 conversioni, −33%. */
    it('non dà un voto quando entrambi i periodi sono sotto la base minima', () => {
        const h = computeClientHealth({
            platforms: [p('ga4', { conversions: 2, transactions: 2 }, { conversions: 3, transactions: 3 })],
            days: 30,
        })
        expect(h.state).toBe('unknown')
        expect(h.deltaPct).toBeNull()
        expect(h.blocked).toContain(String(MIN_BASE_CONVERSIONS))
    })

    /**
     * Cliente reale (CarCazzaro): 3 → 184 conversioni. La percentuale sarebbe
     * +6.033%, vera e inutile; "dati insufficienti" sarebbe l'errore opposto,
     * perché il cliente è chiaramente migliorato.
     */
    it('giudica sulla differenza assoluta quando la base era minuscola ma ora c\'è volume', () => {
        const h = computeClientHealth({
            platforms: [p('ga4', { conversions: 184, transactions: 184 }, { conversions: 3, transactions: 3 })],
            days: 30,
        })
        expect(h.state).toBe('up')
        expect(h.deltaKind).toBe('abs')
        expect(h.deltaAbs).toBe(181)
        expect(h.deltaPct).toBeNull()
    })

    it('applica la base minima anche quando il voto è sul fatturato', () => {
        const h = computeClientHealth({
            platforms: [p('ga4', { purchase_revenue: 800, transactions: 4 }, { purchase_revenue: 4000, transactions: 5 })],
            days: 30,
        })
        expect(h.state).toBe('unknown')
    })

    /**
     * Due account reali (ATEL, CyberWise) hanno Google Ads collegato e zero
     * conversioni in entrambi i periodi: dire "nessuna metrica collegata"
     * mandava a cercare un problema di configurazione che non esiste.
     */
    it('distingue "niente collegato" da "collegato ma a zero"', () => {
        const zero = computeClientHealth({
            platforms: [p('google_ads', { conversions: 0, cost: 0 }, { conversions: 0, cost: 0 })],
            days: 30,
        })
        expect(zero.state).toBe('unknown')
        expect(zero.blocked).toContain('Google Ads')
        expect(zero.blocked).toContain('collegato')

        const nulla = computeClientHealth({ platforms: [], days: 30 })
        expect(nulla.blocked).toContain('Nessuna metrica di esito collegata')
    })

    it('tace sulla pressione competitiva quando non ci sono impression', () => {
        const h = computeClientHealth({
            platforms: [p('google_ads', { conversions: 120 }, { conversions: 100 })],
            days: 30,
            pressure: { impressionShare: null, rankLost: 0, budgetLost: 0, diagnosi: 'nessuna' },
        })
        expect(h.reasons.some((r) => r.id === 'impression_share')).toBe(false)
    })

    it('non blocca quando le conversioni non sono tracciate affatto', () => {
        const h = computeClientHealth({
            platforms: [p('awin', { sale_amount: 9000 }, { sale_amount: 6000 })],
            days: 30,
        })
        expect(h.state).toBe('up')
        expect(h.source).toContain('Awin')
    })

    it('dice che manca il confronto invece di inventare un delta', () => {
        const h = computeClientHealth({
            platforms: [p('ga4', { purchase_revenue: 5000, transactions: 60 }, null)],
            days: 30,
        })
        expect(h.state).toBe('unknown')
        expect(h.blocked).toContain('periodo di confronto')
    })

    it('non divide per un periodo precedente a zero', () => {
        // Da zero a 60 transazioni: verdetto sulla differenza, mai una divisione per 0.
        const h = computeClientHealth({
            platforms: [p('ga4', { purchase_revenue: 5000, transactions: 60 }, { purchase_revenue: 0, transactions: 0 })],
            days: 30,
        })
        expect(h.state).toBe('up')
        expect(h.deltaPct).toBeNull()
        expect(h.deltaKind).toBe('abs')
        expect(Number.isFinite(h.deltaAbs as number)).toBe(true)
    })

    it('non dà un voto quando da zero si resta a zero', () => {
        const h = computeClientHealth({
            platforms: [p('ga4', { purchase_revenue: 0, transactions: 0 }, { purchase_revenue: 0, transactions: 0 })],
            days: 30,
        })
        expect(h.state).toBe('unknown')
    })

    it('ignora una piattaforma in errore invece di leggerla come zero', () => {
        const h = computeClientHealth({
            platforms: [
                { platform: 'ga4', connected: false, error: 'token scaduto', rows: [], previousRows: [] },
                p('google_ads', { conversions: 120 }, { conversions: 100 }),
            ],
            days: 30,
        })
        expect(h.metric).toBe('conversions')
        expect(h.source).toContain('Google Ads')
    })

    it('mostra le cause anche quando il voto non si può dare', () => {
        const h = computeClientHealth({
            platforms: [],
            days: 30,
            seoScore: 42,
            pressure: { impressionShare: 0.143, rankLost: 0.505, budgetLost: 0.352, diagnosi: 'competitor' },
        })
        expect(h.state).toBe('unknown')
        expect(h.reasons.map((r) => r.id)).toEqual(['seo', 'impression_share'])
        expect(h.reasons.find((r) => r.id === 'seo')?.tone).toBe('bad')
        expect(h.reasons.find((r) => r.id === 'impression_share')?.detail).toContain('14,3%')
    })

    it('spiega la quota non calcolabile invece di stampare un numero finto', () => {
        const h = computeClientHealth({
            platforms: [p('ga4', { purchase_revenue: 9000, transactions: 90 }, { purchase_revenue: 9500, transactions: 95 })],
            days: 30,
            pressure: { impressionShare: null, rankLost: 0.225, budgetLost: 0.722, diagnosi: 'budget' },
        })
        const ip = h.reasons.find((r) => r.id === 'impression_share')
        expect(ip?.detail).toContain('non calcolabile')
        expect(ip?.detail).toContain('budget esaurito')
    })

    it('somma le righe multiple di una stessa piattaforma', () => {
        const h = computeClientHealth({
            platforms: [
                {
                    platform: 'ga4',
                    connected: true,
                    rows: [{ purchase_revenue: 100, transactions: 30 }, { purchase_revenue: 400, transactions: 40 }],
                    previousRows: [{ purchase_revenue: 250, transactions: 35 }, { purchase_revenue: 250, transactions: 35 }],
                },
            ],
            days: 30,
        })
        expect(h.current).toBe(500)
        expect(h.previous).toBe(500)
        expect(h.state).toBe('flat')
    })
})
