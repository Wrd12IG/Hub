# Ruoli dell'Hub — definizione

Stato: **lista delle mansioni confermata**. Il modello è in `lib/roles.ts` (passo R1, non ancora collegato a nessuna pagina). Restano aperte le decisioni 2-4 qui sotto: per 2 e 3 il codice parte dai consigli.

## Le scelte di base

| Tema | Scelta |
|---|---|
| Struttura | **Ruoli per mansione**: ogni figura ha il suo ruolo e i suoi permessi |
| Chi vede quali clienti | **Solo i clienti assegnati** (responsabile, social manager, PM di backup). L'Amministratore vede tutto |
| Accesso del cliente | **Più utenti, due livelli**: *referente* (approva e invia brief) e *lettore* (solo risultati) |
| Dati economici | **Solo Amministratore**, più una spunta per ruolo («Visualizza Budget e Costi»), applicata anche dal database |

## Come sono fatti i ruoli

Un ruolo è un **elenco di capacità** (cosa si può fare) più una **regola di visibilità** (su quali clienti). Le due cose sono separate:

- le *capacità* dicono «può modificare il piano editoriale»;
- la *visibilità* dice «ma solo dei clienti che ha in carico».

Tre ruoli sono **di sistema** e non si modificano: Amministratore, Cliente referente, Cliente lettore.
Gli altri sono **mansioni** e si regolano da Admin → Ruoli.

## Le mansioni

| Ruolo | Che cosa fa | Note |
|---|---|---|
| **Amministratore** (sistema) | Tutto, su tutti i clienti | Unico ruolo che gestisce utenti, ruoli e impostazioni |
| **Project Manager** | Coordina i clienti che ha in carico: assegna e approva task, porta avanti i brief, chiede l'approvazione ai clienti | Esiste già |
| **Social Media Manager** | Piano editoriale, generazione con AI, pubblicazione, account social | Nominato nel codice |
| **Grafico / Designer** | Materiali e media del piano, Creative Lab, storie | «grafico» compare 33 volte nel codice |
| **Copywriter** | Testi del piano editoriale e delle strategie social | Nominato nel codice |
| **Ads Specialist** | Campagne Meta e Google Ads, automazioni, report delle campagne | Da confermare |
| **Collaboratore** | Ruolo generico di oggi, per chi non ha una mansione precisa | Resta, così nessuno perde l'accesso |
| **Cliente referente** (sistema) | Vede i risultati, approva i contenuti, invia brief | È l'accesso «Cliente» di oggi |
| **Cliente lettore** (sistema) | Vede solo i risultati | Nuovo |

## Cosa può fare ciascuno

● = sì · ○ = solo in lettura o in parte (vedi nota) · – = no.
Tutto vale **solo sui clienti assegnati**, salvo l'Amministratore.

| Capacità | Admin | PM | Social | Grafico | Copy | Ads | Collab. |
|---|---|---|---|---|---|---|---|
| Vedere i risultati dei clienti assegnati | ● | ● | ● | ● | ● | ● | ● |
| Task: vedere quelli dei clienti assegnati | ● | ● | ○ ¹ | ○ ¹ | ○ ¹ | ○ ¹ | ○ ¹ |
| Task: creare e assegnare | ● | ● | ○ ² | ○ ² | ○ ² | ○ ² | ○ ² |
| Task: approvare i completati | ● | ● | – | – | – | – | – |
| Brief: vedere | ● | ● | ● | ○ ³ | ○ ³ | ○ ³ | ○ ³ |
| Brief: cambiare stato, creare il progetto | ● | ● | – | – | – | – | – |
| Piano editoriale: vedere | ● | ● | ● | ● | ● | ● | ● |
| Piano editoriale: modificare i contenuti | ● | ● | ● | ○ ⁴ | ○ ⁴ | – | ○ ⁴ |
| Piano editoriale: generare con AI, importare | ● | ● | ● | – | ● | – | – |
| Piano editoriale: chiedere l'approvazione al cliente | ● | ● | ● | – | – | – | – |
| Pubblicare e collegare gli account social | ● | ● | ● | – | – | – | – |
| Campagne Ads: vedere | ● | ● | ○ | – | – | ● | – |
| Campagne Ads: creare, modificare, automazioni | ● | ○ ⁵ | – | – | – | ● | – |
| Report: ore e costi propri | ● | ● | ● | ● | ● | ● | ● |
| Report: ore del team (clienti assegnati) | ● | ● | – | – | – | – | – |
| Report clienti (Andamento, KPI concessionari, Mail mensile) | ● | ○ ⁶ | – | – | – | – | – |
| Budget, costi, redditività | ● | ⚙ | ⚙ | ⚙ | ⚙ | ⚙ | ⚙ |
| Utenti, ruoli, permessi, impostazioni | ● | – | – | – | – | – | – |
| Chat, calendario, assenze | ● | ● | ● | ● | ● | ● | ● |

⚙ = spunta «Visualizza Budget e Costi», dell'Amministratore, per ruolo.

1. Solo quelli assegnati a loro, come oggi per il Collaboratore.
2. Possono creare task per sé; l'assegnazione ad altri spetta al PM.
3. Solo i brief collegati a un loro task.
4. Il Grafico solo i media; il Copywriter solo i testi; il Collaboratore solo i contenuti assegnati a lui.
5. Vede le campagne e può approvare le proposte dell'Ads Specialist, ma non le crea.
6. Solo i suoi clienti.

**Approvare un post senza passare dal cliente** non è di nessun ruolo: resta l'interruttore personale `canSkipClientApproval`, come oggi.

## I due livelli del cliente

| | Referente | Lettore |
|---|---|---|
| Risultati del periodo, audit del sito | ● | ● |
| Approvare o rimandare i contenuti del piano | ● | – |
| Inviare brief e seguirne lo stato | ● | – |
| Ricevere gli avvisi (da approvare, consegnato) | ● | – |

Gli utenti cliente già esistenti diventano **referenti**, così oggi non cambia nulla per loro.

## Decisioni ancora aperte

1. ~~La lista delle mansioni è giusta?~~ **Confermata.**
2. **Una persona può avere due mansioni?** *Il codice già lo prevede (`extraRoles`), come da consiglio — da confermare.* Consiglio di sì: un ruolo principale più eventuali ruoli aggiuntivi, con le capacità sommate. Altrimenti in un'agenzia piccola si creano ruoli doppi come «Grafico + Social».
3. **Il Collaboratore generico resta?** *Resta nel codice, come da consiglio — da confermare.* Consiglio di sì, almeno finché tutti non hanno una mansione.
4. **Chi può creare un utente cliente?** Oggi solo l'Amministratore. Il referente potrà invitare i colleghi come lettori?

## Come si realizza (in ordine)

| Passo | Cosa | Rischio |
|---|---|---|
| R1 ✅ | Modello dei ruoli in un solo file, `can(utente, capacità, cliente)`, con test. Un ruolo sconosciuto **non ha accesso** — fatto: `lib/roles.ts`, con un test che confronta il codice con la tabella qui sopra | Basso |
| R2 | Verifica in sola lettura degli utenti esistenti: chi ha un ruolo fuori dall'elenco, chi non ha ruolo | Basso, ma serve il tuo permesso: sono dati personali |
| R3 | Le API usano `can()` al posto di «chiunque non sia Cliente» | Medio |
| R4 | Regole del database: il cliente non legge più task, progetti e contratti da browser; l'elenco utenti non è più leggibile da tutti. Va fatto insieme al caricamento dati del layout | **Alto**: va provato con un account per ruolo |
| R5 | Schermata Admin → Ruoli e scelta del ruolo nel form utente, con clienti assegnati | Medio |
| R6 | Prova con un account per ogni ruolo, seguendo la tabella qui sopra | — |

R1 e R2 non cambiano nulla per nessuno e si possono fare subito. R3 e R4 vanno rilasciati solo dopo R6.
