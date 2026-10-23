import { auth } from '@/lib/firebase';

/**
 * Utility to get Authorization headers for API calls in client components.
 */
export async function getAuthHeaders(extraHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...extraHeaders
    };

    try {
        let token = await auth.currentUser?.getIdToken();
        if (!token && typeof window !== 'undefined') {
            token = localStorage.getItem('token') || undefined;
        }
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    } catch (e) {
        console.warn('Failed to retrieve Firebase ID token for API request:', e);
    }

    return headers;
}

/** fetch verso le route del Hub con il token di accesso (le route staff rispondono 401 senza). */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
    const auth = await getAuthHeaders();
    const headers: Record<string, string> = { ...auth, ...(init.headers as Record<string, string> | undefined) };
    if (!init.body) delete headers['Content-Type'];
    return fetch(input, { ...init, headers });
}
