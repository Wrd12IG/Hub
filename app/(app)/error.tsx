'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const router = useRouter();

    useEffect(() => {
        // Log to structured logger if available, not to console
        console.error('[App Error Boundary]', error.digest ?? error.message);
    }, [error]);

    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-4 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10">
                <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>

            <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Qualcosa è andato storto
                </h1>
                <p className="text-sm text-muted-foreground max-w-md">
                    Si è verificato un errore inaspettato. Il team è stato notificato.
                    {error.digest && (
                        <span className="block mt-1 font-mono text-xs opacity-60">
                            ID: {error.digest}
                        </span>
                    )}
                </p>
            </div>

            <div className="flex gap-3">
                <Button variant="outline" onClick={() => router.push('/dashboard')}>
                    <Home className="h-4 w-4 mr-2" />
                    Dashboard
                </Button>
                <Button onClick={reset}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Riprova
                </Button>
            </div>
        </div>
    );
}
