/**
 * lib/italy-places.ts
 *
 * Regioni, province e comuni d'Italia per scegliere dove cercare aziende con Discover.
 *
 * I dati sono l'elenco ufficiale dei comuni dell'ISTAT (lib/data/italia-luoghi.json, licenza CC BY 3.0 IT, fonte:
 * ISTAT). Si rigenerano scaricando di nuovo l'«Elenco dei comuni italiani» dal sito dell'ISTAT.
 *
 * Quello che si manda a Sellbird è una stringa nel formato che Sellbird si aspetta per le città, «Comune, SIGLA»
 * (come «Denver, CO»): la sigla distingue i comuni con lo stesso nome (ci sono decine di «San Giovanni»). Per una regione
 * intera è il solo nome, «Lombardia»: vale per i motori di ricerca come Serper, non per OpenStreetMap, che cerca
 * attorno a un punto.
 *
 * Solo lato server: il file pesa 120 KB e il browser non ne ha bisogno, riceve solo la regione che l'utente apre.
 */
import data from './data/italia-luoghi.json';

export interface Province {
    nome: string;
    sigla: string;
    capoluogo: string;
    comuni: string[];
}
export interface Region {
    nome: string;
    province: Province[];
}

const REGIONS_DATA = (data as { regioni: Region[] }).regioni;

export const REGIONS: string[] = REGIONS_DATA.map((r) => r.nome);

export const placeLabel = (comune: string, sigla: string) => `${comune}, ${sigla}`;

export function regionData(name: string): Region | null {
    return REGIONS_DATA.find((r) => r.nome === name) ?? null;
}

let known: Set<string> | null = null;
/** Una regione (es. «Lombardia») o un comune nel formato «Comune, SIGLA» che esiste nell'elenco ISTAT. */
export function isKnownPlace(label: string): boolean {
    if (!known) {
        known = new Set(REGIONS);
        for (const r of REGIONS_DATA) for (const p of r.province) for (const c of p.comuni) known.add(placeLabel(c, p.sigla));
    }
    return known.has(label);
}
