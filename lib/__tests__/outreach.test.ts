// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { denyUnlessBridge, isValidOutreachId, parseCompanyItem, parseOutboxItem } from '../outreach';

const SECRET = 'a'.repeat(40);
const req = (auth?: string) => new NextRequest('http://localhost/api/outreach/sync', { headers: auth ? { authorization: auth } : {} });

describe('isValidOutreachId', () => {
    it('accetta gli id esadecimali di Sellbird', () => expect(isValidOutreachId('e0c73f3063af')).toBe(true));
    it.each(['', 'ab', '../x', 'a/b', 'a b', 'x'.repeat(65), 12345, null])('rifiuta %p', (v) => expect(isValidOutreachId(v)).toBe(false));
});

describe('parseOutboxItem', () => {
    const ok = { id: 'abcd1234', status: 'pending_review', to: 'info@example.com', subject: 'Oggetto', body: 'Testo', step: 1, kind: 'initial' };
    it('normalizza una riga valida', () => {
        const r = parseOutboxItem(ok)!;
        expect(r).toMatchObject({ id: 'abcd1234', status: 'pending_review', step: 1, sentAt: null, error: null });
    });
    it('scarta uno stato sconosciuto o un id pericoloso', () => {
        expect(parseOutboxItem({ ...ok, status: 'boh' })).toBeNull();
        expect(parseOutboxItem({ ...ok, id: '../../users/x' })).toBeNull();
        expect(parseOutboxItem(null)).toBeNull();
    });
    it('taglia i testi troppo lunghi', () => {
        expect(parseOutboxItem({ ...ok, body: 'x'.repeat(20000) })!.body).toHaveLength(8000);
    });
});

describe('parseCompanyItem', () => {
    it('legge una riga valida e ignora i campi non tipizzati', () => {
        expect(parseCompanyItem({ id: 'c1c1', name: 'Auto Srl', prospects: 2, emailsSent: '3', replied: 'yes' })).toMatchObject({ name: 'Auto Srl', prospects: 2, emailsSent: 0, replied: false });
    });
});

describe('denyUnlessBridge', () => {
    const old = process.env.OUTREACH_BRIDGE_SECRET;
    afterEach(() => { process.env.OUTREACH_BRIDGE_SECRET = old; });

    it('risponde 503 se il segreto manca o è corto', () => {
        delete process.env.OUTREACH_BRIDGE_SECRET;
        expect(denyUnlessBridge(req(`Bearer ${SECRET}`))?.status).toBe(503);
        process.env.OUTREACH_BRIDGE_SECRET = 'corto';
        expect(denyUnlessBridge(req('Bearer corto'))?.status).toBe(503);
    });
    it('risponde 401 senza intestazione o col segreto sbagliato', () => {
        process.env.OUTREACH_BRIDGE_SECRET = SECRET;
        expect(denyUnlessBridge(req())?.status).toBe(401);
        expect(denyUnlessBridge(req('Bearer sbagliato'))?.status).toBe(401);
    });
    it('lascia passare il segreto giusto', () => {
        process.env.OUTREACH_BRIDGE_SECRET = SECRET;
        expect(denyUnlessBridge(req(`Bearer ${SECRET}`))).toBeNull();
    });
});
