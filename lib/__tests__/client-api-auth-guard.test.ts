/**
 * Guardia: ogni chiamata del browser a una route /api che richiede l'accesso (verifyAuth) deve mandare il token.
 * Una chiamata con fetch() semplice riceve sempre 401: è successo con le GIF dell'editor storie e con «Pubblica ora»,
 * «Chiedi approvazione», la vista PED e i Brief del cliente. Usa authFetch (lib/client-api-auth.ts) o l'intestazione Authorization.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

const ROOT = join(__dirname, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === '.next' || name === '__tests__') continue;
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) walk(p, out);
        else if (/\.(ts|tsx)$/.test(name)) out.push(p);
    }
    return out;
}

/** Le route dell'app con il loro percorso e se richiedono l'accesso. */
function loadRoutes() {
    const apiDir = join(ROOT, 'app', 'api');
    return walk(apiDir).filter((f) => f.endsWith(`${sep}route.ts`)).map((f) => {
        const rel = relative(apiDir, join(f, '..')).split(sep).join('/');
        const pattern = '^/api/' + rel.split('/').map((seg) => (/^\[.+\]$/.test(seg) ? '[^/]+' : seg.replace(/[.*+?^${}()|\\]/g, '\\$&'))).join('/') + '/?$';
        return { rel, re: new RegExp(pattern), protectedRoute: /verifyAuth\(/.test(readFileSync(f, 'utf8')) };
    });
}

/** Il testo della chiamata fetch( … ) fino alla parentesi che la chiude. */
function callText(src: string, start: number): string {
    let depth = 0;
    for (let i = start; i < src.length; i++) {
        const ch = src[i];
        if (ch === '(') depth++;
        else if (ch === ')') { depth--; if (depth === 0) return src.slice(start, i + 1); }
    }
    return src.slice(start, start + 800);
}

describe('chiamate del browser alle route protette', () => {
    const routes = loadRoutes();
    const clientFiles = [...walk(join(ROOT, 'app')).filter((f) => !f.includes(`${sep}app${sep}api${sep}`)), ...walk(join(ROOT, 'components')), ...walk(join(ROOT, 'lib'))]
        .filter((f) => /^\s*['"]use client['"]/m.test(readFileSync(f, 'utf8').slice(0, 400)));

    it('trova le route e i file client (la guardia non è vuota)', () => {
        expect(routes.length).toBeGreaterThan(20);
        expect(routes.some((r) => r.protectedRoute)).toBe(true);
        expect(clientFiles.length).toBeGreaterThan(20);
    });

    it('nessuna fetch() verso una route protetta senza token', () => {
        const offenders: string[] = [];
        for (const file of clientFiles) {
            const src = readFileSync(file, 'utf8');
            const re = /(?<![A-Za-z_.])fetch\(\s*([`'"])(\/api\/[^`'"]*)\1/g;
            let m: RegExpExecArray | null;
            while ((m = re.exec(src))) {
                const url = m[2].split('?')[0].replace(/\$\{[^}]*\}/g, 'X');
                const route = routes.find((r) => r.re.test(url));
                if (!route || !route.protectedRoute) continue;
                const call = callText(src, m.index + 'fetch'.length);
                if (/Authorization|getAuthHeaders|authFetch/.test(call)) continue;
                // Intestazioni passate con una variabile (`{ headers }`, `headers: headers()`): vale se il file costruisce davvero un token
                if (/\bheaders\b/.test(call) && /Authorization|getAuthHeaders/.test(src)) continue;
                const line = src.slice(0, m.index).split('\n').length;
                offenders.push(`${relative(ROOT, file)}:${line} → ${m[2]}`);
            }
        }
        expect(offenders).toEqual([]);
    });
});
