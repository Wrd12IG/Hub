import { describe, it, expect } from 'vitest';
import { computeLabourCost, hourlyOverheadOf, monthWindow, NO_CLIENT_ID } from '../labour-cost';

const NOW = new Date(2026, 9, 21); // 21 ottobre 2026
const users = { u1: { hourlyRate: 40 }, u2: {} }; // u2: senza tariffa = 30 €/h
const names = { c1: 'City Motors', c2: 'Dalma' };
const H = 3600;

describe('finestra dei mesi', () => {
    it('tre mesi completi prima di ottobre', () => {
        expect(monthWindow(3, NOW)).toEqual({ months: ['2026-07', '2026-08', '2026-09'], current: '2026-10' });
    });
    it('a gennaio scavalca l\'anno', () => {
        expect(monthWindow(3, new Date(2027, 0, 10))).toEqual({ months: ['2026-10', '2026-11', '2026-12'], current: '2027-01' });
    });
});

describe('costo del lavoro per cliente', () => {
    it('ore per costo orario, media sui mesi completi', () => {
        const r = computeLabourCost({
            now: NOW, usersById: users, clientNames: names,
            tasks: [
                { clientId: 'c1', timeSpent: 10 * H, assignedUserId: 'u1', dueDate: '2026-09-15' }, // 10h × 40 = 400
                { clientId: 'c1', timeSpent: 20 * H, assignedUserId: 'u2', dueDate: '2026-08-10' }, // 20h × 30 = 600
                { clientId: 'c1', timeSpent: 5 * H, assignedUserId: 'u1', updatedAt: '2026-10-02T10:00:00Z' }, // mese in corso: 200
            ],
            activities: [],
        });
        const c = r.clients[0];
        expect(c.name).toBe('City Motors');
        expect(c.monthlyCost).toBe(333.33); // (0 + 600 + 400) / 3
        expect(c.monthlyHours).toBe(10);
        expect(c.currentMonth).toEqual({ hours: 5, cost: 200, fullCost: 200 });
    });

    it('attività su più clienti: divisa in parti uguali', () => {
        const r = computeLabourCost({
            now: NOW, usersById: users, clientNames: names, tasks: [],
            activities: [{ clientIds: ['c1', 'c2'], startTime: '2026-09-03T09:00:00Z', endTime: '2026-09-03T13:00:00Z', userId: 'u1' }], // 4h × 40 = 160 → 80 + 80
        });
        expect(r.clients.map((c) => [c.clientId, c.byMonth['2026-09'].cost])).toEqual(expect.arrayContaining([['c1', 80], ['c2', 80]]));
        expect(r.total.monthlyCost).toBe(53.33);
    });

    it('ignora i mesi fuori finestra e le ore a zero', () => {
        const r = computeLabourCost({
            now: NOW, usersById: users, clientNames: names,
            tasks: [
                { clientId: 'c1', timeSpent: 10 * H, assignedUserId: 'u1', dueDate: '2026-03-15' },
                { clientId: 'c2', timeSpent: 0, assignedUserId: 'u1', dueDate: '2026-09-15' },
            ],
            activities: [],
        });
        expect(r.clients).toEqual([]);
        expect(r.total.monthlyCost).toBe(0);
    });
});

describe('ore senza cliente', () => {
    it('task e attività senza cliente finiscono in una riga a parte, in fondo, e nel totale', () => {
        const r = computeLabourCost({
            now: NOW, usersById: users, clientNames: names,
            tasks: [
                { clientId: 'c1', timeSpent: 30 * H, assignedUserId: 'u1', dueDate: '2026-09-10' }, // 1200
                { timeSpent: 3 * H, assignedUserId: 'u1', dueDate: '2026-09-11' }, // senza cliente: 120
            ],
            activities: [{ startTime: '2026-09-12T09:00:00Z', endTime: '2026-09-12T10:00:00Z', userId: 'u1' }], // senza cliente: 40
        });
        expect(r.clients.map((c) => c.clientId)).toEqual(['c1', NO_CLIENT_ID]);
        expect(r.clients[1].name).toBe('Senza cliente (lavoro interno)');
        expect(r.clients[1].byMonth['2026-09']).toMatchObject({ hours: 4, cost: 160 });
        expect(r.total.monthlyCost).toBe(453.33); // (1200 + 160) / 3
    });
});

describe('costo pieno (costi aziendali)', () => {
    it('sovrapprezzo orario come nel pannello Costi Aziendali: totale ÷ collaboratori e PM attivi ÷ 160', () => {
        const staff = [{ role: 'Collaboratore' }, { role: 'Project Manager' }, { role: 'Collaboratore', status: 'Inattivo' }, { role: 'Amministratore' }, { role: 'Cliente' }];
        expect(hourlyOverheadOf({ dirigenza: 2000, struttura: 1000, varie: 200 }, staff)).toBe(3200 / 2 / 160); // 10 €/h
        expect(hourlyOverheadOf(null, staff)).toBe(0);
        expect(hourlyOverheadOf({ dirigenza: 100 }, [])).toBe(0);
    });
    it('il costo pieno aggiunge il sovrapprezzo alle ore, il diretto no', () => {
        const r = computeLabourCost({
            now: NOW, usersById: users, clientNames: names, hourlyOverhead: 10,
            tasks: [{ clientId: 'c1', timeSpent: 10 * H, assignedUserId: 'u1', dueDate: '2026-09-15' }], // 400 diretto, 500 pieno
            activities: [],
        });
        expect(r.hourlyOverhead).toBe(10);
        expect(r.clients[0].byMonth['2026-09']).toEqual({ hours: 10, cost: 400, fullCost: 500 });
        expect(r.clients[0].monthlyFullCost).toBe(166.67);
        expect(r.clients[0].monthlyCost).toBe(133.33);
    });
});

describe('ripartizione del lavoro interno', () => {
    const base = {
        now: NOW, usersById: users, clientNames: names,
        tasks: [
            { clientId: 'c1', timeSpent: 30 * H, assignedUserId: 'u1', dueDate: '2026-09-10' }, // 30h, 1200
            { clientId: 'c2', timeSpent: 10 * H, assignedUserId: 'u1', dueDate: '2026-09-11' }, // 10h, 400
            { timeSpent: 8 * H, assignedUserId: 'u1', dueDate: '2026-09-12' }, // interno: 8h, 320
        ],
        activities: [],
    };
    const month = (r: ReturnType<typeof computeLabourCost>, id: string) => r.clients.find((c) => c.clientId === id)!.byMonth['2026-09'];

    it('proporzionale alle ore: 75% a c1 e 25% a c2, la riga «senza cliente» sparisce', () => {
        const r = computeLabourCost({ ...base, allocate: 'proportional' });
        expect(month(r, 'c1')).toMatchObject({ hours: 36, cost: 1440 }); // 1200 + 240
        expect(month(r, 'c2')).toMatchObject({ hours: 12, cost: 480 }); // 400 + 80
        expect(r.clients.find((c) => c.clientId === NO_CLIENT_ID)).toBeUndefined();
    });
    it('in parti uguali: metà a testa', () => {
        const r = computeLabourCost({ ...base, allocate: 'equal' });
        expect(month(r, 'c1').cost).toBe(1360); // 1200 + 160
        expect(month(r, 'c2').cost).toBe(560); // 400 + 160
    });
    it('il totale non cambia: ripartire sposta i costi, non li crea', () => {
        const none = computeLabourCost(base);
        const prop = computeLabourCost({ ...base, allocate: 'proportional' });
        expect(prop.total.monthlyCost).toBe(none.total.monthlyCost);
        expect(prop.total.monthlyHours).toBe(none.total.monthlyHours);
    });
    it('un mese senza nessun cliente con ore: il lavoro interno resta nella sua riga', () => {
        const r = computeLabourCost({ ...base, tasks: [{ timeSpent: 5 * H, assignedUserId: 'u1', dueDate: '2026-08-02' }], allocate: 'proportional' });
        expect(r.clients).toHaveLength(1);
        expect(r.clients[0].clientId).toBe(NO_CLIENT_ID);
    });
    it('il costo pieno si ripartisce insieme al diretto', () => {
        const r = computeLabourCost({ ...base, hourlyOverhead: 10, allocate: 'proportional' });
        // c1: diretto 1200 + 75% di 320 = 1440; pieno = 1200 + 30h×10 = 1500, più il 75% del pieno interno (320 + 8h×10 = 400) = 300 → 1800
        expect(month(r, 'c1')).toMatchObject({ cost: 1440, fullCost: 1800 });
    });
});
