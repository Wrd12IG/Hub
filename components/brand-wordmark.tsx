import { cn } from '@/lib/utils';

/** Marchio testuale W[r]Digital, lo stesso della sidebar: leggibile sia in tema chiaro sia scuro. */
export function BrandWordmark({ className }: { className?: string }) {
    return (
        <span className={cn('font-headline font-semibold tracking-tight', className)}>
            W<span className="text-primary">[</span>r<span className="text-primary">]</span>Digital
        </span>
    );
}
