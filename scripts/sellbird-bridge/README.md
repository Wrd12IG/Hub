# Ponte Sellbird ↔ hub

Fa comparire in hub (pagina **Outreach**, solo amministratori) le email preparate da Sellbird e permette di
approvarle o rifiutarle da lì. Gira sul computer dove gira Sellbird. Come funziona: vedi `lib/outreach.ts`.

## Messa in funzione

1. Sulla hub (Vercel → Environment Variables) aggiungi `OUTREACH_BRIDGE_SECRET` con `openssl rand -hex 32`
   e rifai il deploy.
2. Sul computer di Sellbird, in un terminale:

```bash
export SELLBIRD_DIR="/percorso/di/sellbird"          # la cartella con data/sellbird.db e .venv
export HUB_URL="https://indirizzo-della-hub"
export OUTREACH_BRIDGE_SECRET="lo stesso valore della hub"
python3 scripts/sellbird-bridge/bridge.py --once       # prova: un solo giro
python3 scripts/sellbird-bridge/bridge.py              # in continuo (ogni 2 minuti)
```

Il segreto non va scritto in nessun file del repository.

## Cosa fa e cosa no

- Manda alla hub, ogni 2 minuti: email in coda, aziende, **contatti** (nome, ruolo, indirizzo e se è verificato),
  **risposte** dei destinatari (gli ultimi messaggi di ogni conversazione), **campagne**, catalogo dei **segnali**,
  contatori della pipeline, uso di Claude degli ultimi 7 giorni e stato della pausa degli invii.
- Le liste lunghe vanno **a differenza**: solo le righe cambiate dall'ultima volta, e tutto una volta all'ora. Lo stato
  del ponte sta in `data/bridge-state.json` (se manca o è rovinato, il giro dopo rimanda tutto). Senza questo, ogni
  giro riscriverebbe ogni documento su Firestore: migliaia di scritture al giorno per niente.
  Sono dati di terze persone: stanno in collezioni `outreach*` chiuse al browser (vedi `firestore.rules`) e li legge
  solo la pagina Outreach, riservata agli amministratori.
- Applica le decisioni prese dalla hub con la CLI di Sellbird, da una lista fissa: `outbox --approve|--reject <id>`,
  `sending pause|resume`, `discover` (stima e ricerca), `signals --confirm|--reject` per i soli segnali gratuiti, e
  l'**esclusione di un'azienda** («mai contattare»). Qualunque altra azione viene rifiutata. Se Sellbird o il ponte sono spenti, la decisione resta
  in coda e parte quando ripartono.
- Non scrive mai nel database di Sellbird e non invia nulla da sé: l'invio lo fa Sellbird, con i suoi limiti
  giornalieri e le sue pause.
- Se la hub non vede una sincronizzazione da più di 30 minuti, la pagina Outreach lo segnala.
- Non porta nella hub: addestramento, riscaldamento della casella, impostazioni e i segnali che costano crediti.
  Restano nella dashboard di Sellbird, raggiungibile dal server con un tunnel SSH.

### Trova aziende (Discover) dalla hub: come è protetta la spesa

Discover è l'unica azione che spende. Dalla hub si fa in due passi e con più difese, ognuna indipendente dalle altre:

1. **Stima prima.** «Stima il costo» lancia `sellbird discover --estimate` (gratis). «Esegui» si attiva solo dopo una stima
   riuscita per la stessa scelta, valida 30 minuti e **una sola volta**: un doppio clic non spende due volte.
2. **Tetto calcolato dal server**, non dalla pagina: la stima più un quarto, mai oltre 2 $. Il client non lo sceglie.
3. **Tetto del ponte**, indipendente dalla hub: `OUTREACH_MAX_DISCOVER_SPEND` in `bridge.env` (default e massimo 2 $,
   `0` spegne Discover dalla hub). Una richiesta oltre il tetto non arriva nemmeno a Sellbird.
4. **Liste fisse.** Provider solo `osm` e `serper`; luoghi solo dall'elenco ISTAT (20 regioni e 7.896 comuni, nel formato
   «Comune, SIGLA», es. «Monza, MB») oppure le città di `icp.geography`; massimo 10. Niente testo libero. La hub controlla
   l'elenco; il ponte controlla formato e numero, e per la spesa conta il tetto, che vale qualunque luogo si chieda.
   Una regione intera («Lombardia») vale per Serper; OpenStreetMap cerca attorno a un punto, quindi per lui si scelgono i comuni.
5. **Una ricerca alla volta**, solo amministratori. Una ricerca vera può durare molti minuti: in quel tempo il ponte non
   sincronizza e la pagina mostra l'avviso «ultima sincronizzazione».

I segnali si attivano o si escludono dalla hub solo se **gratuiti**, con la stessa regola di Sellbird: la nota di costo comincia
con `free` o `included` (non basta contenere la parola). Quelli a pagamento si confermano da Sellbird, dove si vede il costo.

L'esito di ogni richiesta (testo stampato da Sellbird, stima, errori) compare nella scheda «Trova aziende».

### Escludere un'azienda («mai contattare») dalla hub

Nella scheda Email, tabella «Aziende trovate», **Escludi** mette il dominio dell'azienda in `compliance.do_not_contact` di Sellbird;
**Riammetti** lo toglie. Per Sellbird un dominio in lista non riceve più nulla (nemmeno le email già approvate: il controllo scatta
all'invio), il punteggio va a zero e l'estensione Firecrawl lo salta senza spendere crediti. Sellbird rilegge la lista dal file mentre
gira: non serve riavviare. Un dominio copre anche i suoi sottodomini.

Il ponte modifica il **file di configurazione** di Sellbird (`sellbird.local.yaml`, o `sellbird.yaml` se non c'è): con la libreria
`yaml` che c'è nel contenitore, **copia di sicurezza** in `<file>.bak-dnc` (una sola, si riscrive a ogni modifica), **scrittura atomica**
(Sellbird non vede mai il file a metà) e **verifica**: se dopo la scrittura il dominio non è come deve, rimette la copia. Dominio
controllato con lo stesso schema della hub; solo un dominio che Sellbird ha trovato si può escludere dalla hub, e si può riammettere
solo uno che è davvero in lista.

Con **Escludi** il ponte rifiuta anche le bozze ancora in coda (da rivedere o approvate, al massimo 60) delle aziende di quel dominio e
dei suoi sottodomini, con `sellbird outbox --reject`: non partirebbero comunque, ma resterebbero visibili e approvabili.
**Riammetti** non le riporta: vanno riscritte.

Per tornare indietro a mano: `cp ~/sellbird/sellbird.local.yaml.bak-dnc ~/sellbird/sellbird.local.yaml`.

### Scegliere i settori: una modifica a Sellbird sul server

Sellbird cerca i settori del profilo (`icp.industries`) e il suo comando `discover` non ha un'opzione per cambiarli. Per sceglierli dalla
hub serve l'opzione `--industry`, che **non è nella versione originale**: è il file `sellbird-industry-option.patch` (8 righe in `sellbird/cli.py`).
La scelta vale per quella ricerca soltanto, in memoria: il file di configurazione non cambia.

Sul server, con il file accanto a `bridge.py`:

```bash
cd ~/sellbird && patch -p1 --dry-run < bridge/sellbird-industry-option.patch && patch -p1 < bridge/sellbird-industry-option.patch
```

Il primo `patch` è una prova a secco: se non stampa errori il secondo applica. Non serve riavviare nulla: il ponte lancia Sellbird a ogni
richiesta. Per togliere la modifica: `patch -R -p1 < bridge/sellbird-industry-option.patch`. Un aggiornamento di Sellbird la sovrascrive e va
riapplicata (come la riga `libatomic1` del Dockerfile). Finché non c'è, il ponte lo sa (chiede a Sellbird `discover --help`), la scheda dice
cosa fare e la ricerca con i settori del profilo funziona come prima.

I settori sono un elenco fisso (`lib/outreach-sectors.ts`: Automotive e altri settori, fino a 5 per ricerca) più quelli del profilo. Vale la
stessa difesa sulla spesa: stima prima, tetto di 2 $. **Attenzione:** le aziende di un altro settore entrano nell'elenco ma il profilo resta
sui concessionari (il settore giusto vale 20 punti su 100), e l'offerta e il testo di prodotto sono scritti per i concessionari.

Prove: `python3 -m unittest scripts/sellbird-bridge/test_bridge.py` (database inventato, nessuna rete).

## Sul server (Docker)

Sellbird e il ponte girano come due servizi con `docker-compose.vm.yml` (vedi i commenti nel file).
Il login di Claude (`claude auth login --claudeai`) si fa una volta sul server, non nel contenitore.

Note dal primo avvio su Ubuntu 24.04:

- **`libatomic1`.** Il Dockerfile di Sellbird (`python:3.12-slim`) non lo include e `playwright install` termina con
  codice 127. Va aggiunto ai pacchetti di sistema: `curl ca-certificates libatomic1`. È una modifica al Dockerfile di
  Sellbird fatta sul server: un aggiornamento di Sellbird dal suo repository la sovrascrive, e va rifatta.
- **File `._*`.** Un archivio creato su macOS porta con sé i metadati `._nomefile`. Si cancellano con
  `find ~/sellbird -name '._*' -delete` e si evitano creando l'archivio con `COPYFILE_DISABLE=1 tar ...`.
