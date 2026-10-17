// Prova reale del pilota: legge i totali Google Ads di un account tramite Composio.
//   npx tsx --env-file=.env.local scripts/composio-google-ads-check.ts <customer_id> [giorni]
// Richiede COMPOSIO_API_KEY e il collegamento Google Ads dell'agenzia (se manca stampa il link da aprire).
import { getGoogleAdsAccountTotalsViaComposio } from '../lib/google-ads-composio';
import { ComposioNotConnectedError } from '../lib/composio-client';

const [customerId, daysArg] = process.argv.slice(2);
if (!customerId) { console.error('Uso: composio-google-ads-check.ts <customer_id> [giorni]'); process.exit(1); }

const days = Number(daysArg) || 30;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const to = new Date(); const from = new Date(Date.now() - days * 86_400_000);

getGoogleAdsAccountTotalsViaComposio(customerId, iso(from), iso(to))
    .then(t => console.log(`Totali ${iso(from)} -> ${iso(to)} per ${customerId}:`, t))
    .catch(err => {
        if (err instanceof ComposioNotConnectedError) console.error(err.message);
        else console.error('Errore:', err.message);
        process.exit(1);
    });
