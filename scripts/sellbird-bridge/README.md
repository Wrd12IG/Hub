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

- Manda alla hub email in coda e aziende (indirizzi, oggetti, testi delle bozze). Non le risposte né le conversazioni.
- Un'approvazione o un rifiuto dalla hub viene applicata entro un paio di minuti con `sellbird outbox --approve|--reject`.
  Se Sellbird o il ponte sono spenti, la decisione resta in coda e parte quando ripartono.
- Non scrive mai nel database di Sellbird e non invia nulla da sé: l'invio lo fa Sellbird, con i suoi limiti
  giornalieri e le sue pause.
- Se la hub non vede una sincronizzazione da più di 30 minuti, la pagina Outreach lo segnala.

## Sul server (Docker)

Sellbird e il ponte girano come due servizi con `docker-compose.vm.yml` (vedi i commenti nel file).
Il login di Claude (`claude auth login --claudeai`) si fa una volta sul server, non nel contenitore.

Note dal primo avvio su Ubuntu 24.04:

- **`libatomic1`.** Il Dockerfile di Sellbird (`python:3.12-slim`) non lo include e `playwright install` termina con
  codice 127. Va aggiunto ai pacchetti di sistema: `curl ca-certificates libatomic1`. È una modifica al Dockerfile di
  Sellbird fatta sul server: un aggiornamento di Sellbird dal suo repository la sovrascrive, e va rifatta.
- **File `._*`.** Un archivio creato su macOS porta con sé i metadati `._nomefile`. Si cancellano con
  `find ~/sellbird -name '._*' -delete` e si evitano creando l'archivio con `COPYFILE_DISABLE=1 tar ...`.
