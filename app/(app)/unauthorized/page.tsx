'use client';
import { Rocket } from 'lucide-react';

export default function UnauthorizedPage() {

    return (
        <div className="flex flex-col h-screen w-full items-center justify-center bg-background text-center p-4">
            <div className="mx-auto bg-primary/20 p-4 rounded-lg text-primary w-fit mb-6">
                <Rocket className="w-12 h-12" />
            </div>
            <h1 className="text-2xl font-bold font-headline mb-2">Accesso non autorizzato</h1>
            <p className="text-muted-foreground mb-6">Non hai i permessi per visualizzare questa pagina.</p>
        </div>
    )
}
