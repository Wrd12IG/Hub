# Estensione Sellbird: il titolare delle aziende, con Firecrawl

Per le aziende dove Sellbird ha solo una casella generica (`info@`), chiede a Firecrawl chi è il titolare (CEO, poi
marketing) e crea un contatto con nome, ruolo e indirizzo verificato. Poi il flusso è quello di sempre: il Writer scrive
a quella persona e la bozza va nell'Outbox, **in attesa della tua approvazione**.

È un'**estensione** di Sellbird (un pacchetto a parte, vedi `docs/extensions.md` di Sellbird): non modifica il suo codice,
si accende con un interruttore e si toglie senza lasciare tracce. Di default è **spenta**.

## Come funziona

Un passo a ogni ciclo di Sellbird (solo se `FIRECRAWL_ENRICH=on`):

1. **Candidate:** aziende con buon punteggio (`FIRECRAWL_ENRICH_MIN_FIT`, default 50), stato «Ready», «Draft waiting» o
   «Not contacted», **senza** una persona con nome e un indirizzo utilizzabile, **senza** email inviate o approvate (quello
   che una persona ha approvato non si annulla mai), non provate negli ultimi 90 giorni, non portali (Subito, PagineBianche…).
2. **Bilancio prima di ogni chiamata:** tetto giornaliero e mensile, e una **riserva** sull'account che non si tocca (l'account
   Firecrawl è condiviso con altri usi). Il bilancio conta il **listino** (100 crediti per titolare trovato, 0 per chi non si
   trova), non quanto Firecrawl scala davvero: è la scelta prudente.
3. **Chiamata:** `anymailfinder / people/decision-maker`, categorie `ceo` poi `marketing`. La richiesta è idempotente
   (`x-request-id` = azienda + giorno): la stessa non si paga due volte.
4. **Controlli sul risultato:** indirizzo `valid`, **dello stesso dominio** dell'azienda, non una casella di ruolo, nome che
   somiglia a una persona. Poi «mai contattare» e disiscrizioni di Sellbird. Il nostro verificatore (Reoon, se c'è) può solo
   **bocciare**, mai promuovere.
5. **Creazione:** il titolare diventa un contatto (`source=firecrawl_anymail`, `verified`). La casella generica dello stesso
   posto passa a `lost` e la sua bozza in attesa viene annullata: così non si scrive due volte alla stessa azienda.
6. **Stop che richiede una persona** (chiave rifiutata, crediti finiti, **termini del fornitore da accettare**): l'estensione si
   ferma da sola finché non lanci `sellbird firecrawl resume`. **Non accetta mai i termini di un fornitore**: lo fa un
   amministratore dal sito Firecrawl.

## Installazione sul server

Prerequisito: il ponte e Sellbird girano già con `docker-compose.vm.yml` (vedi `scripts/sellbird-bridge`).

1. **Chiave dedicata.** Sul sito Firecrawl crea una chiave API solo per Sellbird (così l'uso si distingue). **Non incollarla in
   chat né in Git:** mettila tu nel file `.env` della VM (`nano ~/sellbird/.env`):
   ```
   FIRECRAWL_API_KEY=fc-...
   FIRECRAWL_ENRICH=off
   FIRECRAWL_ENRICH_MONTHLY_CREDITS=1000
   FIRECRAWL_ENRICH_DAILY_CREDITS=300
   FIRECRAWL_RESERVE_CREDITS=1500
   ```
2. **Termini del fornitore.** Nella pagina «Provider terms» del sito Firecrawl, un amministratore accetta quelli di Anymail
   Finder (se non l'ha già fatto).
3. **Copia la cartella** `scripts/sellbird-firecrawl` sulla VM in `~/sellbird/firecrawl/`.
4. **Costruisci l'immagine con l'estensione** (dopo quella di Sellbird, `sellbird-local`):
   ```bash
   cd ~/sellbird && docker build -t sellbird-firecrawl -f firecrawl/Dockerfile.vm firecrawl/
   ```
5. **Avvia Sellbird con quell'immagine** (senza `--build`, che la sovrascriverebbe):
   ```bash
   export SELLBIRD_UID=$(id -u) SELLBIRD_GID=$(id -g) SELLBIRD_IMAGE=sellbird-firecrawl
   docker compose -f docker-compose.yml -f docker-compose.vm.yml up -d --no-build
   ```
   Dopo ogni ricostruzione di `sellbird-local` va rifatto il punto 4.

## Uso: prima a secco, poi un pilota

```bash
docker compose exec sellbird python -m sellbird firecrawl status      # acceso/spento, crediti, contatti trovati
docker compose exec sellbird python -m sellbird firecrawl estimate    # le candidate e il costo MASSIMO, senza chiamare nulla
docker compose exec sellbird python -m sellbird firecrawl run --limit 10   # un giro adesso (spende crediti: chiede conferma)
docker compose exec sellbird python -m sellbird firecrawl resume      # dopo uno stop
```

**Pilota consigliato:** `estimate`, poi `run --limit 10` con `FIRECRAWL_ENRICH_DAILY_CREDITS=300`. Leggi **ogni bozza** nell'Outbox
della hub (scheda Email) prima di approvare: il nome è giusto? il ruolo? Si prosegue, e solo allora si mette
`FIRECRAWL_ENRICH=on`, se il tasso di successo e la qualità reggono.

## Prima del primo uso vero

- **Informativa privacy.** Un indirizzo con nome e cognome è un dato personale. L'avviso nel piè di pagina e la sezione
  «Contatti commerciali (B2B)» della pagina `/privacy-policy` devono nominare i fornitori di arricchimento tra i destinatari
  (e gli eventuali trasferimenti fuori dall'UE). Va rivisto da chi segue la parte legale.
- **Dati ridotti al minimo:** nome, ruolo, indirizzo. Non si salva il profilo LinkedIn.

## Costi e limiti, onesti

- Circa **100 crediti per ogni titolare trovato** a listino. Con 1.000 crediti al mese sono circa 10 titolari. Nella prova (5
  aziende) ne ha trovati 3, su concessionari medio-grandi: sui piccoli sarà meno.
- Conviene sulle aziende migliori, non su tutto l'elenco. Sellbird invia comunque al massimo 10 email al giorno.

## Togliere l'estensione

`FIRECRAWL_ENRICH=off` (o commenta la riga) e riavvia: il passo smette di girare. Per rimuoverla del tutto, avvia Sellbird con
`SELLBIRD_IMAGE=sellbird-local`. I contatti già creati restano (`source = firecrawl_anymail`).

## Prove

```bash
python3 -m unittest discover -s scripts/sellbird-firecrawl/tests -t scripts/sellbird-firecrawl
```

37 prove con un database e un Firecrawl finti: nessuna rete, nessun credito. Coprono la scelta delle candidate, il bilancio e la
riserva, gli stop che richiedono una persona, i controlli sul risultato (dominio, casella di ruolo, nome), le difese contro i
doppioni e il fatto che il nostro verificatore possa solo bocciare.
