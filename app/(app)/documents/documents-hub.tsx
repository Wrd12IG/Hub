'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DocumentsTable } from '@/components/documents-table';
import { AssetsGallery } from '@/components/assets-gallery';

// Documenti e Media leggono gli stessi allegati dei task: una pagina sola, due viste.
export function DocumentsHub() {
    const router = useRouter();
    const params = useSearchParams();
    const tab = params.get('tab') === 'media' ? 'media' : 'elenco';

    const onTabChange = (value: string) => {
        const next = new URLSearchParams(params.toString());
        if (value === 'media') next.set('tab', 'media');
        else { next.delete('tab'); next.delete('client'); }
        router.replace(`/documents${next.toString() ? `?${next}` : ''}`, { scroll: false });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline">Documenti e Media</h1>
                <p className="text-muted-foreground">Tutti gli allegati dei task, come archivio con filtri o come galleria.</p>
            </div>
            <Tabs value={tab} onValueChange={onTabChange}>
                <TabsList>
                    <TabsTrigger value="elenco">Archivio</TabsTrigger>
                    <TabsTrigger value="media">Galleria media</TabsTrigger>
                </TabsList>
                <TabsContent value="elenco" className="mt-4"><DocumentsTable /></TabsContent>
                <TabsContent value="media" className="mt-4"><AssetsGallery /></TabsContent>
            </Tabs>
        </div>
    );
}
