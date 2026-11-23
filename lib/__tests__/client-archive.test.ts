import { describe, it, expect } from 'vitest';
import { isArchivedClient, activeOnly, selectableClients, archivePatch } from '../client-archive';

const clients = [
    { id: 'a', name: 'Attivo senza campo' },
    { id: 'b', name: 'Archiviato', archived: true },
    { id: 'c', name: 'Ripristinato', archived: null },
    { id: 'd', name: 'Falso', archived: false },
];

describe('client-archive', () => {
    it('un cliente senza il campo (tutti quelli esistenti) è attivo', () => {
        expect(isArchivedClient({})).toBe(false);
        expect(isArchivedClient(null)).toBe(false);
        expect(isArchivedClient(undefined)).toBe(false);
        expect(isArchivedClient({ archived: null })).toBe(false);
        expect(isArchivedClient({ archived: false })).toBe(false);
        expect(isArchivedClient({ archived: true })).toBe(true);
    });

    it('activeOnly toglie solo gli archiviati e non modifica l\'elenco di partenza', () => {
        expect(activeOnly(clients).map((c) => c.id)).toEqual(['a', 'c', 'd']);
        expect(clients).toHaveLength(4);
    });

    it('selectableClients tiene gli attivi più quelli già selezionati', () => {
        expect(selectableClients(clients).map((c) => c.id)).toEqual(['a', 'c', 'd']);
        expect(selectableClients(clients, 'b').map((c) => c.id)).toEqual(['a', 'b', 'c', 'd']);
        expect(selectableClients(clients, undefined, null, 'x').map((c) => c.id)).toEqual(['a', 'c', 'd']);
    });

    it('selectableClients restituisce una copia: ordinarla non riordina l\'elenco originale', () => {
        const copy = selectableClients(clients);
        copy.reverse();
        expect(clients.map((c) => c.id)).toEqual(['a', 'b', 'c', 'd']);
    });

    it('archivePatch scrive la data, e ripristinare azzera i campi', () => {
        const t = '2026-11-23T10:00:00.000Z';
        expect(archivePatch(true, t)).toEqual({ archived: true, archivedAt: t, updatedAt: t });
        expect(archivePatch(false, t)).toEqual({ archived: null, archivedAt: null, updatedAt: t });
        expect(isArchivedClient(archivePatch(false, t))).toBe(false);
    });
});
