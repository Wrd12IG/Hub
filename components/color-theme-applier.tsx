'use client';

import { useEffect } from 'react';

const COLOR_THEME_CLASSES = ['theme-default', 'theme-ocean', 'theme-mountain', 'theme-desert', 'theme-ice', 'theme-pink', 'theme-yellow', 'theme-juventus', 'theme-glass', 'theme-audi', 'theme-love'];

/**
 * Componente che applica il tema colore salvato al caricamento della pagina.
 * Deve essere incluso nel layout o nei providers per garantire
 * che il tema venga applicato prima del render dei componenti.
 */
export function ColorThemeApplier() {
    useEffect(() => {
        // Applica il tema colore salvato in localStorage
        const savedColor = localStorage.getItem('color-theme');

        if (savedColor && savedColor !== 'default') {
            const root = document.documentElement;

            // Rimuove tutte le classi di tema colore
            COLOR_THEME_CLASSES.forEach(themeClass => {
                root.classList.remove(themeClass);
            });

            // Applica il tema salvato
            root.classList.add(`theme-${savedColor}`);
        }
    }, []);

    // Questo componente non renderizza nulla
    return null;
}
