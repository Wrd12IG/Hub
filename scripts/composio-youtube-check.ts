// Prova reale del pilota YouTube: legge statistiche del canale e metriche del periodo tramite Composio.
//   npx tsx --env-file=.env.local scripts/composio-youtube-check.ts <user_id> [giorni]
// <user_id> = identità Composio del canale (es. youtube-wrdigital). Se non è collegato stampa il link da aprire
// con l'account Google proprietario del canale.
import { getYouTubeSummaryViaComposio } from '../lib/youtube-composio';
import { ComposioNotConnectedError } from '../lib/composio-client';

const [userId, daysArg] = process.argv.slice(2);
if (!userId) { console.error('Uso: composio-youtube-check.ts <user_id> [giorni]'); process.exit(1); }

const days = Number(daysArg) || 28;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const end = new Date(Date.now() - 2 * 86_400_000); // YouTube Analytics ha 1-2 giorni di ritardo
const start = new Date(end.getTime() - days * 86_400_000);

getYouTubeSummaryViaComposio(userId, iso(start), iso(end))
    .then(r => console.log(`Canale e totali ${iso(start)} -> ${iso(end)}:`, JSON.stringify(r, null, 2)))
    .catch(err => {
        console.error(err instanceof ComposioNotConnectedError ? err.message : `Errore: ${err.message}`);
        process.exit(1);
    });
