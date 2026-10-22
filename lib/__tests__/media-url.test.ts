import { describe, it, expect } from 'vitest';
import { isVideoUrl } from '../media-url';

describe('isVideoUrl', () => {
    it('estensione semplice', () => expect(isVideoUrl('https://x/a.mp4')).toBe(true));
    it('file caricato con query di Firebase Storage', () => expect(isVideoUrl('https://firebasestorage.googleapis.com/v0/b/x/o/editorial-plan%2Fvideos%2Fclip.mov?alt=media&token=abc')).toBe(true));
    it('immagine non è video', () => expect(isVideoUrl('https://x/a.jpg?alt=media&token=abc')).toBe(false));
    it('nome che contiene mp4 ma non come estensione', () => expect(isVideoUrl('https://x/mp4-guide.png')).toBe(false));
});
