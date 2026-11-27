// Tipi di attività che producono un contenuto social (carosello, grafica, video, stories…).
// Servono a ricordare, quando un task così si crea a mano, che il suo posto naturale è il Piano editoriale:
// lì il contenuto ha data di uscita, canali e approvazione cliente, e i task di produzione nascono da lui. Pura.

const SOCIAL = /carosell|stor(y|ies)|reel|post\b|social|montaggio video|realizzazione grafica|motion|copertin|editing foto/i;

export function isSocialContentActivity(activityType: string | null | undefined): boolean {
    return !!activityType && SOCIAL.test(activityType);
}
