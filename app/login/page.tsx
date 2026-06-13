'use client';

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
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { handleLogin } = useLayoutData();
    const { toast } = useToast();

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
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>
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
