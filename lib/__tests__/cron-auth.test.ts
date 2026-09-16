import { describe, expect, it } from 'vitest'
import { denyUnlessCron } from '@/lib/cron-auth'

/** Finta NextRequest: al helper servono solo gli header. */
function req(headers: Record<string, string>) {
    return { headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } } as any
}

const SECRET = 'abc123'

describe('denyUnlessCron', () => {
    const prev = process.env.CRON_SECRET
    const withSecret = () => { process.env.CRON_SECRET = SECRET }
    const withoutSecret = () => { delete process.env.CRON_SECRET }
    const restore = () => { if (prev === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = prev }

    /**
     * Il caso che era rotto in produzione: Vercel Cron manda solo questo
     * header, e daily-digest lo rifiutava da tre mesi.
     */
    it('accetta Authorization: Bearer, che è quello che manda Vercel', () => {
        withSecret()
        expect(denyUnlessCron(req({ authorization: `Bearer ${SECRET}`, host: 'hub.wrdigital.it' }), 't')).toBeNull()
        restore()
    })

    it('accetta x-cron-secret, che è quello che si usa da curl', () => {
        withSecret()
        expect(denyUnlessCron(req({ 'x-cron-secret': SECRET, host: 'hub.wrdigital.it' }), 't')).toBeNull()
        restore()
    })

    it('rifiuta un segreto sbagliato su entrambi gli header', () => {
        withSecret()
        expect(denyUnlessCron(req({ authorization: 'Bearer nope', host: 'h' }), 't')?.status).toBe(401)
        expect(denyUnlessCron(req({ 'x-cron-secret': 'nope', host: 'h' }), 't')?.status).toBe(401)
        expect(denyUnlessCron(req({ host: 'h' }), 't')?.status).toBe(401)
        restore()
    })

    it('non confonde un Bearer malformato con un segreto valido', () => {
        withSecret()
        expect(denyUnlessCron(req({ authorization: SECRET, host: 'h' }), 't')?.status).toBe(401)
        restore()
    })

    it('senza segreto configurato passa in locale e blocca in produzione', () => {
        withoutSecret()
        expect(denyUnlessCron(req({ host: 'localhost:9002' }), 't')).toBeNull()
        expect(denyUnlessCron(req({ host: 'hub.wrdigital.it' }), 't')?.status).toBe(401)
        restore()
    })
})
