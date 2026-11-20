// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { findExpiredContent } from '@/lib/site-monitor/dates';
import { findStaleCopyright } from '@/lib/site-monitor/copyright';
import { parseSitemap, staleSitemapFinding } from '@/lib/site-monitor/sitemap';
import { extractImages, extractLinks, imageAltFindings } from '@/lib/site-monitor/images';
import { classifyImageCheck, classifyLinkCheck, classifyPageCheck } from '@/lib/site-monitor/checks';
import { canonicalUrl, fingerprint } from '@/lib/site-monitor/fingerprint';
import { analyzePage, dedupeSiteWide } from '@/lib/site-monitor/analyze';
import { buildTaskDraft, groupFindings, selectForTasks } from '@/lib/site-monitor/group';

const NOW = new Date('2026-11-20T10:00:00Z');
const URL1 = 'https://www.autoesempio.it/offerte';

describe('contenuti scaduti', () => {
    it('segnala una promozione con data passata', () => {
        const f = findExpiredContent('Super offerta valida fino al 31/10/2025 su tutta la gamma', NOW, URL1);
        expect(f).toHaveLength(1);
        expect(f[0].type).toBe('expired_content');
    });
    it('non segnala date future', () => {
        expect(findExpiredContent('Offerta valida fino al 31/12/2026', NOW, URL1)).toHaveLength(0);
    });
    it('ignora date senza parole da promozione e date impossibili', () => {
        expect(findExpiredContent('Pubblicato il 12/03/2024 da Mario', NOW, URL1)).toHaveLength(0);
        expect(findExpiredContent('Offerta valida fino al 31/02/2026', NOW, URL1)).toHaveLength(0);
    });
    it('riconosce data testuale e Black Friday con anno', () => {
        expect(findExpiredContent('Promo valida fino al 31 ottobre 2025', NOW, URL1).length).toBeGreaterThan(0);
        expect(findExpiredContent('Black Friday 2024: sconti folli', NOW, URL1).length).toBeGreaterThan(0);
    });
    it('regge un input da 1 MB senza rallentare', () => {
        const big = 'lorem ipsum dolor 12/ '.repeat(50_000);
        const t = Date.now();
        findExpiredContent(big, NOW, URL1);
        expect(Date.now() - t).toBeLessThan(3000);
    });
});

describe('copyright', () => {
    it('segnala anno fermo', () => {
        expect(findStaleCopyright('© 2022 Auto Esempio Srl', NOW, URL1)?.type).toBe('stale_copyright');
    });
    it('non segnala anno corrente', () => {
        expect(findStaleCopyright('© 2026 Auto Esempio Srl', NOW, URL1)).toBeNull();
    });
});

describe('sitemap', () => {
    it('legge lastmod e segnala sitemap ferma', () => {
        const xml = '<urlset><url><loc>https://a.it/</loc><lastmod>2019-07-12</lastmod></url></urlset>';
        const info = parseSitemap(xml);
        expect(info.urls).toHaveLength(1);
        const f = staleSitemapFinding(info, 'https://a.it/sitemap.xml', NOW);
        expect(f?.type).toBe('stale_sitemap');
        expect(f?.severity).toBe('media');
    });
});

describe('immagini e link', () => {
    const html = '<img src="/a.jpg"><img src="/b.jpg" alt=""><img data-src="/c.jpg" alt="Fiat"><a href="/x">x</a><a href="mailto:a@b.it">m</a>';
    it('alt mancante diverso da alt vuoto, lazy src letto', () => {
        const imgs = extractImages(html, 'https://a.it/');
        expect(imgs).toHaveLength(3);
        expect(imageAltFindings(imgs, 'https://a.it/')).toHaveLength(1);
    });
    it('estrae solo link http', () => {
        expect(extractLinks(html, 'https://a.it/')).toEqual(['https://a.it/x']);
    });
});

describe('controlli di rete', () => {
    it('classifica pagine e link', () => {
        expect(classifyPageCheck({ url: URL1, status: 404, html: '' })?.severity).toBe('alta');
        expect(classifyPageCheck({ url: URL1, status: 200, html: 'x' })).toBeNull();
        expect(classifyLinkCheck({ url: 'https://x.it/', status: 403 }, URL1, false)).toEqual([]);
        expect(classifyLinkCheck({ url: 'https://x.it/', status: 404 }, URL1, false)[0]?.type).toBe('broken_link');
        expect(classifyImageCheck({ url: 'https://x.it/a.jpg', status: 404 }, URL1)[0]?.type).toBe('image_broken');
    });
});

describe('impronta', () => {
    it('canonicalUrl normalizza', () => {
        expect(canonicalUrl('https://WWW.A.it/p/?utm_source=x&b=2&a=1#top')).toBe(canonicalUrl('https://a.it/p?a=1&b=2'));
    });
    it('è stabile e il copyright è per sito', () => {
        const a = { type: 'stale_copyright' as const, severity: 'bassa' as const, url: 'https://a.it/x', key: 'copyright', evidence: '', confidence: 'alta' as const };
        expect(fingerprint(a)).toBe(fingerprint({ ...a, url: 'https://a.it/y' }));
    });
});

describe('analisi e task', () => {
    const body = 'Offerta valida fino al 31/10/2025 '.repeat(3) + 'parola '.repeat(60) + '© 2022 Auto';
    const page = { url: URL1, status: 200, html: `<html><body><p>${body}</p><img src="/a.jpg"></body></html>` };
    it('analizza una pagina e crea una bozza di task', () => {
        const an = analyzePage(page, NOW);
        expect(an.findings.length).toBeGreaterThan(0);
        const groups = groupFindings(dedupeSiteWide(an.findings));
        const picked = selectForTasks(groups, { max: 10, minSeverity: 'media' });
        expect(picked.length).toBeGreaterThan(0);
        const draft = buildTaskDraft(picked[0], { clientName: 'Auto Esempio', now: NOW });
        expect(draft.title).toContain('Auto Esempio');
        expect(['Bassa', 'Media', 'Alta']).toContain(draft.priority);
        expect(draft.estimatedDuration).toBeLessThanOrEqual(120);
    });
    it('pagina in errore: un solo problema', () => {
        const an = analyzePage({ url: URL1, status: 500, html: '' }, NOW);
        expect(an.findings).toHaveLength(1);
    });
    it('pagina vuota', () => {
        const an = analyzePage({ url: URL1, status: 200, html: '<p>Ciao</p>' }, NOW);
        expect(an.findings.some((f) => f.type === 'empty_page')).toBe(true);
    });
});
