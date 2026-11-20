# Monitor sito

Controlla ogni mese il sito registrato di ogni cliente (`clients/{id}.websiteUrl`), trova contenuti scaduti, errori e immagini da sistemare, e crea i task per gli utenti designati. È in **sola lettura** sul sito del cliente e non manda mai email o notifiche ai clienti.

## Come funziona

1. **Cron** `/api/cron/site-monitor` (ogni giorno alle 4:20 UTC, `vercel.json`): prende fino a 3 clienti con sito, non spenti, con ultima scansione oltre 30 giorni fa (i mai scansionati per primi).
2. **Budget** (`budget.ts`): pagine lette = minimo tra 25 per sito, tetto mensile del monitor e crediti Firecrawl sopra la riserva. Se i crediti non sono leggibili non scansiona.
3. **Scansione** (`scan.ts`): home + pagine della sitemap, lette con Firecrawl (1 credito a pagina). Poi controlli diretti gratuiti (`net.ts`) su fino a 40 link e 40 immagini, e sulla sitemap.
4. **Rilevatori** (puri, con test): contenuti scaduti (`dates.ts`), copyright fermo, sitemap ferma, pagina vuota, immagini senza alt/rotte/pesanti, pagine e link in errore.
5. **Confronto** con i problemi noti tramite impronta (`fingerprint.ts`): nessun doppione; sparito = «risolto»; «ignorato» resta ignorato. Una scansione parziale non dichiara nulla risolto.
6. **Task** (`tasks.ts`): solo gravità media e alta, max 10 a scansione, un task per pagina e tipo, assegnati a turno agli utenti designati. Mai due task per lo stesso gruppo: se ce n'è uno aperto, o chiuso da meno di 30 giorni, non se ne crea un altro. Senza utenti designati non nasce nulla e i problemi restano «nuovi».

Priorità: errori = Alta, contenuti scaduti = Media, foto/alt = Bassa (non genera task da sola).

## Dati (Firestore, solo server)

- `clients/{id}/private/siteMonitor`: mese e crediti spesi, ultima scansione, `enabled`, `assigneeIds`.
- `clients/{id}/siteScans/{id}`: una riga per scansione.
- `clients/{id}/siteFindings/{fingerprint}`: i problemi.
- `tasks`: i task portano `createdBy: 'site-monitor'` e `siteMonitorKey`.

Non serve toccare `firestore.rules`: si scrive solo con l'Admin SDK.

## Configurazione

| Variabile | Default | Note |
|---|---|---|
| `SITE_MONITOR_FIRECRAWL_KEY` | — | Chiave Firecrawl **dedicata**. Senza, le route rispondono con errore e non fanno nulla. Va messa in Vercel/`.env`, mai in Git. |
| `SITE_MONITOR_MONTHLY_CREDITS` | 500 | Tetto mensile del monitor |
| `SITE_MONITOR_RESERVE_CREDITS` | 1500 | Crediti che non si toccano mai |
| `SITE_MONITOR_MAX_PAGES` | 25 | Pagine per sito |
| `CRON_SECRET` | — | Già usato dagli altri cron |

## Uso

Pagina `/clients/{id}/site-monitor` (solo amministratori): scegli gli utenti designati, «Scansiona ora», seleziona i problemi e «Crea task» o «Ignora». Spegnere un cliente: `POST /api/site-monitor/{id}` con `{ "action": "settings", "enabled": false }`.

## Limiti noti

- Le date nei testi si capiscono solo con un contesto da promozione e un anno esplicito; il resto è ignorato di proposito.
- Link e immagini controllati a campione (40 + 40 per scansione).
- Le proposte sono modelli fissi: indicano cosa correggere, non riscrivono i testi.
- Provato solo con un Firecrawl finto: il primo test su un sito vero va fatto su un cliente, in prova (dry-run: `{ "action": "scan", "dryRun": true }`), con pochi crediti.

## Test

```bash
npx vitest run lib/__tests__/site-monitor
```
