import DOMPurify from 'dompurify';

/**
 * Sanifica HTML scritto da utenti (es. descrizione dei task) prima di
 * inserirlo con dangerouslySetInnerHTML. Senza, un utente che può modificare
 * un task (anche un Cliente sui task del proprio cliente) potrebbe eseguire
 * script nel browser dello staff e leggerne il token da localStorage.
 *
 * Lato server (nessun DOM) non c'è sanificatore disponibile: si restituisce
 * il testo con i caratteri HTML escapati, mai l'HTML grezzo.
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') {
    return html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
