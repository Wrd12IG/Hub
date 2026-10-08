'use client';

import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLayoutData } from '@/app/(app)/layout-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [resetInviato, setResetInviato] = useState(false);
    const [resetInCorso, setResetInCorso] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { handleLogin } = useLayoutData();
    const { toast } = useToast();

    const onRecuperaPassword = async () => {
        const indirizzo = email.trim();
        if (!indirizzo) {
            toast({ title: 'Manca l\'email', description: 'Scrivi il tuo indirizzo qui sopra, poi premi di nuovo.', variant: 'destructive' });
            return;
        }
        setResetInCorso(true);
        try {
            await sendPasswordResetEmail(auth, indirizzo);
            // Nessuna distinzione fra email esistente e inesistente: dire "questo
            // indirizzo non esiste" permetterebbe a chiunque di scoprire chi ha
            // un account. Il messaggio e' lo stesso in entrambi i casi.
            setResetInviato(true);
        } catch (error: any) {
            if (error?.code === 'auth/invalid-email') {
                toast({ title: 'Email non valida', description: "Controlla l'indirizzo e riprova.", variant: 'destructive' });
            } else if (error?.code === 'auth/too-many-requests') {
                toast({ title: 'Troppi tentativi', description: 'Aspetta qualche minuto e riprova.', variant: 'destructive' });
            } else {
                // Anche su utente inesistente Firebase puo' rispondere con un
                // errore: lo trattiamo come successo, per non rivelare nulla.
                setResetInviato(true);
            }
        } finally {
            setResetInCorso(false);
        }
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const result = await handleLogin(email, password);

            if (result.success) {
                toast({
                    title: "Login effettuato",
                    description: "Benvenuto nel Marketing Pilot!",
                });
                router.push('/dashboard');
            } else {
                toast({
                    title: "Errore di accesso",
                    description: result.error || "Credenziali non valide",
                    variant: "destructive",
                });
            }
        } catch (error) {
            toast({
                title: "Errore",
                description: "Si è verificato un errore imprevisto.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold text-center">Marketing Pilot</CardTitle>
                    <CardDescription className="text-center">
                        Inserisci le tue credenziali per accedere
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={onSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="nome@esempio.it"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Password</Label>
                                <button
                                    type="button"
                                    onClick={onRecuperaPassword}
                                    disabled={resetInCorso || isLoading}
                                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
                                >
                                    {resetInCorso ? 'Invio…' : 'Password dimenticata?'}
                                </button>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        {resetInviato && (
                            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                                Se quell&apos;indirizzo ha un account, ti abbiamo inviato il link per reimpostare la password. Controlla anche la posta indesiderata.
                            </p>
                        )}

                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? 'Accesso in corso...' : 'Accedi'}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <p className="text-xs text-muted-foreground">
                        Problemi di accesso? Contatta l'amministratore.
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
