// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { addEntry, decideEntry, getScheda, type SchedaDeps } from '@/lib/client-scheda/service';
import type { Approval, LogEntry, StaffUser } from '@/lib/client-scheda/types';

const NOW = new Date('2026-11-20T10:00:00Z');
const users: StaffUser[] = [
    { id: 'ad1', name: 'Admin', email: 'ad@x.it', role: 'Amministratore', status: 'Attivo' },
    { id: 'pm1', name: 'Pia', email: 'pm@x.it', role: 'Project Manager' },
    { id: 'bk1', name: 'Bruno', email: 'bk@x.it', role: 'Project Manager' },
    { id: 'zz', name: 'Estraneo', email: 'zz@x.it', role: 'Collaboratore' },
    { id: 'cl1', name: 'Cliente', email: 'c@x.it', role: 'Cliente' },
];
const rawClient = {
    name: 'MANGIAFUOCO', email: 'info@m.it', managedBy: ['pm1'], backupManagerId: 'bk1',
    budget: 9999, googleAdAccountId: '494', publicToken: 'tok',
};

function setup(over: Partial<SchedaDeps> = {}, financial = false) {
    const store = new Map<string, LogEntry>();
    const notify = vi.fn(async () => undefined);
    const sendEmail = vi.fn(async () => ({ success: true }));
    let n = 0;
    const deps: SchedaDeps = {
        loadClient: async (id) => (id === 'c1' ? { ...rawClient } : null),
        loadUsers: async () => users,
        loadNotes: async () => 'nota riservata',
        canSeeNotes: async () => financial,
        loadAbsences: async () => [],
        listLogs: async (_c, o) => Array.from(store.values()).filter((e) => !o.pendingOnly || e.approval?.status === 'in_attesa').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, o.limit),
        addLog: async (_c, e) => { const id = `l${++n}`; store.set(id, { id, ...e }); return id; },
        decideLog: async (_c, id, compute) => {
            const e = store.get(id);
            if (!e) return { kind: 'not_found' };
            const r = compute(e);
            if (!r.ok) return { kind: 'rejected', error: r.error };
            store.set(id, { ...e, approval: r.value });
            return { kind: 'done', entry: e, approval: r.value as Approval };
        },
        notify, sendEmail, now: () => NOW, baseUrl: 'https://hub.test',
        ...over,
    };
    return { deps, store, notify, sendEmail };
}

describe('accesso alla scheda', () => {
    it('estraneo e Cliente: 404 come se non esistesse; cliente inesistente: 404', async () => {
        const { deps } = setup();
        expect((await getScheda(deps, 'zz', 'c1')).status).toBe(404);
        expect((await getScheda(deps, 'cl1', 'c1')).status).toBe(404);
        expect((await getScheda(deps, 'ad1', 'nope')).status).toBe(404);
        expect((await addEntry(deps, 'zz', 'c1', { type: 'email', text: 'x' })).status).toBe(404);
        expect((await decideEntry(deps, 'zz', 'c1', 'l1', { decision: 'approvata' })).status).toBe(404);
    });
    it('responsabile, backup e admin entrano; nessun dato sensibile nella risposta', async () => {
        const { deps } = setup();
        for (const uid of ['pm1', 'bk1', 'ad1']) expect((await getScheda(deps, uid, 'c1')).status).toBe(200);
        const json = JSON.stringify((await getScheda(deps, 'pm1', 'c1')).body);
        for (const leak of ['9999', '494', 'tok', 'nota riservata']) expect(json).not.toContain(leak);
    });
    it('le note solo con il permesso finanziario', async () => {
        const { deps } = setup({}, true);
        const r = await getScheda(deps, 'pm1', 'c1');
        expect(JSON.stringify(r.body)).toContain('nota riservata');
    });
    it('«in attesa» è un filtro solo admin', async () => {
        const { deps } = setup();
        await addEntry(deps, 'pm1', 'c1', { type: 'richiesta', text: 'con approvazione', requestApproval: true });
        await addEntry(deps, 'pm1', 'c1', { type: 'email', text: 'senza' });
        const asPm = await getScheda(deps, 'pm1', 'c1', { pendingOnly: true });
        const asAdmin = await getScheda(deps, 'ad1', 'c1', { pendingOnly: true });
        expect((asPm.body as { entries: unknown[] }).entries).toHaveLength(2);
        expect((asAdmin.body as { entries: unknown[] }).entries).toHaveLength(1);
    });
});

describe('nuova riga', () => {
    it('data del server, autore dalla sessione; niente email senza richiesta', async () => {
        const { deps, notify, sendEmail } = setup();
        const r = await addEntry(deps, 'pm1', 'c1', { type: 'telefonata', text: 'Chiamato', createdAt: '1999-01-01', authorId: 'zz' });
        expect(r.status).toBe(201);
        const e = (r.body as { entry: LogEntry }).entry;
        expect(e).toMatchObject({ createdAt: NOW.toISOString(), authorId: 'pm1', authorName: 'Pia', approval: null });
        expect(notify).not.toHaveBeenCalled();
        expect(sendEmail).not.toHaveBeenCalled();
    });
    it('testo non valido: 400 e niente salvato', async () => {
        const { deps, store } = setup();
        expect((await addEntry(deps, 'pm1', 'c1', { type: 'email', text: '' })).status).toBe(400);
        expect(store.size).toBe(0);
    });
    it('con richiesta: notifica e UNA email per persona (admin, non l\'autore), mai più destinatari in una mail', async () => {
        const { deps, notify, sendEmail } = setup();
        const r = await addEntry(deps, 'pm1', 'c1', { type: 'richiesta', text: 'Serve ok', requestApproval: true });
        expect(notify).toHaveBeenCalledWith(['ad1'], expect.objectContaining({ type: 'client_log_approval_requested', link: 'https://hub.test/clients/c1/scheda' }));
        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(sendEmail.mock.calls[0][0]).toEqual({ email: 'ad@x.it', name: 'Admin' });
        expect(sendEmail.mock.calls[0][1].subject).toMatch(/^\[DA APPROVARE\]/);
        expect((r.body as { emails: unknown }).emails).toEqual({ sent: 1, failed: 0 });
    });
    it('un invio email fallito non blocca il salvataggio e viene segnalato', async () => {
        const { deps, store } = setup({ sendEmail: async () => { throw new Error('smtp giù'); } });
        const r = await addEntry(deps, 'pm1', 'c1', { type: 'richiesta', text: 'x', requestApproval: true });
        expect(r.status).toBe(201);
        expect(store.size).toBe(1);
        expect((r.body as { emails: unknown }).emails).toEqual({ sent: 0, failed: 1 });
    });
    it('anche una notifica che fallisce non blocca il salvataggio', async () => {
        const { deps, store } = setup({ notify: async () => { throw new Error('db'); } });
        const r = await addEntry(deps, 'pm1', 'c1', { type: 'richiesta', text: 'x', requestApproval: true });
        expect(r.status).toBe(201);
        expect(store.size).toBe(1);
    });
});

describe('decisione', () => {
    async function withPending() {
        const s = setup();
        await addEntry(s.deps, 'pm1', 'c1', { type: 'richiesta', text: 'Serve ok', requestApproval: true });
        s.notify.mockClear(); s.sendEmail.mockClear();
        return s;
    }
    it('un PM non decide (403); l\'admin sì, e l\'autore riceve notifica ed email', async () => {
        const { deps, notify, sendEmail } = await withPending();
        expect((await decideEntry(deps, 'pm1', 'c1', 'l1', { decision: 'approvata' })).status).toBe(403);
        const r = await decideEntry(deps, 'ad1', 'c1', 'l1', { decision: 'rifiutata', comment: 'Non ora' });
        expect(r.status).toBe(200);
        expect(notify).toHaveBeenCalledWith(['pm1'], expect.objectContaining({ type: 'client_log_approval_decided' }));
        expect(sendEmail.mock.calls[0][0]).toEqual({ email: 'pm@x.it', name: 'Pia' });
        expect(sendEmail.mock.calls[0][1].subject).toMatch(/^\[RIFIUTATA\]/);
    });
    it('non si decide due volte (409) e una riga inesistente è 404', async () => {
        const { deps } = await withPending();
        await decideEntry(deps, 'ad1', 'c1', 'l1', { decision: 'approvata' });
        expect((await decideEntry(deps, 'ad1', 'c1', 'l1', { decision: 'rifiutata' })).status).toBe(409);
        expect((await decideEntry(deps, 'ad1', 'c1', 'nope', { decision: 'approvata' })).status).toBe(404);
    });
    it('se l\'admin decide una propria richiesta non si notifica da solo', async () => {
        const s = setup();
        await addEntry(s.deps, 'ad1', 'c1', { type: 'richiesta', text: 'mia', requestApproval: true });
        s.notify.mockClear(); s.sendEmail.mockClear();
        await decideEntry(s.deps, 'ad1', 'c1', 'l1', { decision: 'approvata' });
        expect(s.notify).not.toHaveBeenCalled();
        expect(s.sendEmail).not.toHaveBeenCalled();
    });
});
