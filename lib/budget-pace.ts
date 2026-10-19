// Budget e obiettivo mensili messi a confronto con il ritmo del periodo selezionato, più le proposte che ne
// discendono. Funzione pura: la spesa e il risultato arrivano dal riepilogo già calcolato (lib/report-metrics.ts).
// Il budget è MENSILE e il periodo è libero, quindi si ragiona a ritmo: quanto si spende (e si ottiene) al giorno nel
// periodo, proiettato su 30 giorni. Un periodo troppo corto dà proiezioni instabili e viene segnalato.

export const MONTH_DAYS = 30;
/** Sotto questi giorni la proiezione mensile è troppo ballerina per dare consigli. */
export const MIN_DAYS_FOR_PACE = 7;

export interface PaceInput {
    /** Budget pubblicitario mensile (€), se impostato. */
    budget?: number | null;
    /** Obiettivo mensile di risultati (lead, contatti…), se impostato. */
    target?: number | null;
    /** Spesa a pagamento nel periodo (€). */
    spend: number | null;
    /** Risultato nel periodo e come si chiama. */
    result: number | null;
    resultLabel?: string;
    /** Costo per risultato dei soli canali a pagamento. */
    costPerResult: number | null;
    periodDays: number;
}

export type PaceTone = 'good' | 'warn' | 'bad' | 'neutral';

export interface Proposal { tone: PaceTone; text: string }

export interface BudgetPace {
    shortPeriod: boolean;
    budget: { monthly: number; planned: number; spent: number; projected: number; usedPct: number; status: 'sotto' | 'in-linea' | 'sopra'; tone: PaceTone } | null;
    goal: { monthly: number; achieved: number; projected: number; reachedPct: number; tone: PaceTone; label: string } | null;
    proposals: Proposal[];
}

const r0 = (v: number) => Math.round(v);
const euro = (v: number) => '€' + new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' }).format(Math.round(v));
const num = (v: number) => new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' }).format(Math.round(v));

export function computeBudgetPace(i: PaceInput): BudgetPace {
    const days = Math.max(1, i.periodDays);
    const factor = MONTH_DAYS / days;
    const shortPeriod = days < MIN_DAYS_FOR_PACE;
    const label = i.resultLabel || 'risultati';
    const proposals: Proposal[] = [];

    let budget: BudgetPace['budget'] = null;
    if (i.budget && i.budget > 0 && i.spend !== null) {
        const projected = i.spend * factor;
        const usedPct = Math.round((projected / i.budget) * 100);
        const status = usedPct < 85 ? 'sotto' : usedPct > 110 ? 'sopra' : 'in-linea';
        budget = {
            monthly: i.budget, planned: (i.budget * days) / MONTH_DAYS, spent: i.spend, projected, usedPct, status,
            tone: status === 'in-linea' ? 'good' : status === 'sotto' ? 'warn' : 'bad',
        };
    }

    let goal: BudgetPace['goal'] = null;
    if (i.target && i.target > 0 && i.result !== null) {
        const projected = i.result * factor;
        const reachedPct = Math.round((projected / i.target) * 100);
        goal = { monthly: i.target, achieved: i.result, projected, reachedPct, label, tone: reachedPct >= 95 ? 'good' : reachedPct >= 70 ? 'warn' : 'bad' };
    }

    if (shortPeriod && (budget || goal)) {
        proposals.push({ tone: 'neutral', text: `Il periodo è di ${days} giorni: per proiezioni e proposte affidabili scegli almeno ${MIN_DAYS_FOR_PACE} giorni.` });
        return { shortPeriod, budget, goal, proposals };
    }

    if (budget) {
        const gap = budget.projected - budget.monthly;
        if (budget.status === 'sopra') {
            proposals.push({ tone: 'bad', text: `Al ritmo attuale spendi circa ${euro(budget.projected)} al mese, ${euro(gap)} oltre il budget di ${euro(budget.monthly)}: riduci i budget giornalieri delle campagne con il costo per ${label} più alto oppure alza il budget concordato.` });
        } else if (budget.status === 'sotto') {
            proposals.push({ tone: 'warn', text: `Al ritmo attuale spendi circa ${euro(budget.projected)} al mese, ${euro(-gap)} meno del budget di ${euro(budget.monthly)}: controlla campagne ferme, pubblicità non approvate o budget giornalieri troppo bassi.` });
        } else {
            proposals.push({ tone: 'good', text: `La spesa è in linea: circa ${euro(budget.projected)} al mese su ${euro(budget.monthly)} di budget.` });
        }
    }

    if (goal) {
        const missing = goal.monthly - goal.projected;
        if (missing <= 0) {
            proposals.push({ tone: 'good', text: `L'obiettivo di ${num(goal.monthly)} ${label} al mese è raggiunto al ritmo attuale (circa ${num(goal.projected)}).` });
        } else {
            const cpr = i.costPerResult;
            if (cpr && cpr > 0) {
                const extra = missing * cpr;
                const room = budget ? budget.monthly - budget.projected : null;
                const base = `Al ritmo attuale arrivano circa ${num(goal.projected)} ${label} al mese: ne mancano ${num(missing)} per l'obiettivo di ${num(goal.monthly)}. Con un costo di ${euro(cpr)} ciascuno servirebbero circa ${euro(extra)} in più al mese.`;
                if (room === null) proposals.push({ tone: 'warn', text: base });
                else if (extra <= room) proposals.push({ tone: 'warn', text: `${base} Il budget lo consente: restano ${euro(room)} non spesi, quindi basta aumentare la spesa giornaliera sulle campagne che rendono meglio.` });
                else proposals.push({ tone: 'bad', text: `${base} Il budget non basta (restano ${euro(Math.max(0, room))}): per arrivarci o alzi il budget a circa ${euro(budget!.projected + extra)} oppure abbassi il costo per ${label} migliorando creatività e pagine di destinazione.` });
            } else {
                proposals.push({ tone: 'warn', text: `Al ritmo attuale arrivano circa ${num(goal.projected)} ${label} al mese su un obiettivo di ${num(goal.monthly)}. Il costo per ${label} non è calcolabile dai canali a pagamento, quindi non stimo la spesa necessaria.` });
            }
        }
    }

    return { shortPeriod, budget, goal, proposals };
}
