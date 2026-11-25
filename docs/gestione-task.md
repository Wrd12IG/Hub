# Gestione dei task — il metodo

Le regole in codice sono in `lib/task-model.ts` (stati, priorità), `lib/recurring-task.ts` (ricorrenti) e `lib/staff-todo.ts` (cosa va chiuso).
Ogni regola ha il suo perché, in una frase.

## Decisioni prese

| Decisione | Scelta | Perché |
|---|---|---|
| «Annullato» | Fuori dai cinque stati, resta come **archivio** («Archivia — non più necessario») | Il codice lo usa per escludere quei task da ore, costi e statistiche: chiuderli come «Approvato» falserebbe i completati |
| Anticipo dei ricorrenti | Per modello, **«Scade dopo N giorni lavorativi»**, default 0 | Un report si scrive in qualche giorno: con 0 il task nascerebbe già in scadenza |
| Sollecito al cliente | **3 giorni** in «In attesa cliente» | Lo stesso valore delle approvazioni del Piano editoriale |

## Gli stati (cinque)

| Stato | Significa | Di chi è la palla |
|---|---|---|
| Da Fare | Assegnato, non iniziato | Responsabile |
| In Lavorazione | Si lavora, timer acceso | Responsabile |
| In Approvazione | Consegnato, aspetta la revisione interna | PM |
| In attesa cliente | Aspetta approvazione o materiali del cliente | Cliente |
| Approvato | Chiuso | — |

«In attesa cliente» è il valore `In Approvazione Cliente` del database: cambia solo come si legge.
Un task in quello stato non genera solleciti di scadenza (la palla non è nostra).
Un task rifiutato torna a «In Lavorazione» con il motivo.

## Le priorità (quattro)

| Priorità | Quando |
|---|---|
| Critica | Qualcosa è fermo ora (campagna, sito, tracciamento, spesa che brucia). Si fa oggi; al massimo 2 a persona |
| Alta | Scade entro 3 giorni lavorativi, oppure incide sui risultati del cliente questa settimana |
| Media | Lavoro pianificato. È il valore normale, anche per i ricorrenti |
| Bassa | Utile ma senza una scadenza vera: si fa nei buchi |

## Cosa si compila

Titolo, cliente, responsabile (una persona), scadenza, priorità (default Media), tipo attività, stima (**in minuti**).
La descrizione dice in una riga che cosa vuol dire «fatto». Gli allegati servono per passare a «In Approvazione».

Titolo: verbo + oggetto (+ periodo se ricorrente), **senza il nome del cliente** (c'è già il campo).

## Task ricorrenti

Un modello per ogni coppia **cliente × attività**, così se ne spegne uno alla volta (Admin → Task Ricorrenti).

Segnaposto nel titolo, risolti il giorno in cui il task nasce:

| Segnaposto | Esempio |
|---|---|
| `{mese}` · `{periodo}` | novembre · novembre 2026 |
| `{anno}` | 2026 |
| `{trimestre}` | T4 2026 |
| `{settimana}` | sett. 48 |

Con uno scarto: `{periodo-1}` è il mese scorso, `{periodo+1}` il prossimo.
**Un report si scrive dopo il mese**: creato il 3 dicembre, «Report mensile – {periodo-1}» dice novembre.

Esempio (clienti A e B sono d'esempio, non i vostri nomi):

| Cliente | Titolo | Nasce | Scade dopo |
|---|---|---|---|
| A | Ottimizzare campagne – {settimana} | Ogni lunedì | 4 giorni |
| A | Report mensile – {periodo-1} | Giorno 3 | 2 giorni |
| A | Piano editoriale – {periodo+1} | Giorno 15 | 5 giorni |
| A | Audit account – {trimestre} | Giorno 1, ogni 3 mesi | 5 giorni |
| B (concessionario) | Controllare dati reali – {periodo-1} | Giorno 2 | 2 giorni |
| B | Ottimizzare campagne – {settimana} | Ogni lunedì | 4 giorni |
| B | Monitor sito e audit SEO – {periodo-1} | Giorno 10 | 3 giorni |

I giorni lavorativi sono lunedì-venerdì: le festività non si conoscono.
Se il giorno del mese cade di sabato, il task nasce il lunedì (già oggi).

## Cosa si guarda al mattino

Nel riquadro «Da chiudere» della dashboard e nel digest delle 06:00 UTC:

| Voce | Chi la guarda | Perché |
|---|---|---|
| Task critici in ritardo | Tutti | Sono i soli che non possono aspettare |
| Task fermi dal cliente (3+ giorni) | PM | Da sollecitare |
| Scaduti, critici per primi | PM | Per spostare il carico prima che sia tardi |
| Brief da valutare, modifiche chieste dal cliente, approvazioni ferme | PM | Vedi `docs/ruoli.md` |
