import { describe, it, expect } from 'vitest';
import { openBriefsWithoutProject } from '../brief-status';

describe('openBriefsWithoutProject', () => {
    const briefs = [
        { id: 'a', clientId: 'c1', status: 'Inviato' as const },
        { id: 'b', clientId: 'c1', status: 'Approvato' as const, projectId: 'p1' },
        { id: 'c', clientId: 'c1', status: 'Bozza' as const },
        { id: 'd', clientId: 'c1', status: 'Consegnato' as const },
        { id: 'e', clientId: 'c2', status: 'Inviato' as const },
    ];
    it('solo aperti, del cliente, senza progetto', () => {
        expect(openBriefsWithoutProject(briefs, 'c1').map(b => b.id)).toEqual(['a']);
    });
    it('senza cliente: nessuno', () => {
        expect(openBriefsWithoutProject(briefs, undefined)).toEqual([]);
    });
});
