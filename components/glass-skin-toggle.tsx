'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * La skin vetro e' attiva per tutti: la classe arriva gia' dal server, in
 * app/layout.tsx, cosi' non c'e' nessun lampo dell'aspetto vecchio al
 * caricamento.
 *
 * Questo componente serve all'opposto: spegnerla senza un deploy.
 *   ?glass=0  la disattiva e la scelta resta (localStorage)
 *   ?glass=1  la riattiva
 * E' la via d'uscita se su qualche pagina il vetro da' problemi: chiunque puo'
 * tornare all'Hub di prima da solo, subito.
 */
export default function GlassSkinToggle() {
  const params = useSearchParams();

  useEffect(() => {
    const q = params.get('glass');
    if (q === '0') localStorage.setItem('glass-skin', 'off');
    if (q === '1') localStorage.removeItem('glass-skin');

    const off = localStorage.getItem('glass-skin') === 'off';
    document.body.classList.toggle('glass-skin', !off);
  }, [params]);

  return null;
}
