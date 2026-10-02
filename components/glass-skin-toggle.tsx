'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Prova della skin vetro sull'app vera.
 * ?glass=1 l'accende, ?glass=0 la spegne. La scelta resta per la sessione del
 * browser, cosi' si puo' navigare fra le pagine e guardare i menu' senza
 * riscrivere il parametro ogni volta. Senza parametro e senza sessione attiva
 * non fa assolutamente nulla.
 */
export default function GlassSkinToggle() {
  const params = useSearchParams();

  useEffect(() => {
    const q = params.get('glass');
    if (q === '1') sessionStorage.setItem('glass-skin', '1');
    if (q === '0') sessionStorage.removeItem('glass-skin');

    const on = sessionStorage.getItem('glass-skin') === '1';
    document.body.classList.toggle('glass-skin', on);
  }, [params]);

  return null;
}
