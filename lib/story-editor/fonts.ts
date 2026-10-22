/**
 * lib/story-editor/fonts.ts
 *
 * I caratteri dell'editor. Si caricano da Google Fonts (la politica di sicurezza del Hub lo consente per stili e file dei
 * caratteri) e il disegno aspetta che siano pronti, altrimenti la tela userebbe un carattere di ripiego.
 */
export const STORY_FONTS = [
    'Montserrat', 'Poppins', 'Inter', 'Playfair Display', 'Oswald', 'Bebas Neue', 'Anton', 'Pacifico', 'Lobster', 'Caveat', 'Roboto Slab', 'Space Grotesk',
] as const;

/** Gli assi che ogni carattere offre davvero su Google Fonts: chiederne uno che manca fa rifiutare tutta la richiesta. */
const AXES: Record<(typeof STORY_FONTS)[number], string> = {
    Montserrat: ':ital,wght@0,400;0,700;1,400;1,700',
    Poppins: ':ital,wght@0,400;0,700;1,400;1,700',
    'Playfair Display': ':ital,wght@0,400;0,700;1,400;1,700',
    Inter: ':wght@400;700',
    Oswald: ':wght@400;700',
    'Roboto Slab': ':wght@400;700',
    'Space Grotesk': ':wght@400;700',
    Caveat: ':wght@400;700',
    'Bebas Neue': '',
    Anton: '',
    Pacifico: '',
    Lobster: '',
};

export function fontsStylesheetUrl(): string {
    const families = STORY_FONTS.map((f) => `family=${f.replace(/ /g, '+')}${AXES[f]}`).join('&');
    return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
