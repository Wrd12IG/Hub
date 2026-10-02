'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * La skin vetro e' SPENTA per tutti: la classe non arriva piu' dal server.
 * Era accesa di default, ma sulle pagine diverse dalla dashboard dava
 * problemi, quindi e' tornata opt-in finche' non e' sistemata.
 *   ?glass=1  la accende su questo browser e la scelta resta (localStorage)
 *   ?glass=0  la rispegne
 */
export default function GlassSkinToggle() {
  const params = useSearchParams();

  useEffect(() => {
    const q = params.get('glass');
    if (q === '1') localStorage.setItem('glass-skin', 'on');
    if (q === '0') localStorage.removeItem('glass-skin');

    const on = localStorage.getItem('glass-skin') === 'on';
    document.body.classList.toggle('glass-skin', on);
  }, [params]);

  return null;
}
