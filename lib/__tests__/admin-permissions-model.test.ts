import { describe, it, expect } from 'vitest';
import { ACTIVE_ACTIONS, ALL_ITEMS, ALL_PAGE_ITEMS, INACTIVE_ACTIONS, PAGE_GROUPS, changedCount, has, isLockedOn, toggle } from '../admin-permissions-model';

// Le chiavi che il Hub aveva nella vecchia tabella: vanno tutte ritrovate, senza perderne né rinominarne
const OLD_PAGES = ['/dashboard', '/tasks', '/projects', '/calendar', '/editorial-plan', '/clients', '/briefs', '/social-strategies', '/absences', '/chat', '/documents', '/reports', '/admin/recurring-tasks', '/admin/recurring-projects', '/admin'];
const OLD_ACTIONS = ['_create-task', '_approve-tasks', '_create-recurring-projects', '_manage-users', '_view-financials', '_delete-task', '_manage-clients', '_approve-absences', '_manage-editorial-plan'];

describe('modello dei permessi', () => {
    it('contiene tutte le vecchie pagine e azioni, con le stesse chiavi, senza doppioni', () => {
        expect(ALL_PAGE_ITEMS.map((i) => i.key).sort()).toEqual([...OLD_PAGES].sort());
        expect([...ACTIVE_ACTIONS, ...INACTIVE_ACTIONS].map((i) => i.key).sort()).toEqual([...OLD_ACTIONS].sort());
        expect(new Set(ALL_ITEMS.map((i) => i.key)).size).toBe(ALL_ITEMS.length);
    });
    it('ogni voce ha etichetta e descrizione; «Clienti e report» è il primo gruppo e spiega la portata', () => {
        for (const i of ALL_ITEMS) { expect(i.label.length).toBeGreaterThan(1); expect(i.description.length).toBeGreaterThan(5); }
        expect(PAGE_GROUPS[0].title).toBe('Clienti e report');
        expect(PAGE_GROUPS[0].hint).toContain('TUTTI i clienti');
        expect(PAGE_GROUPS[0].items.map((i) => i.key)).toEqual(['/clients', '/reports']);
    });
    it('le sole azioni attive sono le tre che l\'app legge; le altre sei sono dichiarate senza effetto', () => {
        expect(ACTIVE_ACTIONS.map((a) => a.key).sort()).toEqual(['_approve-tasks', '_create-recurring-projects', '_create-task']);
        expect(INACTIVE_ACTIONS).toHaveLength(6);
        expect(INACTIVE_ACTIONS.every((a) => /non|Oggi/.test(a.description))).toBe(true);
    });
    it('«Clienti» è sempre attivo solo per il Project Manager', () => {
        expect(isLockedOn('Project Manager', '/clients')).toBe(true);
        expect(isLockedOn('Collaboratore', '/clients')).toBe(false);
        expect(isLockedOn('Project Manager', '/tasks')).toBe(false);
    });
});

describe('toggle e changedCount', () => {
    const base = { 'Project Manager': ['/clients'], Collaboratore: ['/tasks'], Cliente: ['/clients/x'] };
    it('aggiunge e toglie senza doppioni e senza toccare gli altri ruoli', () => {
        const on = toggle(base, 'Collaboratore', '/clients', true);
        expect(on.Collaboratore).toEqual(['/tasks', '/clients']);
        expect(toggle(on, 'Collaboratore', '/clients', true).Collaboratore).toEqual(['/tasks', '/clients']);
        expect(toggle(on, 'Collaboratore', '/clients', false).Collaboratore).toEqual(['/tasks']);
        expect(on['Project Manager']).toBe(base['Project Manager']);
        expect(on.Cliente).toEqual(['/clients/x']); // la colonna Cliente, non più visibile, resta com'è
    });
    it('un ruolo mai salvato parte vuoto', () => {
        expect(toggle({}, 'Collaboratore', '/clients', true)).toEqual({ Collaboratore: ['/clients'] });
        expect(has({}, 'Collaboratore', '/clients')).toBe(false);
    });
    it('conta le differenze rispetto al salvato; riportare tutto com\'era dà zero', () => {
        expect(changedCount(base, base)).toBe(0);
        const a = toggle(base, 'Collaboratore', '/clients', true);
        expect(changedCount(base, a)).toBe(1);
        const b = toggle(a, 'Project Manager', '/reports', true);
        expect(changedCount(base, b)).toBe(2);
        expect(changedCount(base, toggle(a, 'Collaboratore', '/clients', false))).toBe(0);
        expect(changedCount({}, { Collaboratore: ['/a', '/b'] })).toBe(2);
        expect(changedCount({ Collaboratore: ['/a', '/b'] }, {})).toBe(2);
    });
});
