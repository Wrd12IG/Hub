import { describe, it, expect } from 'vitest';
import { uniqueAccounts, isGbpLocation } from '../windsor-accounts';

describe('windsor-accounts', () => {
    it('un elemento per account, ordinato per nome senza badare alle maiuscole', () => {
        expect(uniqueAccounts([
            { account_id: 2, account_name: 'zeta srl' },
            { account_id: '1', account_name: 'Alfa' },
            { account_id: 2, account_name: 'zeta srl' },
            { account_id: 3, account_name: 'beta' },
        ])).toEqual([{ id: '1', name: 'Alfa' }, { id: '3', name: 'beta' }, { id: '2', name: 'zeta srl' }]);
    });

    it('senza nome usa l\'ID; senza ID scarta la riga', () => {
        expect(uniqueAccounts([{ account_id: 'abc' }, { account_name: 'senza id' }, { account_id: '' }])).toEqual([{ id: 'abc', name: 'abc' }]);
    });

    it("una sede GBP ha l'id che inizia con locations/", () => {
        expect(isGbpLocation({ id: 'locations/123', name: 'Sede' })).toBe(true);
        expect(isGbpLocation({ id: '989-753-0374', name: 'Arzuffi Srl' })).toBe(false);
        expect(isGbpLocation({ id: '10212832118588102', name: 'Antonio Basilio OK' })).toBe(false);
    });
});
