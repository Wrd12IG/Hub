import { useEffect, useState } from 'react';

/**
 * Hook per rilevare il Konami Code: ↑↑↓↓←→←→BA
 * Ritorna true quando il codice viene inserito correttamente
 */
export function useKonamiCode(): boolean {
    const [activated, setActivated] = useState(false);

    useEffect(() => {
        // Sequenza Konami Code
        const konamiCode = [
            'ArrowUp',
            'ArrowUp',
            'ArrowDown',
            'ArrowDown',
            'ArrowLeft',
            'ArrowRight',
            'ArrowLeft',
            'ArrowRight',
            'KeyB',
            'KeyA'
        ];

        let currentPosition = 0;
        let resetTimeout: NodeJS.Timeout;

        const handleKeyDown = (event: KeyboardEvent) => {
            // Ignora se l'utente sta scrivendo in un input
            if (
                event.target instanceof HTMLInputElement ||
                event.target instanceof HTMLTextAreaElement
            ) {
                return;
            }

            const key = event.code;

            // Controlla se il tasto premuto corrisponde alla sequenza
            if (key === konamiCode[currentPosition]) {
                currentPosition++;

                // Reset timeout se l'utente impiega troppo tempo
                clearTimeout(resetTimeout);
                resetTimeout = setTimeout(() => {
                    currentPosition = 0;
                }, 3000);

                // Codice completato!
                if (currentPosition === konamiCode.length) {
                    setActivated(true);
                    currentPosition = 0;
                    clearTimeout(resetTimeout);

                    // Reset automatico dello stato interno per permettere future riattivazioni
                    // e prevenire loop infiniti con il toggle
                    setTimeout(() => setActivated(false), 2000);

                    // Feedback audio (se disponibile)
                    try {
                        const audio = new Audio('/sounds/konami-activated.mp3');
                        audio.volume = 0.3;
                        audio.play().catch(() => {
                            // Ignora errori audio
                        });
                    } catch (e) {
                        // Audio non disponibile
                    }
                }
            } else {
                // Tasto sbagliato, reset
                currentPosition = 0;
                clearTimeout(resetTimeout);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            clearTimeout(resetTimeout);
        };
    }, []);

    return activated;
}

/**
 * Hook alternativo che permette di disattivare la modalità
 */
export function useKonamiCodeToggle(): [boolean, () => void] {
    const [activated, setActivated] = useState(false);
    const konamiActivated = useKonamiCode();

    useEffect(() => {
        if (konamiActivated && !activated) {
            setActivated(true);
        }
    }, [konamiActivated, activated]);

    const toggle = () => setActivated(!activated);

    return [activated, toggle];
}
