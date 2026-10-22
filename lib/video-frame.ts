/**
 * lib/video-frame.ts
 *
 * Estrae un fotogramma da un video LOCALE (il file appena scelto) e lo restituisce come JPEG, da usare come copertina.
 * Solo nel browser. Legge il file dal computer, non da Internet: non dipende da come il browser disegna il video remoto.
 * Se il browser non sa decodificare il file (per esempio un .mov HEVC in Chrome) restituisce null e basta: la copertina
 * resta facoltativa e si può caricare a mano.
 */

/** Istante da cui prendere il fotogramma: poco dopo l'inizio, mai oltre un decimo della durata (i video brevi non finiscono). */
export function pickFrameTime(duration: number): number {
    if (!isFinite(duration) || duration <= 0) return 0;
    return Math.min(0.5, duration / 10);
}

export async function extractVideoFrame(file: File, maxWidth = 1080): Promise<Blob | null> {
    if (typeof document === 'undefined') return null;
    const url = URL.createObjectURL(file);
    try {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.src = url;

        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('timeout')), 15000);
            video.onloadedmetadata = () => {
                video.currentTime = pickFrameTime(video.duration);
            };
            video.onseeked = () => { clearTimeout(timer); resolve(); };
            video.onerror = () => { clearTimeout(timer); reject(new Error('decode')); };
        });

        if (!video.videoWidth || !video.videoHeight) return null;
        const scale = Math.min(1, maxWidth / video.videoWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    } catch {
        return null;
    } finally {
        URL.revokeObjectURL(url);
    }
}
