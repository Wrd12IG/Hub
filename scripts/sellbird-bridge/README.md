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
  `sending pause|resume`, `discover` (stima e ricerca) e `signals --confirm|--reject` per i soli segnali gratuiti.
  Qualunque altra azione viene rifiutata. Se Sellbird o il ponte sono spenti, la decisione resta
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
4. **Liste fisse.** Provider solo `osm` e `serper`; città solo quelle di `icp.geography`; massimo 5. Niente testo libero.
5. **Una ricerca alla volta**, solo amministratori. Una ricerca vera può durare molti minuti: in quel tempo il ponte non
   sincronizza e la pagina mostra l'avviso «ultima sincronizzazione».

I segnali si attivano o si escludono dalla hub solo se **gratuiti**, con la stessa regola di Sellbird: la nota di costo comincia
con `free` o `included` (non basta contenere la parola). Quelli a pagamento si confermano da Sellbird, dove si vede il costo.

L'esito di ogni richiesta (testo stampato da Sellbird, stima, errori) compare nella scheda «Trova aziende».

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
