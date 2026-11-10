/**
 * hooks/useAuthFetch.ts
 *
 * Hook per fare fetch autenticato con il Bearer token di Firebase.
 *
 * Il token Firebase dura un'ora e il rinnovo automatico dell'SDK può tardare in una scheda in secondo piano. Prima si leggeva
 * solo il valore salvato in localStorage: una pagina che faceva molte chiamate in sequenza (il calcolo dell'anteprima della mail
 * mensile, che dura minuti) a un certo punto mandava un token scaduto e il server rispondeva 401 «id-token-expired».
 * Ora il token si chiede all'SDK a ogni chiamata (che lo rinnova se sta per scadere) e, su un 401, si riprova una volta
 * forzando il rinnovo.
 */
'use client';

import { useCallback } from 'react';
import { getAuth } from 'firebase/auth';

async function currentToken(forceRefresh: boolean): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const user = getAuth().currentUser;
    if (user) {
      const token = await user.getIdToken(forceRefresh);
      localStorage.setItem('token', token);
      return token;
    }
  } catch {
    // SDK non pronto: si ripiega sul valore salvato
  }
  return localStorage.getItem('token');
}

export function useAuthFetch() {
  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const send = async (forceRefresh: boolean) => {
        const token = await currentToken(forceRefresh);
        const headers = new Headers(options.headers || {});
        if (token) headers.set('Authorization', `Bearer ${token}`);
        return fetch(url, { ...options, headers });
      };

      const res = await send(false);
      // Un solo nuovo tentativo, con rinnovo forzato: un 401 vero (utente senza permessi) risponde uguale la seconda volta
      if (res.status === 401) return send(true);
      return res;
    },
    []
  );

  return { authFetch };
}
