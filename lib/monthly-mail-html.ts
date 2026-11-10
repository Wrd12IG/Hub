/**
 * lib/monthly-mail-html.ts
 *
 * La mail mensile dei KPI: UNA sola, con tutti i clienti. Funzione pura (dati in, HTML e testo fuori): si prova con dati
 * finti e si usa uguale per l'anteprima nel Hub, l'invio di prova e l'invio vero.
 *
 * Schematica e leggibile da telefono: in alto il riepilogo, poi chi va guardato per primo (in calo o con segnali) con la
 * tabella dei KPI, poi gli altri in una riga ciascuno, in fondo chi non ha dati sufficienti. Layout a tabelle con stili in
 * linea (i client di posta ignorano i fogli di stile), larghezza massima 640 px.
 *
 * ⚠️ Gmail taglia i messaggi oltre ~102 KB e nasconde il resto dietro «Mostra tutto»: con 47 clienti il dettaglio completo
 * di tutti non ci starebbe. Per questo solo i clienti da guardare hanno la tabella; gli altri una riga. Un test tiene la
 * dimensione sotto soglia con 47 clienti in calo (il caso peggiore).
 */

import { PROFILE_DEFS, KPI_PROFILES } from './kpi-profiles';
import { formatDelta, formatValue, monthLabel, shiftMonth, type ClientMonthly, type Delta, type KpiResult, type VerdictState } from './kpi-compute';

export const GMAIL_CLIP_BYTES = 100 * 1024;

const esc = (s: unknown): string =>
    String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const TONE: Record<Delta['tone'], string> = { good: '#15803d', bad: '#b91c1c', neutral: '#6b7280' };
const STATE: Record<VerdictState, { color: string; label: string }> = {
    down: { color: '#b91c1c', label: 'In calo' },
    flat: { color: '#b45309', label: 'Stabile' },
    up: { color: '#15803d', label: 'In crescita' },
    unknown: { color: '#6b7280', label: 'Dati insufficienti' },
};
const FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;";

export interface MonthlyMailInput {
    month: string;
    clients: ClientMonthly[];
    /** Indirizzo del Hub, per i link ai report dei singoli clienti. */
    baseUrl: string;
}

export interface MonthlyMail { subject: string; html: string; text: string; bytes: number; counts: Record<VerdictState, number> }

const dot = (state: VerdictState) => `<span style="color:${STATE[state].color};">&#9679;</span>`;

const deltaCell = (d: Delta | null, unit: KpiResult['unit']) =>
    d ? `<span style="color:${TONE[d.tone]};">${esc(formatDelta(d, unit))}</span>` : '<span style="color:#9ca3af;">—</span>';

function kpiRow(k: KpiResult): string {
    const value = k.value === null
        ? `<span style="color:#9ca3af;">${esc(k.missing ?? '—')}</span>`
        : `${esc(formatValue(k.value, k.unit))}${k.kind === 'proxy' ? '<sup style="color:#b45309;">*</sup>' : ''}`;
    return `<tr>`
        + `<td style="padding:4px 8px 4px 0;color:#374151;">${esc(k.label)}</td>`
        + `<td style="padding:4px 8px;text-align:right;font-weight:600;color:#111827;white-space:nowrap;">${value}</td>`
        + `<td style="padding:4px 8px;text-align:right;white-space:nowrap;">${deltaCell(k.vsPrev, k.unit)}</td>`
        + `<td style="padding:4px 0 4px 8px;text-align:right;white-space:nowrap;">${deltaCell(k.vsYoy, k.unit)}</td>`
        + `</tr>`;
}

const clientLink = (baseUrl: string, id: string) => `${baseUrl.replace(/\/$/, '')}/clients/${encodeURIComponent(id)}`;

/** Cliente da guardare: nome, verdetto, tabella dei KPI e segnali. */
function expandedBlock(c: ClientMonthly, baseUrl: string): string {
    const v = STATE[c.verdict.state];
    return `<tr><td style="padding:12px 0;border-top:1px solid #e5e7eb;">`
        + `<div style="font-size:15px;font-weight:700;color:#111827;">${dot(c.verdict.state)} <a href="${esc(clientLink(baseUrl, c.clientId))}" style="color:#111827;text-decoration:none;">${esc(c.name)}</a> `
        + `<span style="font-size:12px;font-weight:600;color:${v.color};">${esc(v.label)}</span></div>`
        + `<div style="margin:2px 0 8px;font-size:13px;color:#4b5563;">${esc(c.verdict.headline)}</div>`
        + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;border-collapse:collapse;">`
        + `<tr style="color:#9ca3af;font-size:11px;"><td></td><td style="text-align:right;padding:0 8px;">Mese</td><td style="text-align:right;padding:0 8px;">vs mese scorso</td><td style="text-align:right;padding:0 0 0 8px;">vs anno scorso</td></tr>`
        + c.kpis.map(kpiRow).join('')
        + `</table>`
        + (c.alerts.length ? `<ul style="margin:8px 0 0;padding-left:18px;font-size:12px;color:#92400e;">${c.alerts.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : '')
        + `</td></tr>`;
}

/** Cliente in ordine: una riga con il verdetto e i primi tre KPI. */
function compactBlock(c: ClientMonthly, baseUrl: string, withAlerts = false): string {
    const top = c.kpis.filter((k) => k.value !== null).slice(0, 3)
        .map((k) => `${esc(k.label)} <b style="color:#111827;">${esc(formatValue(k.value, k.unit))}</b>${k.kind === 'proxy' ? '<sup style="color:#b45309;">*</sup>' : ''}${k.vsPrev ? ` <span style="color:${TONE[k.vsPrev.tone]};">${esc(formatDelta(k.vsPrev, k.unit))}</span>` : ''}`)
        .join(' &nbsp;·&nbsp; ');
    return `<tr><td style="padding:7px 0;border-top:1px solid #f3f4f6;font-size:13px;color:#4b5563;">`
        + `${dot(c.verdict.state)} <a href="${esc(clientLink(baseUrl, c.clientId))}" style="color:#111827;font-weight:600;text-decoration:none;">${esc(c.name)}</a>`
        + `<div style="margin-top:2px;font-size:12px;">${top || esc(c.verdict.headline)}</div>`
        + (withAlerts && c.alerts.length ? `<div style="margin-top:2px;font-size:11px;color:#92400e;">${esc(c.alerts.join(' · '))}</div>` : '')
        + `</td></tr>`;
}

const needsAttention = (c: ClientMonthly) => c.verdict.state === 'down' || c.alerts.length > 0;

export function buildMonthlyMail(input: MonthlyMailInput): MonthlyMail {
    const { month, clients, baseUrl } = input;
    const label = monthLabel(month);
    const counts: Record<VerdictState, number> = { down: 0, flat: 0, up: 0, unknown: 0 };
    for (const c of clients) counts[c.verdict.state]++;

    const byName = (a: ClientMonthly, b: ClientMonthly) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' });
    const attention = clients.filter((c) => c.verdict.state !== 'unknown' && needsAttention(c))
        .sort((a, b) => (a.verdict.state === 'down' ? 0 : 1) - (b.verdict.state === 'down' ? 0 : 1) || byName(a, b));
    const insufficient = clients.filter((c) => c.verdict.state === 'unknown').sort(byName);
    const ok = clients.filter((c) => c.verdict.state !== 'unknown' && !needsAttention(c));

    const chip = (n: number, state: VerdictState) =>
        `<td style="padding:0 6px 0 0;"><div style="border:1px solid #e5e7eb;border-radius:8px;padding:8px 12px;text-align:center;">`
        + `<div style="font-size:20px;font-weight:700;color:${STATE[state].color};">${n}</div><div style="font-size:11px;color:#6b7280;">${esc(STATE[state].label)}</div></div></td>`;

    const sectionTitle = (t: string, sub = '') =>
        `<tr><td style="padding:18px 0 4px;"><div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;">${esc(t)}</div>${sub ? `<div style="font-size:12px;color:#9ca3af;">${esc(sub)}</div>` : ''}</td></tr>`;

    // Gli altri, divisi per profilo (stesso ordine del Hub)
    const okSections = KPI_PROFILES.map((p) => {
        const list = ok.filter((c) => c.profile === p).sort(byName);
        return list.length ? sectionTitle(PROFILE_DEFS[p].label) + list.map((c) => compactBlock(c, baseUrl)).join('') : '';
    }).join('');

    const hasProxy = clients.some((c) => c.kpis.some((k) => k.kind === 'proxy'));
    const render = (expanded: Set<string>): string => `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Report KPI clienti — ${esc(label)}</title></head>`
        + `<body style="margin:0;padding:0;background:#f9fafb;${FONT}">`
        + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;"><tr><td align="center" style="padding:16px;">`
        + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:12px;padding:20px;${FONT}">`
        + `<tr><td><div style="font-size:12px;color:#6b7280;">WRDigital · report mensile</div>`
        + `<div style="font-size:22px;font-weight:700;color:#111827;margin-top:2px;">Come stanno andando i clienti</div>`
        + `<div style="font-size:14px;color:#4b5563;margin-top:2px;">${esc(label)} · confronto con ${esc(monthLabel(shiftMonth(month, -1)))} e ${esc(monthLabel(shiftMonth(month, -12)))}</div></td></tr>`
        + `<tr><td style="padding-top:14px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${chip(counts.down, 'down')}${chip(counts.flat, 'flat')}${chip(counts.up, 'up')}${chip(counts.unknown, 'unknown')}</tr></table></td></tr>`
        + (attention.length ? sectionTitle('Da guardare per primi', 'In calo o con un segnale da controllare') + attention.map((c) => (expanded.has(c.clientId) ? expandedBlock(c, baseUrl) : compactBlock(c, baseUrl, true))).join('') : '')
        + okSections
        + (insufficient.length
            ? sectionTitle('Dati insufficienti', 'Nessun giudizio: mancano dati o i numeri sono troppo bassi')
                + insufficient.map((c) => `<tr><td style="padding:5px 0;border-top:1px solid #f3f4f6;font-size:12px;color:#6b7280;">${dot('unknown')} <b style="color:#374151;">${esc(c.name)}</b> — ${esc(c.verdict.headline.replace(/^Dati insufficienti:\s*/, ''))}</td></tr>`).join('')
            : '')
        + `<tr><td style="padding-top:18px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">`
        + `Il giudizio parte dal primo KPI di ogni cliente. Sotto 10 eventi non si calcola la percentuale. `
        + (hasProxy ? `<span style="color:#b45309;">*</span> stima da Meta: il dato reale non è stato inserito. ` : '')
        + `Apri il nome del cliente per il report completo nel Hub.`
        + (expanded.size < attention.length ? ` ${attention.length - expanded.size} clienti da guardare sono in forma ridotta per la dimensione del messaggio.` : '')
        + `</td></tr>`
        + `</table></td></tr></table></body></html>`;

    // Tetto alla dimensione: si parte dal dettaglio per tutti i clienti da guardare e si riduce dal fondo (i meno urgenti) finché
    // il messaggio sta sotto il limite di Gmail, con un margine per il testo e le intestazioni
    const BUDGET = GMAIL_CLIP_BYTES - 8 * 1024;
    const expanded = new Set(attention.map((c) => c.clientId));
    const order = attention.map((c) => c.clientId);
    let html = render(expanded);
    while (Buffer.byteLength(html, 'utf8') > BUDGET && expanded.size > 0) {
        expanded.delete(order[expanded.size - 1]);
        html = render(expanded);
    }

    const text = [
        `Report KPI clienti — ${label}`,
        `In calo ${counts.down} · Stabili ${counts.flat} · In crescita ${counts.up} · Dati insufficienti ${counts.unknown}`,
        '',
        ...(attention.length ? ['DA GUARDARE PER PRIMI', ...attention.flatMap((c) => [`- ${c.name}: ${c.verdict.headline}`, ...c.alerts.map((a) => `    ! ${a}`)]), ''] : []),
        ...(ok.length ? ['ALTRI CLIENTI', ...ok.sort(byName).map((c) => `- ${c.name}: ${c.verdict.headline}`), ''] : []),
        ...(insufficient.length ? ['DATI INSUFFICIENTI', ...insufficient.map((c) => `- ${c.name}`), ''] : []),
        baseUrl,
    ].join('\n');

    return { subject: `Report KPI clienti — ${label}${counts.down ? ` (${counts.down} in calo)` : ''}`, html, text, bytes: Buffer.byteLength(html, 'utf8'), counts };
}
