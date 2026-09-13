/**
 * lib/google-private-key.ts
 *
 * Un solo posto dove le chiavi private dei service account Google vengono
 * normalizzate e validate. Le usano GA4, Search Console e Firebase Admin, e
 * tutte e tre fallivano allo stesso modo e con lo stesso messaggio illeggibile.
 */

import { createPrivateKey } from 'node:crypto';

/**
 * Ricostruisce la chiave privata a partire da com'è finita nell'ambiente.
 *
 * Un campo `private_key` copiato da un JSON di service account arriva rotto in
 * parecchi modi diversi, e ognuno produce lo stesso identico
 * `error:1E08010C:DECODER routines::unsupported` — un messaggio che non dice
 * né quale credenziale né cosa correggere. Casi visti davvero:
 *
 *   - virgolette esterne copiate insieme al valore
 *   - `\n` rimasti testuali invece di essere ritorni a capo
 *   - tutti i ritorni a capo trasformati in spazi da un copia-incolla
 *   - header e footer presenti ma corpo base64 su una riga sola
 *
 * Invece di indovinare quale sia, il corpo base64 viene estratto, ripulito da
 * ogni spaziatura e riavvolto a 64 caratteri per riga: il formato PEM che
 * OpenSSL si aspetta. Il risultato viene poi **davvero parsato** con
 * crypto.createPrivateKey, così l'errore lo scopriamo qui con un messaggio
 * utile e non dentro una chiamata gRPC a Google.
 */
export function readPrivateKey(envVar: string): string {
  const raw = process.env[envVar];
  if (!raw) return '';

  const cleaned = raw.trim().replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');

  const match = /-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/.exec(cleaned);
  if (!match) {
    throw new Error(
      `${envVar} non contiene una chiave PEM: deve includere `
      + '"-----BEGIN PRIVATE KEY-----" e "-----END PRIVATE KEY-----". Ricopia il campo '
      + 'private_key dal JSON del service account, senza le virgolette esterne.'
    );
  }

  const label = match[1];
  const body = match[2].replace(/\s+/g, '');
  const wrapped = body.match(/.{1,64}/g)?.join('\n') ?? '';
  const pem = `-----BEGIN ${label}-----\n${wrapped}\n-----END ${label}-----\n`;

  try {
    createPrivateKey(pem);
  } catch (err: any) {
    throw new Error(
      `${envVar} non è leggibile come chiave privata `
      + `(${err.message}). Il valore sembra troncato o alterato: rigenera una chiave dal `
      + 'JSON del service account e reincolla il campo private_key per intero.'
    );
  }
  return pem;
}
