/** Un indirizzo è un video se l'estensione precede l'eventuale query: i file caricati finiscono con ?alt=media&token=… */
export function isVideoUrl(url: string): boolean {
    return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
}
