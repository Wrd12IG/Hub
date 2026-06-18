'use client';

import { useEffect, useState } from 'react';
import { getAuth, onIdTokenChanged } from 'firebase/auth';

/**
 * useAuthToken — Centralized Firebase ID token access hook.
 * 
 * Keeps the token fresh (Firebase auto-refreshes every hour).
 * Returns null if user is not authenticated.
 * 
 * Usage:
 *   const token = useAuthToken();
 *   headers: { Authorization: token ? `Bearer ${token}` : '' }
 */
export function useAuthToken(): string | null {
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = onIdTokenChanged(auth, async (user) => {
            if (user) {
                const freshToken = await user.getIdToken();
                setToken(freshToken);
                // Keep localStorage in sync for legacy components during migration
                localStorage.setItem('token', freshToken);
            } else {
                setToken(null);
                localStorage.removeItem('token');
            }
        });

        return () => unsubscribe();
    }, []);

    return token;
}

/**
 * getAuthToken — Non-reactive helper for use inside async functions.
 * Reads from localStorage (kept in sync by useAuthToken).
 * Returns null if no token is available.
 */
export function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
}

/**
 * getAuthHeader — Returns the Authorization header object.
 * Returns empty object if no token (avoids "Bearer null").
 */
export function getAuthHeader(): Record<string, string> {
    const token = getAuthToken();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
}
