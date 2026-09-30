import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * La logica di lettura di useFormDraft, verificata sullo storage invece che
 * attraverso React: in questo repo vitest non ha jsdom, quindi non si può
 * montare un hook. Quello che conta qui non è React — è che una bozza
 * illeggibile, scaduta o uno storage che lancia non facciano cadere il form.
 */

const PREFIX = 'hub:draft:'
const TTL = 7 * 24 * 60 * 60 * 1000

/** Stessa lettura del hook, isolata per poterla provare. */
function readDraft(store: Storage, key: string, ttlMs = TTL) {
    try {
        const raw = store.getItem(PREFIX + key)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (!parsed?.savedAt) return null
        if (Date.now() - Date.parse(parsed.savedAt) > ttlMs) {
            store.removeItem(PREFIX + key)
            return null
        }
        return parsed
    } catch {
        return null
    }
}

function memStore(): Storage {
    const m = new Map<string, string>()
    return {
        get length() { return m.size },
        clear: () => m.clear(),
        getItem: (k: string) => m.get(k) ?? null,
        key: (i: number) => Array.from(m.keys())[i] ?? null,
        removeItem: (k: string) => { m.delete(k) },
        setItem: (k: string, v: string) => { m.set(k, v) },
    } as Storage
}

describe('lettura della bozza', () => {
    let store: Storage
    beforeEach(() => { store = memStore() })

    it('restituisce una bozza fresca', () => {
        store.setItem(PREFIX + 'k', JSON.stringify({ values: { title: 'Ciao' }, savedAt: new Date().toISOString() }))
        expect(readDraft(store, 'k')?.values.title).toBe('Ciao')
    })

    it('scarta e cancella una bozza oltre il TTL', () => {
        const old = new Date(Date.now() - TTL - 1000).toISOString()
        store.setItem(PREFIX + 'k', JSON.stringify({ values: { title: 'Vecchia' }, savedAt: old }))
        expect(readDraft(store, 'k')).toBeNull()
        expect(store.getItem(PREFIX + 'k')).toBeNull()
    })

    it('non cade su JSON corrotto', () => {
        store.setItem(PREFIX + 'k', '{rotto')
        expect(readDraft(store, 'k')).toBeNull()
    })

    it('ignora una bozza senza savedAt, che non si può datare', () => {
        store.setItem(PREFIX + 'k', JSON.stringify({ values: { title: 'x' } }))
        expect(readDraft(store, 'k')).toBeNull()
    })

    it('non cade se lo storage lancia (finestra anonima, dati bloccati)', () => {
        const hostile = { getItem: () => { throw new Error('SecurityError') } } as unknown as Storage
        expect(readDraft(hostile, 'k')).toBeNull()
    })

    it('chiavi diverse non si mescolano fra clienti e utenti', () => {
        store.setItem(PREFIX + 'task:u1:new:cliente-a', JSON.stringify({ values: { title: 'A' }, savedAt: new Date().toISOString() }))
        expect(readDraft(store, 'task:u1:new:cliente-b')).toBeNull()
        expect(readDraft(store, 'task:u2:new:cliente-a')).toBeNull()
        expect(readDraft(store, 'task:u1:new:cliente-a')?.values.title).toBe('A')
    })
})

describe('cosa entra nella bozza', () => {
    /** Stessa preparazione del form, isolata. */
    function forDraft(values: Record<string, any>) {
        const attachments = (values.attachments ?? []) as any[]
        return {
            ...values,
            dueDate: values.dueDate instanceof Date ? values.dueDate.toISOString() : values.dueDate,
            attachments: attachments.filter((a) => !a?._pendingUpload),
        }
    }

    it('esclude gli allegati in attesa, il cui blob muore al reload', () => {
        const out = forDraft({
            title: 'T',
            attachments: [
                { url: 'https://storage/vero.pdf', filename: 'vero.pdf' },
                { url: 'blob:http://localhost/abc', filename: 'appena-scelto.png', _pendingUpload: true },
            ],
        })
        expect(out.attachments).toHaveLength(1)
        expect(out.attachments[0].filename).toBe('vero.pdf')
    })

    it('serializza la data, che JSON non conserva come tipo', () => {
        const d = new Date('2026-10-15T09:00:00.000Z')
        const out = forDraft({ dueDate: d })
        expect(typeof out.dueDate).toBe('string')
        expect(new Date(out.dueDate).getTime()).toBe(d.getTime())
    })

    it('sopravvive al giro completo salva → rileggi', () => {
        const store = memStore()
        const prepared = forDraft({ title: 'Giro', dueDate: new Date('2026-10-15T09:00:00.000Z'), attachments: [] })
        store.setItem(PREFIX + 'k', JSON.stringify({ values: prepared, savedAt: new Date().toISOString() }))
        const back = readDraft(store, 'k')
        expect(back.values.title).toBe('Giro')
        expect(new Date(back.values.dueDate).getUTCHours()).toBe(9)
    })
})
