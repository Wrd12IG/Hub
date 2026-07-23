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
