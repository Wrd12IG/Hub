# Regole del Writer di Sellbird in italiano

`email_rules.md` sostituisce le istruzioni predefinite del Writer, che sono in inglese con esempi inglesi e regole come «30-50 parole»
e «oggetto in minuscolo»: tradotte in italiano danno email rigide e oggetti frammentati. Le regole nuove sono in italiano, con registro,
struttura, lunghezza, oggetto, nome dell'azienda, onestà, parole vietate ed esempi.

Sellbird le supporta di serie (`writer.email_rules`, vedi `docs/skills-and-agents.md` di Sellbird): non serve nessuna modifica al suo codice.
Restano valide le regole nel codice (niente trattini tra le parole, niente punti esclamativi, una sola domanda, niente formule da IA, al
massimo 220 parole e un link), la regola «niente inventato» e la lista «mai contattare». Gli esempi del file sono stati provati contro i
controlli di stile di Sellbird (`style_problems`): nessun problema.

## Cosa cambia nelle email

| Prima | Dopo |
|---|---|
| Osservazione sul sito web (schema.org, sitemap) che non c'entra con un audit di Google Ads | Nessuna osservazione sul sito: una cosa vera per il tipo di concessionaria, o un dato nei fatti |
| «Ciao team Auto Usate e KM0 in provincia di Milano» (il titolo di una pagina) | Nome breve o dal dominio, oppure nessun nome |
| «Buongiorno» poi «Ciao team» | Lo stesso registro in tutta la sequenza: **Lei** con un nome, **voi** con una casella |
| Oggetti in minuscolo e frammentati («chiamate tracciate») | Oggetto chiaro, maiuscola iniziale, da 4 a 8 parole |
| Email 2 e 3 con vanti generici («siamo certificati…») | Email 2: una domanda facile («chi segue oggi le campagne?»). Email 3: chiusura senza fretta |
| Promessa vaga o consigli non richiesti («aggiungerei…») | Proposta morbida, una sola domanda, nessuna promessa di risultati |

## Installazione sulla VM

1. Copia `email_rules.md` in `~/sellbird/skills/email_rules.md` (il file `skills/` di Sellbird non va in Git).
2. Imposta la configurazione (con copia di sicurezza). Questo comando gira dentro il contenitore, dove c'è `yaml`:
   ```bash
   cd ~/sellbird && cp sellbird.local.yaml sellbird.local.yaml.bak-writer && docker compose exec -T sellbird python - <<'PY'
   import yaml
   p = '/app/sellbird.local.yaml'
   cfg = yaml.safe_load(open(p, encoding='utf-8'))
   w = cfg.setdefault('writer', {})
   w['email_rules'] = 'skills/email_rules.md'
   w['site_facts'] = False
   yaml.safe_dump(cfg, open(p, 'w', encoding='utf-8'), allow_unicode=True, sort_keys=False, width=100)
   print('ok:', w)
   PY
   ```
   `site_facts: false` impedisce al Writer di usare ciò che Sellbird legge in automatico dal sito (dati strutturati, mappa del sito): con
   un'offerta che riguarda solo Google Ads quelle osservazioni erano fuori tema e a volte sbagliate.
3. Riavvia e controlla il registro: se il file mancasse, fosse vuoto o oltre 20.000 caratteri, il Writer si fermerebbe con un messaggio.
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.vm.yml restart sellbird && sleep 20 && docker compose logs --tail 15 sellbird
   ```
4. Per tornare indietro: `cp sellbird.local.yaml.bak-writer sellbird.local.yaml` e riavvia.

## Le bozze già in coda non cambiano

Le regole valgono per le email scritte **da ora**. Le bozze già nell'Outbox restano com'erano. Per riscriverle bisogna rifiutarle e rimettere
il contatto «da scrivere» (stato `new`): è un intervento sul database della VM, da fare insieme e con calma, non di corsa. Intanto, le
bozze delle aziende fuori settore (camper, software) vanno rifiutate comunque.
