import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase', () => ({ auth: { currentUser: { getIdToken: async () => 'TOKEN123' } } }));

import { authFetch } from '@/lib/client-api-auth';
import { proxiedBlobUrl } from '@/components/story-editor/proxied-blob';

describe('chiamate autenticate dell\'editor storie', () => {
    const fetchMock = vi.fn();
    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
    });

    it('authFetch manda Authorization: Bearer', async () => {
        fetchMock.mockResolvedValue(new Response('{}'));
        await authFetch('/api/stories/giphy?q=ciao');
        const [, init] = fetchMock.mock.calls[0];
        expect(init.headers.Authorization).toBe('Bearer TOKEN123');
        expect(init.headers['Content-Type']).toBeUndefined(); // GET senza corpo
    });

    it('authFetch con corpo JSON mantiene Content-Type', async () => {
        fetchMock.mockResolvedValue(new Response('{}'));
        await authFetch('/api/stories/magnific/generate', { method: 'POST', body: '{"a":1}' });
        const [, init] = fetchMock.mock.calls[0];
        expect(init.headers['Content-Type']).toBe('application/json');
        expect(init.headers.Authorization).toBe('Bearer TOKEN123');
    });

    it('un media Giphy viene scaricato dal proxy CON il token', async () => {
        vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:fake' }));
        fetchMock.mockResolvedValue(new Response('gif', { headers: { 'content-type': 'image/gif' } }));
        const href = await proxiedBlobUrl('https://media2.giphy.com/media/abc/200w.gif');
        expect(href).toBe('blob:fake');
        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toContain('/api/stories/media-proxy?url=');
        expect(init.headers.Authorization).toBe('Bearer TOKEN123');
    });

    it('un file Firebase di altro host non proxabile resta invariato', async () => {
        expect(await proxiedBlobUrl('https://example.com/x.png')).toBe('https://example.com/x.png');
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
