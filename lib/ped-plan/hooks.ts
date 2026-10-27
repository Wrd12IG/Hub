/**
 * lib/ped-plan/hooks.ts
 *
 * Le 26 formule di aggancio per i Reel della skill ig-reel (hooks.json), adattate all'italiano. Un Reel ha due agganci che
 * partono insieme e non sono la stessa frase: ciò che si dice (≈2 secondi) e ciò che si legge a schermo (≈1 secondo, si
 * legge prima di sentirlo). Ogni formula ha il suo modello, quando conviene e come si rovina.
 */
export interface HookFormula {
    id: number;
    name: string;
    template: string;
    onScreen: string;
    bestFor: string;
    trap: string;
}

export const HOOK_FORMULAS: HookFormula[] = [
    { id: 1, name: 'Il costo di un errore', template: '{Cifra precisa} è quanto mi è costato {un errore}.', onScreen: '18.000 € DI ERRORE', bestFor: 'Fiducia, in fretta: si finiscono i video in cui chi parla fa la figura peggiore.', trap: 'Un costo finto («mi è costato la serenità» non è una cifra).' },
    { id: 2, name: 'Comando negativo', template: 'Smetti di {azione comune}. Fai {alternativa}.', onScreen: 'SMETTILA DI…', bestFor: 'Salvataggi e discussioni: l\'imperativo prende più attenzione di un\'affermazione.', trap: 'Dire di smettere qualcosa che nessuno fa: l\'abitudine va riconosciuta da chi guarda.' },
    { id: 3, name: 'Nessuno te lo dice', template: 'Nessuno ti dice che {verità scomoda su ciò che vogliono}.', onScreen: 'NESSUNO TE LO DICE', bestFor: 'Pubblici nuovi: ti fa dire la cosa che di solito non si dice.', trap: 'Scegliere una verità che dicono tutti: se i commenti sono d\'accordo prima della fine, non era un segreto.' },
    { id: 4, name: 'La sostituzione', template: '{Questa cosa} ha sostituito {cosa costosa} per {prezzo}.', onScreen: '2.000 € → 12 €', bestFor: 'Dimostrazioni e strumenti: il divario di prezzo fa tutto il lavoro.', trap: 'Esagerare la sostituzione: se ha sostituito il 60% del lavoro, dì il 60%.' },
    { id: 5, name: 'Il tempo che crolla', template: 'Prima mi serviva {tanto tempo}. Ora {poco tempo}.', onScreen: '5 ORE → 20 MIN', bestFor: 'Processi in cui il vantaggio è la velocità: si legge subito a schermo.', trap: 'Un rapporto che nessuno crede (da 40 ore a 4 secondi sembra una bugia anche se è vero).' },
    { id: 6, name: 'La ricevuta', template: 'Ho fatto {cosa} per {N giorni}. Ecco i numeri veri.', onScreen: '60 GIORNI. NUMERI VERI.', bestFor: 'Esperimenti: vale se mostri lo schermo con i dati reali.', trap: 'Non mostrare lo schermo: un video di numeri senza registrazione dello schermo è solo un\'affermazione.' },
    { id: 7, name: 'Modo sbagliato, modo giusto', template: 'Stai facendo {cosa} nel modo sbagliato, e non è colpa tua. {La soluzione}.', onScreen: 'LO FAI AL CONTRARIO', bestFor: 'Insegnare: il «non è colpa tua» evita che suoni come un\'offesa.', trap: 'Saltare l\'assoluzione: «lo fai male» da solo fa andare via la gente.' },
    { id: 8, name: 'Da dentro', template: 'Ho passato {N anni} {dentro a questo mondo}. Ecco cosa non dicevamo mai.', onScreen: '6 ANNI DA DENTRO', bestFor: 'Autorevolezza senza diapositiva di titoli: funziona solo se gli anni sono veri.', trap: 'Promettere un segreto e dare la brochure.' },
    { id: 9, name: 'Copialo', template: 'Copia questo {oggetto}. Mi ci sono voluti {tempo} per farlo bene.', onScreen: 'COPIALO', bestFor: 'Salvataggi e invii, le due metriche che spostano di più la portata.', trap: 'L\'oggetto non è a schermo: se non si può fare lo screenshot, non c\'è niente da copiare.' },
    { id: 10, name: 'Se sei così, guarda', template: 'Se {situazione precisa}, questi {pochi secondi} lo risolvono.', onScreen: 'VISUALIZZAZIONI MA NESSUN CONTATTO?', bestFor: 'Selezionare duramente: restano in meno, ma sono quelli che comprano.', trap: 'Una situazione così ampia che non seleziona nessuno («se vuoi crescere» non è una situazione).' },
    { id: 11, name: 'Elenco con preferito', template: '{N} {cose} che {risultato}. La numero {k} è quella che nessuno usa.', onScreen: '5 MODIFICHE. LA #4.', bestFor: 'Tenere dentro la parte centrale: nominare un preferito dà un motivo per restare oltre la terza.', trap: 'Un N sopra il sette: nessuno crede che ne abbiate nove buone.' },
    { id: 12, name: 'L\'obiezione', template: '«{Obiezione che dicono davvero}». Va bene. Ecco la versione che funziona lo stesso.', onScreen: '«NON VOGLIO ESSERE IN VIDEO»', bestFor: 'Vendere a chi ha già detto di no una volta.', trap: 'Inventare l\'obiezione: va presa parola per parola da un messaggio o da un commento.' },
    { id: 13, name: 'Prima e dopo a schermo', template: '{Mostra la cosa vecchia}. {Mostra la nuova}. {Una frase sulla leva}.', onScreen: 'PRIMA / ORA', bestFor: 'Tutto ciò che è visivo: lo stacco fra i due fotogrammi è l\'aggancio.', trap: 'Tre leve: nomina una sola cosa che è cambiata, o la trasformazione non è credibile.' },
    { id: 14, name: 'Il richiamo', template: '{Gruppo preciso}, questa è la cosa che continuate a ignorare.', onScreen: 'CONCESSIONARI SOTTO I 50 AUTO/MESE', bestFor: 'Restringere un pubblico ampio a quello che converte: gli invii salgono perché ci si tagga.', trap: 'Un gruppo troppo grande per essere un richiamo («imprenditori» non è un gruppo).' },
    { id: 15, name: 'Il registro dei flop', template: 'I miei primi {N} {tentativi} non hanno fatto niente. Ecco cosa è cambiato al {N+1}.', onScreen: '47 FLOP, POI QUESTO', bestFor: 'Chi è all\'inizio, cioè la maggior parte del pubblico: tanti commenti.', trap: 'Far sembrare il cambiamento fortuna: se la risposta è «ho avuto fortuna», non c\'è il video.' },
    { id: 16, name: 'La domanda parola per parola', template: '«{Domanda esattamente come è stata fatta}» — me la fanno ogni settimana.', onScreen: 'ME LO CHIEDONO OGNI SETTIMANA', bestFor: 'La ricerca: una domanda scritta come la scrive la gente è ciò che Instagram confronta.', trap: 'Ripulire la domanda: il valore è che sia nelle loro parole, errori compresi.' },
    { id: 17, name: 'Uno contro uno', template: '{A} contro {B}. Li ho provati per {tempo} e uno non c\'era partita.', onScreen: 'A vs B', bestFor: 'Commenti: la gente arriva già con un\'opinione.', trap: 'Rifiutare di scegliere: un confronto a finale diplomatico è un video senza finale.' },
    { id: 18, name: 'Demo a freddo', template: '{Inizia già nel mezzo dell\'azione.} Guarda cosa fa questo.', onScreen: 'GUARDA', bestFor: 'Registrazioni dello schermo e tutto ciò che ha un risultato visibile: nessuna premessa.', trap: 'Un risultato che arriva dopo dodici secondi: taglia direttamente al risultato.' },
    { id: 19, name: 'La scadenza', template: '{Cosa} cambia il {data}. Fai {azione} prima.', onScreen: 'PRIMA DEL {DATA}', bestFor: 'Urgenza vera: cambi di piattaforma, finestre stagionali, scadenze di una promozione.', trap: 'Urgenza fabbricata: una scadenza finta e tutte le prossime perdono valore.' },
    { id: 20, name: 'Il permesso', template: 'Non ti serve {la cosa che tutti dicono che ti serve}.', onScreen: 'NON TI SERVE…', bestFor: 'Sollievo: tantissimi salvataggi, perché toglie un ostacolo invece di aggiungere un compito.', trap: 'Togliere l\'ostacolo e non mettere nulla al suo posto: la seconda metà è tutto il video.' },
    { id: 21, name: 'Partenza a metà frase', template: '…ed è lì che {la svolta}.', onScreen: 'HA CHIESTO IL RIMBORSO', bestFor: 'Storie: partire nel mezzo fa sentire di essere arrivati in ritardo, ed è un motivo per restare.', trap: 'Non colmare mai il vuoto: la premessa va data entro il secondo otto.' },
    { id: 22, name: 'Il ribaltamento', template: '{Detto noto, capovolto.}', onScreen: '…', bestFor: 'Commenti: chi guarda si ferma a controllare se ha sentito bene.', trap: 'Capovolgere un detto che nessuno dice: l\'originale deve essere un riflesso.' },
    { id: 23, name: 'La statistica', template: 'Il {N}% di {gruppo} {fatto sorprendente}.', onScreen: '33% NON LEGGE PIÙ', bestFor: 'Invii: un numero che si può ripetere a cena viene mandato a qualcuno.', trap: 'Una statistica di cui non puoi indicare la fonte: dì da dove viene o non usarla.' },
    { id: 24, name: 'La rivelazione', template: 'Questa è la nuova {cosa}.', onScreen: 'LA NUOVA', bestFor: 'Tutto ciò che è fisico o visivo: l\'oggetto è l\'aggancio e le parole sono didascalie.', trap: 'Mostrare la cosa senza dire cosa cambia: una rivelazione senza posta in gioco è una pubblicità.' },
    { id: 25, name: 'Il risultato di un altro', template: 'C\'è stato un {persona} che {risultato} in {tempo}.', onScreen: '1 MILIONE IN UN MESE', bestFor: 'Prova quando non hai ancora un tuo numero: la terza persona va bene se è vera.', trap: 'Nessun nome e nessun collegamento: un miracolo anonimo è una voce.' },
    { id: 26, name: 'Il superlativo', template: 'Il modo {più veloce / più grande / unico} per {obiettivo} è {la risposta}.', onScreen: 'IL MODO PIÙ VELOCE', bestFor: 'Video con una sola tesi e nessuna storia: la forma più diffusa e più facile da scrivere male.', trap: 'Un superlativo con una risposta debole: se la seconda metà è «la costanza», non hai detto niente.' },
];

export const hookById = (id: number) => HOOK_FORMULAS.find((h) => h.id === id);

/** Elenco compatto per il prompt: id, nome, modello. */
export const hooksForPrompt = () => HOOK_FORMULAS.map((h) => `${h.id} ${h.name}: ${h.template} (a schermo: ${h.onScreen}). Trappola: ${h.trap}`).join('\n');
