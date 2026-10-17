import { Suspense } from 'react';
import { DocumentsHub } from './documents-hub';

export default function DocumentsPage() {
    return (
        <Suspense fallback={null}>
            <DocumentsHub />
        </Suspense>
    );
}
