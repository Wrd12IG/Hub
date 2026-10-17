import { AlertCircle, RefreshCw } from 'lucide-react';

/** Errore di caricamento di una pagina, con il motivo e un pulsante per riprovare. */
export function PageError({ message, onRetry }: { message: string; onRetry?: () => void }) {
    return (
        <div role="alert" className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center px-6">
            <AlertCircle size={48} className="text-destructive" />
            <p className="font-semibold text-destructive max-w-xl">Errore nel caricamento: {message}</p>
            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold hover:bg-muted transition-colors"
                >
                    <RefreshCw size={14} /> Riprova
                </button>
            )}
        </div>
    );
}
