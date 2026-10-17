import { redirect } from 'next/navigation';

// Pagina unita a Documenti: i vecchi link (/assets?client=...) continuano a funzionare.
export default function AssetsRedirect({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
    const params = new URLSearchParams({ tab: 'media' });
    const client = searchParams.client;
    if (typeof client === 'string') params.set('client', client);
    redirect(`/documents?${params}`);
}
