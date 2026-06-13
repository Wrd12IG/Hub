'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useLayoutData } from '@/app/(app)/layout-context';
import { SocialStrategy } from '@/lib/data';
import { getSocialStrategies, deleteSocialStrategy, updateSocialStrategy } from '@/lib/social-strategy-actions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
    Plus,
    Search,
    MoreHorizontal,
    Eye,
    Copy,
    Archive,
    Trash2,
    Bot,
    CheckCircle2,
    Clock
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';

function SocialStrategiesList() {
    const { clients, users, isLoadingLayout } = useLayoutData();
    const [strategies, setStrategies] = useState<SocialStrategy[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [clientFilter, setClientFilter] = useState(searchParams.get('clientId') || 'all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [frequencyFilter, setFrequencyFilter] = useState('all');

    useEffect(() => {
        const fetchStrategies = async () => {
            setIsLoading(true);
            const data = await getSocialStrategies();
            setStrategies(data);
            setIsLoading(false);
        };
        fetchStrategies();
    }, []);

    const filteredStrategies = useMemo(() => {
        return strategies.filter(s => {
            const matchesSearch = s.periodLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (clients.find(c => c.id === s.clientId)?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchesClient = clientFilter === 'all' || s.clientId === clientFilter;
            const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
            const matchesFreq = frequencyFilter === 'all' || s.frequency === frequencyFilter;

            return matchesSearch && matchesClient && matchesStatus && matchesFreq;
        });
    }, [strategies, searchQuery, clientFilter, statusFilter, frequencyFilter, clients]);

    const handleDelete = async (id: string) => {
        if (!confirm('Sei sicuro di voler eliminare questa strategia?')) return;
        try {
            await deleteSocialStrategy(id);
            setStrategies(prev => prev.filter(s => s.id !== id));
            toast({ title: 'Eliminata', description: 'Strategia eliminata con successo.' });
        } catch (error) {
            toast({ title: 'Errore', description: 'Impossibile eliminare la strategia.', variant: 'destructive' });
        }
    };

    const handleArchive = async (id: string) => {
        try {
            await updateSocialStrategy(id, { status: 'archiviata' });
            setStrategies(prev => prev.map(s => s.id === id ? { ...s, status: 'archiviata' } : s));
            toast({ title: 'Archiviata', description: 'Strategia spostata in archivio.' });
        } catch (error) {
            toast({ title: 'Errore', description: 'Impossibile archiviare la strategia.', variant: 'destructive' });
        }
    };

    const handleDuplicate = (strategy: SocialStrategy) => {
        router.push(`/social-strategies/new?duplicateId=${strategy.id}`);
    };

    if (isLoadingLayout || isLoading) {
        return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-2">
                        <Bot className="h-8 w-8 text-primary" /> Strategie Social
                    </h1>
                    <p className="text-muted-foreground">Gestisci e genera strategie di marketing guidate dall'AI</p>
                </div>
                <Button asChild className="rainbow-border">
                    <Link href="/social-strategies/new">
                        <Plus className="mr-2 h-4 w-4" /> Nuova Strategia
                    </Link>
                </Button>
            </div>

            <Card className="glass-card">
                <CardContent className="p-4 space-y-4">
                    <div className="grid gap-4 md:grid-cols-4">
                        <div className="relative md:col-span-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cerca periodo o cliente..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Select value={clientFilter} onValueChange={setClientFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Tutti i Clienti" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tutti i Clienti</SelectItem>
                                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Tutti gli Stati" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tutti gli Stati</SelectItem>
                                <SelectItem value="bozza">Bozza</SelectItem>
                                <SelectItem value="inviata">Inviata</SelectItem>
                                <SelectItem value="archiviata">Archiviata</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Frequenza" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tutte le frequenze</SelectItem>
                                <SelectItem value="settimanale">Settimanale</SelectItem>
                                <SelectItem value="mensile">Mensile</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <div className="rounded-md border bg-card overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Periodo</TableHead>
                            <TableHead>Frequenza</TableHead>
                            <TableHead>Creata Da</TableHead>
                            <TableHead>Data Generazione</TableHead>
                            <TableHead>Stato</TableHead>
                            <TableHead className="text-right">Azioni</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredStrategies.map((s) => {
                            const client = clients.find(c => c.id === s.clientId);
                            const creator = users.find(u => u.id === s.createdBy);

                            return (
                                <TableRow key={s.id} className="cursor-pointer group hover:bg-muted/50 transition-colors" onClick={() => router.push(`/social-strategies/${s.id}`)}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: client?.color || '#ccc' }} />
                                            <span className="font-medium">{client?.name || 'Cliente eliminato'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium text-xs md:text-sm">{s.periodLabel}</TableCell>
                                    <TableCell className="capitalize text-xs">{s.frequency}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: (creator?.color || '#ccc') + '20', color: creator?.color }}>
                                                {creator?.name.charAt(0) || 'U'}
                                            </div>
                                            <span className="text-xs">{creator?.name || 'Sistema'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-[10px] text-muted-foreground">
                                        {format(new Date(s.generationDate), 'dd MMM yyyy HH:mm', { locale: it })}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={s.status === 'inviata' ? 'default' : s.status === 'archiviata' ? 'secondary' : 'outline'} className="text-[10px] whitespace-nowrap">
                                            {s.status === 'inviata' ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <Clock className="mr-1 h-3 w-3" />}
                                            {s.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Azioni</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => router.push(`/social-strategies/${s.id}`)}>
                                                    <Eye className="mr-2 h-4 w-4" /> Apri
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDuplicate(s)}>
                                                    <Copy className="mr-2 h-4 w-4" /> Duplica
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleArchive(s.id)}>
                                                    <Archive className="mr-2 h-4 w-4" /> Archivia
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-destructive focus:bg-destructive/10" onClick={() => handleDelete(s.id)}>
                                                    <Trash2 className="mr-2 h-4 w-4" /> Elimina
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {filteredStrategies.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                    Nessuna strategia trovata.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

export default function SocialStrategiesPage() {
    return (
        <Suspense fallback={<div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
            <SocialStrategiesList />
        </Suspense>
    );
}

export const dynamic = 'force-dynamic';
