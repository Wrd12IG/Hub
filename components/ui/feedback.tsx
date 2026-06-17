import { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

/**
 * Inline error banner con opzionale bottone "Riprova".
 * Usare al posto di pagine bianche o console.error.
 */
export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
      <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
      <p className="text-destructive flex-1">{message}</p>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry} className="shrink-0">
          Riprova
        </Button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Stato vuoto generico riutilizzabile.
 * Fornire sempre un'azione (CTA) per guidare l'utente.
 */
export function EmptyStateGeneric({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center gap-3 py-16 text-center ${className}`}
    >
      <div className="rounded-full bg-muted p-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-foreground">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
