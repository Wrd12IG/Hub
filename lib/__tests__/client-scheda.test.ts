// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { canAccessScheda, validateBackupManager } from '@/lib/client-scheda/access';
import { buildSchedaClient } from '@/lib/client-scheda/whitelist';
import { buildLogEntry, decideApproval, validateNewLog } from '@/lib/client-scheda/log';
import { decisionRecipient, isAbsentOn, requestRecipients } from '@/lib/client-scheda/recipients';
import { buildDecisionEmail, buildRequestEmail } from '@/lib/client-scheda/emails';
import type { StaffUser } from '@/lib/client-scheda/types';

const NOW = new Date('2026-11-20T10:00:00Z');
const client = { managedBy: ['pm1'], socialManagerId: 'sm1', backupManagerId: 'bk1' };
const users: StaffUser[] = [
    { id: 'ad1', name: 'Admin Uno', email: 'a1@x.it', role: 'Amministratore', status: 'Attivo' },
    { id: 'ad2', name: 'Admin Due', email: 'a2@x.it', role: 'Amministratore', status: 'Inattivo' },
    { id: 'pm1', name: 'Pia', email: 'pm1@x.it', role: 'Project Manager' },
    { id: 'sm1', name: 'Sara', email: 'sm1@x.it', role: 'Collaboratore' },
    { id: 'bk1', name: 'Bruno', email: 'bk1@x.it', role: 'Project Manager' },
    { id: 'cl1', name: 'Cliente', email: 'c@x.it', role: 'Cliente' },
    { id: 'zz', name: 'Estraneo', role: 'Collaboratore' },
];

describe('accesso', () => {
    it('admin su tutto; responsabili e backup sul proprio cliente; estranei e Cliente mai', () => {
        expect(canAccessScheda({ id: 'ad1', role: 'Amministratore' }, client)).toBe(true);
        expect(canAccessScheda({ id: 'pm1', role: 'Project Manager' }, client)).toBe(true);
        expect(canAccessScheda({ id: 'sm1', role: 'Collaboratore' }, client)).toBe(true);
        expect(canAccessScheda({ id: 'bk1', role: 'Project Manager' }, client)).toBe(true);
        expect(canAccessScheda({ id: 'zz', role: 'Collaboratore' }, client)).toBe(false);
        expect(canAccessScheda({ id: 'cl1', role: 'Cliente' }, client)).toBe(false);
        expect(canAccessScheda({ id: 'pm1', role: 'Project Manager', status: 'Inattivo' }, client)).toBe(false);
        expect(canAccessScheda(null, client)).toBe(false);
    });
    it('il backup deve essere staff attivo e diverso dal responsabile', () => {
        expect(validateBackupManager('bk1', client, users)).toBeNull();
        expect(validateBackupManager(undefined, client, users)).toBeNull();
        expect(validateBackupManager('pm1', client, users)).toMatch(/diverso/);
        expect(validateBackupManager('cl1', client, users)).toMatch(/staff/);
        expect(validateBackupManager('nessuno', client, users)).toMatch(/staff/);
    });
});

describe('lista bianca', () => {
    const raw = {
        name: 'MANGIAFUOCO', email: 'info@m.it', phone: '123', address: 'Via 1', websiteUrl: 'https://m.it',
        socialLinks: { instagram: 'https://instagram.com/m', fb: 'javascript:alert(1)' },
        managedBy: ['pm1'], socialManagerId: 'sm1', backupManagerId: 'bk1',
        budget: 9999, googleAdAccountId: '494', metaAdAccountId: 'act_1', ga4PropertyId: '5', publicToken: 'tok', windsorAccounts: { x: 1 }, kpiProfile: 'b2b', campoNuovo: 'segreto',
    };
    const names = { pm1: 'Pia', sm1: 'Sara', bk1: 'Bruno' };
    it('espone solo i campi previsti', () => {
        const s = buildSchedaClient('c1', raw, { userNames: names, notes: 'nota', canSeeNotes: false });
        const json = JSON.stringify(s);
        for (const leak of ['9999', '494', 'act_1', 'tok', 'windsor', 'b2b', 'segreto', 'budget', 'javascript']) expect(json).not.toContain(leak);
        expect(s.social).toEqual([{ platform: 'instagram', url: 'https://instagram.com/m' }]);
        expect(s.managers.sort()).toEqual(['Pia', 'Sara']);
        expect(s.backupManager).toBe('Bruno');
        expect(Object.keys(s).sort()).toEqual(['address', 'backupManager', 'email', 'id', 'managers', 'name', 'notes', 'phone', 'social', 'websiteUrl']);
    });
    it('le note solo con il permesso', () => {
        expect(buildSchedaClient('c1', raw, { userNames: names, notes: 'nota', canSeeNotes: false }).notes).toBeNull();
        expect(buildSchedaClient('c1', raw, { userNames: names, notes: 'nota', canSeeNotes: true }).notes).toBe('nota');
    });
});

describe('registro', () => {
    it('valida tipo e testo', () => {
        expect(validateNewLog({ type: 'telefonata', text: '  Chiamato  ' })).toEqual({ ok: true, value: { type: 'telefonata', typeLabel: null, text: 'Chiamato', requestApproval: false } });
        expect(validateNewLog({ type: 'boh', text: 'x' }).ok).toBe(false);
        expect(validateNewLog({ type: 'email', text: '   ' }).ok).toBe(false);
        expect(validateNewLog({ type: 'email', text: 'x'.repeat(2001) }).ok).toBe(false);
        expect(validateNewLog(null).ok).toBe(false);
    });
    it('«altro» vuole un nome per il tipo; per gli altri tipi l\'etichetta è ignorata', () => {
        expect(validateNewLog({ type: 'altro', text: 'x' }).ok).toBe(false);
        expect(validateNewLog({ type: 'altro', typeLabel: '   ', text: 'x' }).ok).toBe(false);
        expect(validateNewLog({ type: 'altro', typeLabel: 'x'.repeat(61), text: 'x' }).ok).toBe(false);
        const ok = validateNewLog({ type: 'altro', typeLabel: '  Sopralluogo   in   sede ', text: 'x' });
        expect(ok.ok && ok.value.typeLabel).toBe('Sopralluogo in sede');
        const other = validateNewLog({ type: 'email', typeLabel: 'Boh', text: 'x' });
        expect(other.ok && other.value.typeLabel).toBeNull();
    });
    it('la data la mette il server: quella del form è ignorata', () => {
        const v = validateNewLog({ type: 'email', text: 'ok', requestApproval: true, createdAt: '1999-01-01', authorId: 'hacker', approval: { status: 'approvata' } });
        if (!v.ok) throw new Error('atteso ok');
        const e = buildLogEntry(v.value, { id: 'pm1', name: 'Pia' }, NOW);
        expect(e.createdAt).toBe(NOW.toISOString());
        expect(e.authorId).toBe('pm1');
        expect(e.approval?.status).toBe('in_attesa');
    });
    it('senza richiesta non c\'è approvazione', () => {
        expect(buildLogEntry({ type: 'altro', text: 'x', requestApproval: false }, { id: 'a', name: 'A' }, NOW).approval).toBeNull();
    });
});

describe('approvazione', () => {
    const pending = { approval: { status: 'in_attesa' as const, requestedAt: '', decidedBy: null, decidedByName: null, decidedAt: null, comment: null } };
    const admin = { id: 'ad1', name: 'Admin Uno', role: 'Amministratore' as const };
    it('solo un amministratore decide', () => {
        expect(decideApproval(pending, 'approvata', '', { id: 'pm1', name: 'Pia', role: 'Project Manager' }, NOW).ok).toBe(false);
        const r = decideApproval(pending, 'rifiutata', ' no grazie ', admin, NOW);
        expect(r.ok && r.value).toMatchObject({ status: 'rifiutata', decidedBy: 'ad1', comment: 'no grazie' });
    });
    it('non si decide due volte, né su righe senza richiesta, né con valori strani', () => {
        const done = { approval: { ...pending.approval, status: 'approvata' as const } };
        expect(decideApproval(done, 'rifiutata', '', admin, NOW).ok).toBe(false);
        expect(decideApproval({ approval: null }, 'approvata', '', admin, NOW).ok).toBe(false);
        expect(decideApproval(pending, 'forse', '', admin, NOW).ok).toBe(false);
        expect(decideApproval(pending, 'approvata', 'x'.repeat(501), admin, NOW).ok).toBe(false);
    });
});

describe('destinatari', () => {
    const away = [{ userId: 'pm1', status: 'Approvato', startDate: '2026-11-18', endDate: '2026-11-25' }];
    it('assenza solo se approvata e che copre oggi', () => {
        expect(isAbsentOn(away, 'pm1', NOW)).toBe(true);
        expect(isAbsentOn([{ ...away[0], status: 'In Attesa' }], 'pm1', NOW)).toBe(false);
        expect(isAbsentOn([{ ...away[0], endDate: '2026-11-19' }], 'pm1', NOW)).toBe(false);
    });
    const ids = (l: StaffUser[]) => l.map((u) => u.id).sort();
    it('richiesta: admin attivi + responsabili; mai autore, inattivi, senza email, clienti', () => {
        expect(ids(requestRecipients(users, client, [], 'zz', NOW))).toEqual(['ad1', 'pm1', 'sm1']);
        expect(ids(requestRecipients(users, client, [], 'ad1', NOW))).toEqual(['pm1', 'sm1']);
    });
    it('il backup entra solo se tutti i responsabili sono assenti (o non ce ne sono)', () => {
        const smAway = [...away, { userId: 'sm1', status: 'Approvato', startDate: '2026-11-20', endDate: '2026-11-20' }];
        expect(ids(requestRecipients(users, client, away, 'zz', NOW))).toEqual(['ad1', 'sm1']);
        expect(ids(requestRecipients(users, client, smAway, 'zz', NOW))).toEqual(['ad1', 'bk1']);
        expect(ids(requestRecipients(users, { backupManagerId: 'bk1' }, [], 'zz', NOW))).toEqual(['ad1', 'bk1']);
        expect(ids(requestRecipients(users, { managedBy: ['pm1'] }, away, 'zz', NOW))).toEqual(['ad1']);
    });
    it('esito: solo all\'autore, se è un altro', () => {
        expect(decisionRecipient(users, 'pm1', 'ad1')?.id).toBe('pm1');
        expect(decisionRecipient(users, 'ad1', 'ad1')).toBeNull();
        expect(decisionRecipient(users, 'zz', 'ad1')).toBeNull();
    });
});

describe('email', () => {
    const entry = { createdAt: NOW.toISOString(), authorName: 'Pia <b>', type: 'richiesta' as const, text: '<script>alert(1)</script>\nsecondo rigo' };
    it('richiesta: oggetto evidenziato, testo escaped, link', () => {
        const m = buildRequestEmail({ clientName: 'Mangia\nfuoco', entry, link: 'https://hub.wrdigital.it/clients/c1/scheda' });
        expect(m.subject).toBe('[DA APPROVARE] Mangia fuoco — Richiesta');
        expect(m.html).toContain('Serve la tua approvazione');
        expect(m.html).not.toContain('<script>');
        expect(m.html).toContain('&lt;script&gt;');
        expect(m.html).toContain('Pia &lt;b&gt;');
        expect(m.html).toContain('href="https://hub.wrdigital.it/clients/c1/scheda"');
    });
    it('«Altro» mostra il tipo scritto a mano, anche nell\'oggetto e senza HTML', () => {
        const m = buildRequestEmail({ clientName: 'M', entry: { ...entry, type: 'altro', typeLabel: 'Sopralluogo <b>' }, link: 'https://x.it' });
        expect(m.subject).toBe('[DA APPROVARE] M — Altro: Sopralluogo <b>');
        expect(m.html).toContain('Altro: Sopralluogo &lt;b&gt;');
    });
    it('esito: rifiuto evidenziato con commento', () => {
        const m = buildDecisionEmail({ clientName: 'M', entry, decision: 'rifiutata', deciderName: 'Admin', comment: 'No, <ora>', link: 'https://x.it' });
        expect(m.subject).toBe('[RIFIUTATA] M — Richiesta');
        expect(m.html).toContain('rifiutata');
        expect(m.html).toContain('No, &lt;ora&gt;');
    });
});
