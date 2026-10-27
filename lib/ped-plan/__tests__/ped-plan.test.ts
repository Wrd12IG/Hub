import { describe, it, expect } from 'vitest';
import { HOOK_FORMULAS, hookById, hooksForPrompt } from '../hooks';
import { auditCarousel, auditPlan, auditPost, auditReel, auditStory, hookScore, spokenSeconds, words } from '../checks';
import { normalizeDetail, normalizeSkeleton, parsePlanRequest, type PlanPost, type SkeletonPost } from '../spec';

describe('formule di aggancio', () => {
    it('sono 26, numerate da 1, con modello e trappola', () => {
        expect(HOOK_FORMULAS).toHaveLength(26);
        expect(HOOK_FORMULAS.map((h) => h.id)).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
        for (const h of HOOK_FORMULAS) { expect(h.template.length).toBeGreaterThan(10); expect(h.trap.length).toBeGreaterThan(10); }
        expect(hookById(5)?.name).toBe('Il tempo che crolla');
        expect(hooksForPrompt().split('\n')).toHaveLength(26);
    });
});

describe('hookScore', () => {
    it('un buon aggancio (cifra, posta in gioco, si dice in 2 secondi) va forte', () => {
        const r = hookScore('18.000 euro è quanto mi è costato un contratto senza clausola.');
        expect(r.score).toBeGreaterThanOrEqual(80);
    });
    it('un saluto con premessa va male e lo dice', () => {
        const r = hookScore('Ciao ragazzi oggi vi mostro come migliorare i vostri social');
        expect(r.score).toBeLessThan(50);
        expect(r.notes.join(' ')).toMatch(/Saluto|Premessa|Apre con/);
    });
    it('senza numeri né nomi segnala la mancanza di concretezza', () => {
        expect(hookScore('Devi sempre migliorare il tuo modo di comunicare').notes.join(' ')).toContain('Nessun numero né nome');
    });
    it('hashtag o emoji nell\'aggancio limitano il punteggio', () => {
        expect(hookScore('5 ore sono diventate 20 minuti #social').score).toBeLessThanOrEqual(40);
        expect(hookScore('5 ore sono diventate 20 minuti 🔥').score).toBeLessThanOrEqual(40);
    });
    it('un aggancio troppo lungo viene segnalato', () => {
        const r = hookScore('Quando abbiamo iniziato a lavorare con questo cliente nessuno poteva immaginare quanto tempo avremmo perso ogni mattina per colpa di un modulo');
        expect(r.notes.join(' ')).toContain('Aggancio lungo');
    });
    it('un nome proprio a metà frase conta come concretezza, uno a inizio frase no', () => {
        expect(hookScore('Il preventivo perso per colpa di Toyota').notes.join(' ')).not.toContain('Nessun numero né nome');
        expect(hookScore('Preventivo sbagliato. Cosa fare adesso senza panico').notes.join(' ')).toContain('Nessun numero né nome');
    });
    it('vuoto = 0; parole e secondi parlati sono coerenti', () => {
        expect(hookScore('').score).toBe(0);
        expect(words('18.000 euro, subito').length).toBe(3);
        expect(spokenSeconds('uno due tre quattro cinque')).toBeCloseTo(5 / (155 / 60), 5);
    });
});

describe('auditReel', () => {
    const ok = { durationSec: 13, script: ['5 ore diventano 20 minuti.', 'Il modulo è uno solo, con tre campi.', 'Lo compili al banco con il cliente.', 'Il resto lo fa il gestionale da solo.', 'Così 5 ore diventano 20 minuti.'], cards: [{ text: '5 ORE → 20 MIN', from: 0, to: 3 }, { text: 'UN SOLO MODULO', from: 3, to: 8 }], shots: ['banco'] };
    it('un Reel in regola non ha avvisi', () => expect(auditReel(ok, ok.script[0])).toEqual([]));
    it('prima battuta oltre i 3 secondi, battuta oltre i 4 secondi', () => {
        const long = 'Quando siamo arrivati in concessionaria quella mattina nessuno aveva ancora capito come funzionasse davvero il nuovo gestionale';
        const w = auditReel({ ...ok, script: [long, ...ok.script.slice(1)] }, long);
        expect(w.some((x) => x.includes('La prima battuta dura'))).toBe(true);
        const w2 = auditReel({ ...ok, script: [ok.script[0], long, ...ok.script.slice(2)] }, ok.script[0]);
        expect(w2.some((x) => x.includes('La battuta 2'))).toBe(true);
    });
    it('schede con più di 6 parole, prima scheda in ritardo, nessuna scheda', () => {
        const w = auditReel({ ...ok, cards: [{ text: 'una due tre quattro cinque sei sette', from: 1, to: 3 }] }, ok.script[0]);
        expect(w.some((x) => x.includes('più di 6 parole'))).toBe(true);
        expect(w.some((x) => x.includes('prima scheda'))).toBe(true);
        expect(auditReel({ ...ok, cards: [] }, ok.script[0]).some((x) => x.includes('Mancano i testi'))).toBe(true);
    });
    it('ultima battuta che non richiama l\'aggancio: il replay non si chiude', () => {
        const w = auditReel({ ...ok, script: [...ok.script.slice(0, 4), 'Scrivici su WhatsApp per prenotare.'] }, ok.script[0]);
        expect(w.some((x) => x.includes('replay'))).toBe(true);
    });
    it('durata troppo corta o diversa da quella dichiarata', () => {
        expect(auditReel({ ...ok, script: ['5 ore. 20 minuti.'], durationSec: 30 }, '5 ore').some((x) => x.includes('sotto i 7 s'))).toBe(true);
        expect(auditReel({ ...ok, durationSec: 40 }, ok.script[0]).some((x) => x.includes('durata dichiarata'))).toBe(true);
    });
});

describe('auditCarousel', () => {
    const slide = (role: any, headline: string, body = 'Testo breve.') => ({ role, headline, body });
    const ok = { slides: [slide('copertina', 'Il contratto da 18.000 euro'), slide('posta', 'Perché conta'), slide('idea', 'Paga alla consegna'), slide('idea', 'Mai sull\'approvazione del lavoro'), slide('idea', 'Scrivilo nel contratto'), slide('riassunto', 'Tutto in quattro righe'), slide('invito', 'Salvalo per dopo')] };
    it('un carosello in regola non ha avvisi', () => expect(auditCarousel(ok)).toEqual([]));
    it('numero di slide, copertina lunga, riassunto e invito mancanti', () => {
        const w = auditCarousel({ slides: [slide('copertina', 'Una copertina davvero troppo lunga per la griglia del profilo'), slide('idea', 'Paga alla consegna'), slide('idea', 'Mai sull\'approvazione')] });
        expect(w.some((x) => x.includes('da 6 a 10'))).toBe(true);
        expect(w.some((x) => x.includes('massimo 6'))).toBe(true);
        expect(w.some((x) => x.includes('riassunto'))).toBe(true);
        expect(w.some((x) => x.includes('invito'))).toBe(true);
    });
    it('testo di una slide oltre 25 parole e titolo fuori misura', () => {
        const body = Array.from({ length: 30 }, () => 'parola').join(' ');
        const w = auditCarousel({ slides: [...ok.slides.slice(0, 2), slide('idea', 'Ok', body), ...ok.slides.slice(3)] });
        expect(w.some((x) => x.includes('massimo 25'))).toBe(true);
        expect(w.some((x) => x.includes('da 3 a 7 parole'))).toBe(true);
    });
});

describe('auditStory', () => {
    const f = (text: string, sticker: any = '', options: string[] = []) => ({ text, sticker, stickerText: '', options });
    it('in regola: 5 fotogrammi, sondaggio al quarto', () => {
        expect(auditStory({ frames: [f('Apertura'), f('Contenuto'), f('Altro contenuto'), f('Quale preferisci?', 'sondaggio', ['Rosso', 'Blu']), f('Chiusura')] })).toEqual([]);
    });
    it('troppo corta, senza sticker, sticker tardi, sondaggio senza opzioni', () => {
        expect(auditStory({ frames: [f('a'), f('b')] }).some((x) => x.includes('da 3 a 7'))).toBe(true);
        expect(auditStory({ frames: [f('a'), f('b'), f('c')] }).some((x) => x.includes('Nessuno sticker'))).toBe(true);
        expect(auditStory({ frames: [f('a'), f('b'), f('c'), f('d'), f('e'), f('f', 'sondaggio', ['Sì', 'No'])] }).some((x) => x.includes('al fotogramma 6'))).toBe(true);
        expect(auditStory({ frames: [f('a'), f('b'), f('c'), f('d', 'sondaggio', ['Sì'])] }).some((x) => x.includes('almeno due opzioni'))).toBe(true);
    });
});

describe('auditPlan', () => {
    const p = (date: string, format: any, postType: any) => ({ date, format, postType });
    it('un buon mix non ha avvisi', () => {
        expect(auditPlan([p('2026-11-02', 'Reel', 'prova'), p('2026-11-03', 'Carosello', 'insegna'), p('2026-11-04', 'Reel', 'opinione'), p('2026-11-05', 'Reel', 'storia'), p('2026-11-06', 'Post Singolo', 'offerta')])).toEqual([]);
    });
    it('pochi Reel, due tipi uguali di fila, due contenuti nello stesso giorno, piano vuoto', () => {
        const w = auditPlan([p('2026-11-02', 'Carosello', 'insegna'), p('2026-11-02', 'Post Singolo', 'insegna'), p('2026-11-04', 'Reel', 'prova')]);
        expect(w.some((x) => x.includes('Reel su 3'))).toBe(true);
        expect(w.some((x) => x.includes('di fila'))).toBe(true);
        expect(w.some((x) => x.includes('stesso giorno'))).toBe(true);
        expect(auditPlan([])).toEqual(['Il piano è vuoto.']);
    });
    it('le storie nello stesso giorno di un post non contano come doppione', () => {
        expect(auditPlan([p('2026-11-02', 'Reel', 'prova'), p('2026-11-02', 'Storia', 'storia')]).some((x) => x.includes('stesso giorno'))).toBe(false);
    });
});

describe('spec: richiesta, scheletro, dettaglio', () => {
    it('parsePlanRequest: valida periodo, data e lunghezze', () => {
        expect(parsePlanRequest({ period: 'week', startDate: '2026-11-02', goal: 'leads' }).ok).toBe(true);
        expect(parsePlanRequest({ period: 'anno', startDate: '2026-11-02' }).ok).toBe(false);
        expect(parsePlanRequest({ period: 'week', startDate: '02/11/2026' }).ok).toBe(false);
        expect(parsePlanRequest({ period: 'week', startDate: '2026-11-02', facts: 'x'.repeat(1600) }).ok).toBe(false);
        expect((parsePlanRequest({ period: 'month', startDate: '2026-11-01', goal: 'boh' }) as any).value.goal).toBe('awareness');
    });
    const req = { period: 'week' as const, startDate: '2026-11-02', goal: 'leads' as const, events: '', facts: '' };
    it('normalizeSkeleton: scarta formato sconosciuto, date non valide o fuori periodo; ordina e rinumera', () => {
        const out = normalizeSkeleton([
            { date: '2026-11-04', time: '19:00', format: 'Reel', postType: 'prova', theme: 'a', angle: 'b', hookFormula: 5, photoBrief: 'x' },
            { date: '2026-11-03', format: 'Carosello', postType: 'boh', theme: 'c', angle: 'd' },
            { date: '2026-12-25', format: 'Reel' },
            { date: 'domani', format: 'Reel' },
            { date: '2026-11-05', format: 'Podcast' },
            null,
        ], req);
        expect(out.map((x) => x.date)).toEqual(['2026-11-03', '2026-11-04']);
        expect(out.map((x) => x.id)).toEqual(['p1', 'p2']);
        expect(out[0].postType).toBe('insegna'); // tipo sconosciuto → predefinito
        expect(out[0].time).toBe('19:00');
        expect(out[1].hookFormula).toBe(5);
        expect(out[0].hookFormula).toBeNull(); // la formula è solo dei Reel
    });
    const base = (format: any): SkeletonPost => ({ id: 'p1', date: '2026-11-03', time: '19:00', format, postType: 'prova', theme: 't', angle: 'a', hookFormula: format === 'Reel' ? 5 : null, photoBrief: '' });
    it('normalizeDetail Reel: richiede il copione; porta carte e riprese', () => {
        expect(normalizeDetail({ caption: 'x', reel: { script: [] } }, base('Reel'))).toBeNull();
        const d = normalizeDetail({ caption: 'Didascalia', hashtags: ['#auto', 'Toyota!', 'auto'], hook: { formulaId: 5, spoken: '5 ore, 20 minuti', onScreen: '5 ORE → 20 MIN' }, reel: { durationSec: 25, script: ['5 ore, 20 minuti.', 'Come?'], cards: [{ text: 'UN MODULO', from: 0, to: 3 }, { text: 'senza durata', from: 3, to: 3 }], shots: ['banco'] } }, base('Reel'))!;
        expect(d.reel!.script).toHaveLength(2);
        expect(d.reel!.cards).toHaveLength(1); // la scheda senza durata è scartata
        expect(d.hashtags).toEqual(['#auto', '#Toyota']);
        expect(d.hook.formulaId).toBe(5);
    });
    it('normalizeDetail Carosello e Storia: richiedono slide o fotogrammi; ruoli e sticker sconosciuti si correggono', () => {
        expect(normalizeDetail({ carousel: { slides: [] } }, base('Carosello'))).toBeNull();
        const c = normalizeDetail({ caption: 'c', carousel: { slides: [{ role: 'boh', headline: 'Titolo', body: 'b' }, { headline: '' }] } }, base('Carosello'))!;
        expect(c.carousel!.slides).toEqual([{ role: 'idea', headline: 'Titolo', body: 'b' }]);
        expect(normalizeDetail({ story: { frames: [] } }, base('Storia'))).toBeNull();
        const s = normalizeDetail({ story: { frames: [{ text: 'Quale?', sticker: 'sondaggio', options: ['Rosso', 'Blu'] }, { text: 'x', sticker: 'magia' }] } }, base('Storia'))!;
        expect(s.story!.frames[1].sticker).toBe('');
        expect(s.story!.frames[0].options).toEqual(['Rosso', 'Blu']);
    });
    it('normalizeDetail: risposta non valida = null', () => {
        expect(normalizeDetail(null, base('Reel'))).toBeNull();
        expect(normalizeDetail('x', base('Reel'))).toBeNull();
    });
});

describe('auditPost', () => {
    const post = (over: Partial<PlanPost>): PlanPost => ({
        id: 'p1', date: '2026-11-03', time: '19:00', format: 'Carosello', postType: 'insegna', theme: 't', angle: 'a', hookFormula: null, photoBrief: '',
        hook: { formulaId: null, spoken: '', onScreen: '', alternatives: [] }, caption: 'Prima di firmare, leggi queste regole.\n\nSalvalo.', hashtags: [], cta: 'Salvalo', altText: '', missingData: [], warnings: [], ...over,
    });
    it('segnala numeri non presenti nei dati forniti (anche dentro slide e copione)', () => {
        const p = post({ carousel: { slides: [{ role: 'copertina', headline: 'Rata 199 euro', body: '' }] } });
        expect(auditPost(p, 'rata 199 euro').some((x) => x.includes('Numeri non presenti'))).toBe(false);
        const q = post({ carousel: { slides: [{ role: 'copertina', headline: 'Ne abbiamo consegnate 4.200', body: '' }] } });
        expect(auditPost(q, '').some((x) => x.includes('4.200'))).toBe(true);
    });
    it('segnala frasi da AI nella didascalia e la didascalia mancante', () => {
        expect(auditPost(post({ caption: 'Nel mondo di oggi serve un game changer.' }), '').some((x) => x.startsWith('Suona da AI'))).toBe(true);
        expect(auditPost(post({ caption: '' }), '').some((x) => x.includes('Manca la didascalia'))).toBe(true);
    });
    it('la storia non richiede didascalia', () => {
        expect(auditPost(post({ format: 'Storia', caption: '', story: { frames: [{ text: 'a', sticker: '', stickerText: '', options: [] }, { text: 'b', sticker: '', stickerText: '', options: [] }, { text: 'c', sticker: '', stickerText: '', options: [] }, { text: 'd', sticker: 'domanda', stickerText: 'Cosa vuoi sapere?', options: [] }] } }), '').some((x) => x.includes('Manca la didascalia'))).toBe(false);
    });
});

import { buildPedDraft, parseProposal, pedTitle, proposalJson } from '../to-ped';

describe('to-ped', () => {
    const base = (over: Partial<PlanPost>): PlanPost => ({
        id: 'p1', date: '2026-11-03', time: '19:00', format: 'Reel', postType: 'prova', theme: 'Preventivi', angle: 'Il preventivo rifatto per una virgola', hookFormula: 5, photoBrief: 'banco',
        hook: { formulaId: 5, spoken: '5 ore diventano 20 minuti', onScreen: '5 ORE → 20 MIN', alternatives: [] }, caption: 'Ecco come.\n\nScrivi PREVENTIVO.', hashtags: ['#toyota', '#brianza'], cta: 'Scrivi PREVENTIVO',
        altText: '', reel: { durationSec: 20, script: ['5 ore diventano 20 minuti'], cards: [], shots: [] }, missingData: [], warnings: ['avviso'], ...over,
    });
    it('un Reel diventa una bozza Instagram con la sola didascalia come testo', () => {
        const d = buildPedDraft('c1', base({}));
        expect(d.status).toBe('Bozza');
        expect(d.format).toBe('Reel');
        expect(d.instagram).toBe(true);
        expect(d.igStories).toBe(false);
        expect(d.copy).toBe('Ecco come.\n\nScrivi PREVENTIVO.');
        expect(d.copy).not.toContain('battuta');
        expect(d.tags).toBe('#toyota #brianza');
        expect(d.focus).toBe('Il preventivo rifatto per una virgola');
        expect(d.publicationDate).toMatch(/^2026-11-0[23]/);
        expect(d.topic).toBe('5 ORE → 20 MIN');
    });
    it('una Storia va sul canale storie, senza didascalia né hashtag', () => {
        const d = buildPedDraft('c1', base({ format: 'Storia', caption: 'non deve uscire', hashtags: ['#x'], reel: undefined, story: { frames: [{ text: 'a', sticker: '', stickerText: '', options: [] }] } }));
        expect(d.instagram).toBe(false);
        expect(d.igStories).toBe(true);
        expect(d.copy).toBe('');
        expect(d.tags).toBeUndefined();
    });
    it('la proposta si salva senza avvisi e si rilegge identica; testi non validi = null', () => {
        const p = base({});
        const raw = proposalJson(p);
        expect(raw).not.toContain('avviso');
        const back = parseProposal(raw)!;
        expect(back.reel!.script).toEqual(p.reel!.script);
        expect(back.warnings).toEqual([]);
        expect(parseProposal('non json')).toBeNull();
        expect(parseProposal(undefined)).toBeNull();
        expect(parseProposal('{"a":1}')).toBeNull();
    });
    it('il titolo di un carosello è la sua copertina; uno lungo si accorcia a 80 caratteri', () => {
        expect(pedTitle(base({ format: 'Carosello', carousel: { slides: [{ role: 'copertina', headline: 'Il contratto da 18.000 euro', body: '' }] } }))).toBe('Il contratto da 18.000 euro');
        expect(pedTitle(base({ hook: { formulaId: null, spoken: '', onScreen: 'a'.repeat(120), alternatives: [] } })).length).toBeLessThanOrEqual(80);
    });
});
