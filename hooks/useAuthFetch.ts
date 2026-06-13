/**
 * hooks/useAuthFetch.ts
 * 
 * Hook per fare fetch autenticato con il Bearer token di Firebase.
 * Legge automaticamente il token da localStorage e lo aggiunge all'header.
 */
'use client';

import { useCallback } from 'react';

export function useAuthFetch() {
  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      
      const headers = new Headers(options.headers || {});
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      return fetch(url, {
        ...options,
        headers,
      });
    },
    []
  );

  return { authFetch };
}
