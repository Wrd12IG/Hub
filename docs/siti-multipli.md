# Siti multipli per cliente

Un cliente può avere più siti web (di solito uno per marca), ciascuno con il suo Analytics (GA4) e la sua Search Console.
La logica è in `lib/client-sites.ts`; il perché di ogni scelta sta qui.

## Come funziona

- **I siti stanno alla pari** in `sites[]` sul documento del cliente: `id`, `url`, `brand` (testo libero, facoltativa), `ga4PropertyId`, `searchConsole`.
- **Nessuna migrazione.** Un cliente che non ha mai salvato i siti ne ha uno «virtuale» ricavato dai campi di sempre (`websiteUrl`, `ga4PropertyId`, `windsorAccounts.searchconsole`). Cambia solo quando qualcuno salva i siti.
- **Il primo sito si ricopia nei campi vecchi.** Serve a ciò che lavora su un sito solo (audit SEO, monitor del sito, ricerca dei competitor) e alla scheda «Setup API». Il verso opposto c'è: se «Setup API» cambia GA4 o la Search Console, il primo sito si aggiorna.
- **Si gestisce da «Gestisci siti»**, nella Panoramica del cliente (solo staff): aggiungi, modifica, togli, sposta in su. Il primo è il principale. Al massimo 8 siti.

## Cosa vede chi guarda

- Una scheda «Performance dominio» **per sito**, con la marca accanto all'indirizzo, e una scheda «Ricerca organica» per ogni sito con Search Console.
- Il **filtro per marca** (chip «Tutte le marche · Renault · Dacia») compare solo con almeno 2 siti e almeno una marca. Sceglie quali schede mostrare e non somma nulla: gli utenti unici di due siti non si possono sommare.
- Il cliente (accesso «Cliente») vede le stesse schede e lo stesso filtro, senza i comandi.

## Report e KPI

Il report legge Analytics e Search Console di **tutti** i siti: una voce per sito, con l'etichetta «Marca · indirizzo» (senza etichetta se il sito è uno solo, come prima).

| Valore | Con più siti |
|---|---|
| Sessioni, fatturato, ordini, click da ricerca | **Somma** dei siti |
| Tasso di conversione | **Pesato**: ordini totali / sessioni totali (non la media dei due) |
| **Utenti sito** | **Non si somma**: la stessa persona può comparire in ogni sito. Il KPI mostra «Non si somma tra più siti…» |

Due siti che puntano alla **stessa** proprietà GA4 o Search Console contano una volta sola.
Se un sito non risponde, gli altri restano e il report lo segnala come fonte non letta: il totale è allora parziale.

## Cosa usa ancora solo il primo sito

Audit SEO, monitor del sito, ricerca dei competitor, link pubblico del report e pagina «Dettaglio» di Analytics aperta senza scelta (con `?site=` si apre quella del sito scelto; la Search Console lo fa dalla scheda).
Se servono per ogni sito, vanno resi «per sito» uno alla volta.
