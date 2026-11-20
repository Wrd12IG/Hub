// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createTasksForFindings, type ExistingTask, type TaskPort } from '@/lib/site-monitor/tasks';
import { dueClients } from '@/lib/site-monitor/service';
import { fingerprint } from '@/lib/site-monitor/fingerprint';
import type { FindingRecord } from '@/lib/site-monitor/store';
import type { Finding } from '@/lib/site-monitor/types';

const NOW = new Date('2026-11-20T10:00:00Z');
const mk = (f: Partial<Finding> & Pick<Finding, 'type' | 'severity' | 'url'>): FindingRecord => {
    const full: Finding = { key: 'k', evidence: 'prova', confidence: 'alta', ...f };
    return { ...full, fingerprint: fingerprint(full), status: 'nuovo', firstSeen: '', lastSeen: '', scanId: 's' };
};
function port(existing: Record<string, ExistingTask[]> = {}) {
    const created: Array<{ title: string; assignedUserId: string; siteMonitorKey: string; priority: string }> = [];
    const p: TaskPort = {
        findByKey: async (_c, key) => existing[key] ?? [],
        create: async (t) => { created.push(t); return `t${created.length}`; },
    };
    return { p, created };
}
const err = mk({ type: 'http_error', severity: 'alta', url: 'https://a.it/rotta', key: '404' });
const old = mk({ type: 'expired_content', severity: 'media', url: 'https://a.it/offerte', key: 'x' });
const low = mk({ type: 'image_no_alt', severity: 'bassa', url: 'https://a.it/', key: 'img' });

describe('creazione task', () => {
    it('crea solo per media/alta, con priorità giusta, e segna i problemi', async () => {
        const { p, created } = port();
        const r = await createTasksForFindings('c1', 'Auto Esempio', [err, old, low], ['u1'], p, NOW);
        expect(r.created).toBe(2);
        expect(created.map((t) => t.priority).sort()).toEqual(['Alta', 'Media']);
        expect(r.updated.every((f) => f.status === 'task_creato' && f.taskId)).toBe(true);
        expect(r.updated.find((f) => f.fingerprint === low.fingerprint)).toBeUndefined();
    });
    it('senza utenti designati non crea nulla', async () => {
        const { p, created } = port();
        const r = await createTasksForFindings('c1', 'X', [err], [], p, NOW);
        expect(r).toMatchObject({ created: 0, reason: 'nessun_utente_designato' });
        expect(created).toHaveLength(0);
    });
    it('assegna a turno', async () => {
        const { p, created } = port();
        await createTasksForFindings('c1', 'X', [err, old], ['u1', 'u2'], p, NOW);
        expect(new Set(created.map((t) => t.assignedUserId))).toEqual(new Set(['u1', 'u2']));
    });
    it('non duplica: task aperto o chiuso da meno di 30 giorni blocca, oltre 30 giorni no', async () => {
        const keyOf = async () => { const { p, created } = port(); await createTasksForFindings('c1', 'X', [err], ['u1'], p, NOW); return created[0].siteMonitorKey; };
        const key = await keyOf();
        const open = port({ [key]: [{ status: 'In Lavorazione' }] });
        expect((await createTasksForFindings('c1', 'X', [err], ['u1'], open.p, NOW)).skipped).toBe(1);
        const recent = port({ [key]: [{ status: 'Approvato', updatedAt: '2026-11-10T00:00:00Z' }] });
        expect((await createTasksForFindings('c1', 'X', [err], ['u1'], recent.p, NOW)).created).toBe(0);
        const oldClosed = port({ [key]: [{ status: 'Approvato', updatedAt: '2026-09-01T00:00:00Z' }] });
        expect((await createTasksForFindings('c1', 'X', [err], ['u1'], oldClosed.p, NOW)).created).toBe(1);
    });
    it('al massimo 10 task a scansione', async () => {
        const many = Array.from({ length: 15 }, (_, i) => mk({ type: 'http_error', severity: 'alta', url: `https://a.it/p${i}`, key: '404' }));
        const { p, created } = port();
        await createTasksForFindings('c1', 'X', many, ['u1'], p, NOW);
        expect(created).toHaveLength(10);
    });
    it('rispetta la scelta manuale e ignora problemi non nuovi', async () => {
        const { p, created } = port();
        await createTasksForFindings('c1', 'X', [err, { ...old, status: 'ignorato' }], ['u1'], p, NOW, { only: new Set([err.fingerprint, old.fingerprint]) });
        expect(created).toHaveLength(1);
    });
});

describe('clienti da scansionare', () => {
    const row = (id: string, websiteUrl: string, state: object | null) => ({ id, websiteUrl, state: state as never });
    it('mensile, con sito, non spenti, più vecchi per primi', () => {
        const ids = dueClients([
            row('a', 'a.it', { month: '', creditsUsed: 0, lastScanAt: '2026-11-15T00:00:00Z' }),
            row('b', 'b.it', null),
            row('c', '', null),
            row('d', 'd.it', { month: '', creditsUsed: 0, enabled: false }),
            row('e', 'e.it', { month: '', creditsUsed: 0, lastScanAt: '2026-09-01T00:00:00Z' }),
        ], NOW);
        expect(ids).toEqual(['b', 'e']);
    });
});
