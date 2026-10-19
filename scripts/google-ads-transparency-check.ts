// Prova reale: cerca gli annunci Google di uno o più competitor nel Centro per la trasparenza pubblicitaria (BigQuery).
//   npx tsx --env-file=.env.local scripts/google-ads-transparency-check.ts "Spotorno Car=spotornocar.it" "Autosilano"
// Ogni argomento è "Nome" oppure "Nome=sito". Serve il ruolo «Utente job BigQuery» al service account (se manca lo dice).
import { searchAdvertisers } from '../lib/google-ads-transparency';

const targets = process.argv.slice(2).map((arg, i) => {
    const [nome, sito] = arg.split('=');
    return { id: `c${i + 1}`, nome: nome.trim(), sito: sito?.trim() };
});
if (targets.length === 0) { console.error('Uso: google-ads-transparency-check.ts "Nome=sito" ...'); process.exit(1); }

searchAdvertisers(targets)
    .then(rows => {
        for (const t of targets) {
            const mine = rows.filter(r => r.competitorId === t.id);
            console.log(`\n${t.nome}${t.sito ? ` (${t.sito})` : ''}: ${mine.length} inserzionisti`);
            for (const r of mine) console.log(`  ${r.advertiser} [${r.advertiserId}] ${r.creatives} annunci, ${r.recent} ultimi 30 gg, ultimo ${r.lastShown}`, r.formats);
        }
    })
    .catch(err => { console.error('Errore:', err.message); process.exit(1); });
