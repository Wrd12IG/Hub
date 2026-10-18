/**
 * Se la risposta non è ok, lancia un Error con il messaggio che l'API ha scritto in `error`
 * (es. "Nessuna sede configurata: aggiungila in Setup API"), non un generico "Failed to fetch".
 */
export async function throwIfNotOk(res: Response, fallback: string): Promise<void> {
    if (res.ok) return;
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `${fallback} (${res.status})`);
}
