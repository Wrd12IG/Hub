import { describe, it, expect } from 'vitest';
import { isDueWithin48h, isProjectDone, isProjectOverdue, overdueDays, deliveryRisk } from '../dashboard-rules';

const now = new Date('2026-10-17T12:00:00Z');

describe('dashboard-rules', () => {
    it('48h: stessa regola per banner e avviso, esclude approvati e annullati', () => {
        expect(isDueWithin48h({ dueDate: '2026-10-19T00:00:00Z', status: 'Da Fare' }, now)).toBe(true);
        expect(isDueWithin48h({ dueDate: '2026-10-19T20:00:00Z', status: 'Da Fare' }, now)).toBe(false);
        expect(isDueWithin48h({ dueDate: '2026-10-18T00:00:00Z', status: 'Approvato' }, now)).toBe(false);
        expect(isDueWithin48h({ dueDate: '2026-10-16T00:00:00Z', status: 'Da Fare' }, now)).toBe(false);
    });

    it('progetto al 100% non è scaduto né critico', () => {
        const tasks = [{ status: 'Approvato' }, { status: 'Approvato' }, { status: 'Annullato' }];
        expect(isProjectDone({ status: 'In Corso' }, tasks)).toBe(true);
        expect(isProjectOverdue({ status: 'In Corso', endDate: '2025-10-17' }, tasks, now)).toBe(false);
        expect(isProjectOverdue({ status: 'In Corso', endDate: '2025-10-17' }, [{ status: 'Da Fare' }], now)).toBe(true);
        expect(isProjectDone({ status: 'In Pianificazione' }, [])).toBe(false);
    });

    it('task già scaduto = rischio alto, anche con storico a zero', () => {
        const due = new Date('2026-10-15T00:00:00Z');
        expect(overdueDays(due, now)).toBe(2);
        expect(deliveryRisk(0, overdueDays(due, now))).toBe('high');
        expect(deliveryRisk(0, 0)).toBe('low');
        expect(deliveryRisk(2, 0)).toBe('medium');
    });
});
