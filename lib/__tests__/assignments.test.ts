// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseAssignmentsSheet } from '@/lib/assignments/parse';
import { matchClient, matchUser, tokens } from '@/lib/assignments/match';
import { buildPlan } from '@/lib/assignments/plan';
import type { AssignClient, AssignUser } from '@/lib/assignments/model';

const SHEET = [
    'Nome cliente\tDirezionale\tPeso\tReferente\tBackup\tReferente\tPeso totale\tClienti\tDirezionali',
    'Atel\tNo\t5\tValeria\tEleonora\tRebecca\t53\t10\t4',
    'Help\tNo\t6\tRebecca\tGiulia\tGiulia\t57\t9\t5',
    'Atlantis / Oregon\tNo\t7\tEleonora\tValeria\tValeria\t55\t10\t4',
    'Linkedin Mimmo\tNo\t2\tRebecca\tGiulia\tEleonora\t60\t10\t4',
    'Mangiafuoco\tSì\t7,5\tRebecca\tGiulia\tTotale\t225\t39\t17',
    'Totale\t\t\t\t\t\t\t\t',
].join('\n');

const clients: AssignClient[] = [
    { id: 'c1', name: 'ATEL MILANO' },
    { id: 'c2', name: 'MIMMO DORMIO S.R.L. - HELP COMPUTER' },
    { id: 'c3', name: 'ATLANTIS' },
    { id: 'c4', name: 'MANGIAFUOCO RISTORANTE' },
    { id: 'c5', name: 'MEDICAL SPA - AMBULATORIO' },
    { id: 'c6', name: 'MEDICAL - PARAFARMACIA' },
];
const users: AssignUser[] = [
    { id: 'u-val-m', name: 'Valeria Messinese', role: 'Project Manager', status: 'Attivo' },
    { id: 'u-val-d', name: 'Valeria Daniotti', role: 'Collaboratore', status: 'Attivo' },
    { id: 'u-reb', name: 'Rebecca Gatto', role: 'Project Manager' },
    { id: 'u-giu', name: 'Giulia Tarricone', role: 'Project Manager' },
    { id: 'u-ele', name: 'Eleonora Bassetto\t', role: 'Project Manager' },
    { id: 'u-old', name: 'Giulia Vecchia', role: 'Collaboratore', status: 'Inattivo' },
    { id: 'u-cli', name: 'Giulia Cliente', role: 'Cliente' },
];

describe('lettura del foglio', () => {
    const r = parseAssignmentsSheet(SHEET);
    it('legge le 5 colonne utili, ignora la seconda tabella e la riga Totale', () => {
        expect(r.rows).toHaveLength(5);
        expect(r.rows[0]).toEqual({ row: 1, clientName: 'Atel', direzionale: false, peso: 5, referente: 'Valeria', backup: 'Eleonora' });
        expect(r.rows[4]).toMatchObject({ clientName: 'Mangiafuoco', direzionale: true, peso: 7.5 });
    });
    it('accetta anche CSV con punto e virgola e righe senza referente le segnala', () => {
        const csv = 'Nome cliente;Direzionale;Peso;Referente;Backup\nAtel;Sì;5;Valeria;Eleonora\nSenza;No;3;;';
        const p = parseAssignmentsSheet(csv);
        expect(p.rows).toHaveLength(1);
        expect(p.warnings.join(' ')).toMatch(/manca il referente/);
    });
    it('un foglio vuoto non è un errore silenzioso', () => {
        expect(parseAssignmentsSheet('  \n ').warnings[0]).toMatch(/vuoto/);
    });
});

describe('abbinamento dei clienti', () => {
    it('toglie le sigle societarie e la punteggiatura', () => expect(tokens('BETTIN - BGF S.R.L.')).toEqual(['bettin', 'bgf']));
    it('nome abbreviato, o più lungo del cliente: «probabile» (si conferma in anteprima)', () => {
        expect(matchClient('Atel', clients)).toMatchObject({ status: 'probabile', candidates: [{ id: 'c1' }] });
        expect(matchClient('Help', clients)).toMatchObject({ status: 'probabile', candidates: [{ id: 'c2' }] });
        expect(matchClient('Atlantis / Oregon', clients)).toMatchObject({ status: 'probabile', candidates: [{ id: 'c3' }] });
    });
    it('uguale al cliente: esatto', () => expect(matchClient('Atlantis', clients).status).toBe('esatto'));
    it('più clienti possibili: ambiguo (lo sceglie una persona)', () => expect(matchClient('Medical', clients).status).toBe('ambiguo'));
    it('«Linkedin Mimmo» non è un cliente: nessuno', () => expect(matchClient('Linkedin Mimmo', clients).status).toBe('nessuno'));
});

describe('abbinamento degli utenti', () => {
    it('due persone con lo stesso nome: ambiguo', () => expect(matchUser('Valeria', users)).toMatchObject({ status: 'ambiguo' }));
    it('un solo nome tra lo staff attivo: abbinato (ignora inattivi e clienti)', () => {
        expect(matchUser('Rebecca', users)).toMatchObject({ status: 'probabile', candidates: [{ id: 'u-reb' }] });
        expect(matchUser('Giulia', users).candidates.map((u) => u.id)).toEqual(['u-giu']);
        expect(matchUser('Eleonora', users).candidates[0].id).toBe('u-ele');
    });
    it('nome e cognome: esatto', () => expect(matchUser('Valeria Messinese', users).status).toBe('esatto'));
});

describe('piano di modifiche', () => {
    const { rows } = parseAssignmentsSheet(SHEET);
    const userChoice = { Valeria: 'u-val-m', Rebecca: 'u-reb', Giulia: 'u-giu', Eleonora: 'u-ele' };
    const clientChoice = { 1: 'c1', 2: 'c2', 3: 'c3', 4: null, 5: 'c4' };

    it('costruisce le modifiche e salta le righe scelte come «salta»', () => {
        const p = buildPlan({ rows, clients, users, userChoice, clientChoice });
        expect(p.problems).toEqual([]);
        expect(p.skippedRows).toEqual([4]);
        expect(p.clientChanges.map((c) => [c.clientId, c.referenteId])).toEqual([['c1', 'u-val-m'], ['c2', 'u-reb'], ['c3', 'u-ele'], ['c4', 'u-reb']]);
        expect(p.clientChanges[3]).toMatchObject({ peso: 7.5, direzionale: true });
        expect(p.userChanges.map((u) => [u.userId, u.backupUserId]).sort()).toEqual([['u-ele', 'u-val-m'], ['u-reb', 'u-giu'], ['u-val-m', 'u-ele']].sort());
    });
    it('segnala la scelta mancante e non scrive niente per quella riga', () => {
        const p = buildPlan({ rows, clients, users, userChoice: { Rebecca: 'u-reb', Giulia: 'u-giu', Eleonora: 'u-ele' }, clientChoice });
        expect(p.problems.join(' ')).toMatch(/Manca la scelta.*Valeria/);
        expect(p.clientChanges.find((c) => c.clientId === 'c1')).toBeUndefined();
    });
    it('un cliente due volte, due backup per lo stesso referente, backup di se stesso', () => {
        const dup = buildPlan({ rows, clients, users, userChoice, clientChoice: { 1: 'c1', 2: 'c1', 3: 'c3', 4: null, 5: 'c4' } });
        expect(dup.problems.join(' ')).toMatch(/compare due volte/);
        const two = buildPlan({ rows: [{ ...rows[1] }, { ...rows[4], backup: 'Eleonora' }], clients, users, userChoice, clientChoice: { 2: 'c2', 5: 'c4' } });
        expect(two.problems.join(' ')).toMatch(/più di un backup/);
        const self = buildPlan({ rows: [{ ...rows[1], backup: 'Rebecca' }], clients, users, userChoice, clientChoice: { 2: 'c2' } });
        expect(self.problems.join(' ')).toMatch(/stesso/);
    });
    it('rifiuta un utente inattivo o Cliente come referente', () => {
        const p = buildPlan({ rows: [rows[1]], clients, users, userChoice: { ...userChoice, Rebecca: 'u-old', Giulia: 'u-giu' }, clientChoice: { 2: 'c2' } });
        expect(p.problems.join(' ')).toMatch(/non è uno staff attivo/);
        expect(p.clientChanges).toHaveLength(0);
    });
});

import { validateApply } from '@/lib/assignments/apply';

describe('controllo lato server', () => {
    const ok = { clientChanges: [{ clientId: 'c1', referenteId: 'u-reb', peso: 5, direzionale: false }], userChanges: [{ userId: 'u-reb', backupUserId: 'u-giu' }] };
    it('accetta un piano valido e tiene solo i campi consentiti', () => {
        const r = validateApply({ clientChanges: [{ ...ok.clientChanges[0], extra: 'x', managedBy: ['hack'] }], userChanges: ok.userChanges }, users, clients);
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.clientWrites[0]).toEqual({ clientId: 'c1', referenteId: 'u-reb', peso: 5, direzionale: false });
    });
    it('rifiuta: nulla da scrivere, cliente inesistente, referente inattivo o Cliente, backup di se stesso, doppioni, peso assurdo', () => {
        expect(validateApply({}, users, clients).ok).toBe(false);
        expect(validateApply({ clientChanges: [{ ...ok.clientChanges[0], clientId: 'zzz' }] }, users, clients).ok).toBe(false);
        expect(validateApply({ clientChanges: [{ ...ok.clientChanges[0], referenteId: 'u-old' }] }, users, clients).ok).toBe(false);
        expect(validateApply({ clientChanges: [{ ...ok.clientChanges[0], referenteId: 'u-cli' }] }, users, clients).ok).toBe(false);
        expect(validateApply({ userChanges: [{ userId: 'u-reb', backupUserId: 'u-reb' }] }, users, clients).ok).toBe(false);
        expect(validateApply({ clientChanges: [ok.clientChanges[0], ok.clientChanges[0]] }, users, clients).ok).toBe(false);
        expect(validateApply({ clientChanges: [{ ...ok.clientChanges[0], peso: 99999 }] }, users, clients).ok).toBe(false);
        expect(validateApply({ clientChanges: [{ ...ok.clientChanges[0], direzionale: 'sì' }] }, users, clients).ok).toBe(false);
    });
});
