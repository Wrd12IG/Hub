'use client';

import { useEffect, useState } from 'react';
import { useLayoutData } from '@/app/(app)/layout-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { generateClientPublicLink, revokeClientPublicLink } from '@/lib/actions';
import { ArrowLeft, Mail, Phone, MapPin, Euro, Calendar, CheckSquare, Link as LinkIcon, Copy, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { Client, Task, Project } from '@/lib/data';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export default function ClientDetailsPage() {
    const params = useParams();
    const { clients, allTasks, allProjects, users, isLoadingLayout } = useLayoutData();
    const [client, setClient] = useState<Client | null>(null);
    const [clientTasks, setClientTasks] = useState<Task[]>([]);
    const [clientProjects, setClientProjects] = useState<Project[]>([]);
    const { toast } = useToast();

    useEffect(() => {
        if (!isLoadingLayout && params.id) {
            const foundClient = clients.find(c => c.id === params.id);
            if (foundClient) {
                setClient(foundClient);
                setClientTasks((allTasks || []).filter(t => t.clientId === foundClient.id));
                setClientProjects((allProjects || []).filter(p => p.clientId === foundClient.id));
            }
        }
    }, [clients, allTasks, allProjects, params.id, isLoadingLayout]);

    if (isLoadingLayout) {
        return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
    }

    if (!client) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
                <h2 className="text-2xl font-bold">Cliente non trovato</h2>
                <Button asChild variant="outline">
                    <Link href="/admin?tab=clients">Torna ai Clienti</Link>
                </Button>
            </div>
        );
    }

    const completedTasks = clientTasks.filter(t => t.status === 'Approvato').length;
    const completionRate = clientTasks.length > 0 ? Math.round((completedTasks / clientTasks.length) * 100) : 0;
    const totalBudgetSpent = clientTasks.reduce((acc, t) => {
        // @ts-ignore - hourlyRate might be missing in Task type definition but present in data
        const rate = t.hourlyRate || 0;
        return acc + (rate * (t.timeSpent || 0) / 60);
    }, 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/admin?tab=clients">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                            {client.name}
                            <div
                                className="h-4 w-4 rounded-full"
                                style={{ backgroundColor: client.color }}
                                title="Colore Cliente"
                            />
                        </h1>
                        <p className="text-muted-foreground flex items-center gap-2">
                            <MapPin className="h-3 w-3" /> {client.address || 'Nessun indirizzo specificato'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {client.publicToken ? (
                        <>
                            <Button variant="outline" size="sm" onClick={() => {
                                const url = `${window.location.origin}/share/client/${client.publicToken}`;
                                navigator.clipboard.writeText(url);
                                toast({ title: 'Copiato', description: 'Link copiato negli appunti.' });
                            }}>
                                <Copy className="mr-2 h-4 w-4" /> Copia Link Cliente
                            </Button>
                            <Button variant="outline" size="icon" className="text-destructive hover:text-destructive" onClick={async () => {
                                if (!client) return;
                                await revokeClientPublicLink(client.id);
                                toast({ title: 'Revocato', description: 'Link disattivato.' });
                                window.location.reload();
                            }}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </>
                    ) : (
                        <Button variant="outline" size="sm" onClick={async () => {
                            if (!client) return;
                            await generateClientPublicLink(client.id);
                            toast({ title: 'Generato', description: 'Link pubblico creato.' });
                            window.location.reload();
                        }}>
                            <LinkIcon className="mr-2 h-4 w-4" /> Genera Link Pubblico
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Info Card */}
                <Card className="md:col-span-1 glass-card">
                    <CardHeader>
                        <CardTitle>Contatti & Info</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-primary/10 p-2 rounded-full"><Mail className="h-4 w-4 text-primary" /></div>
                            <div>
                                <p className="text-sm font-medium">Email</p>
                                <p className="text-sm text-muted-foreground">{client.email || '-'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="bg-primary/10 p-2 rounded-full"><Phone className="h-4 w-4 text-primary" /></div>
                            <div>
                                <p className="text-sm font-medium">Telefono</p>
                                <p className="text-sm text-muted-foreground">{client.phone || '-'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="bg-primary/10 p-2 rounded-full"><Euro className="h-4 w-4 text-primary" /></div>
                            <div>
                                <p className="text-sm font-medium">Budget</p>
                                <p className="text-sm text-muted-foreground">€{client.budget?.toLocaleString('it-IT') || '0'}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Stats Card */}
                <Card className="md:col-span-2 glass-card">
                    <CardHeader>
                        <CardTitle>Panoramica Attività</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-card border rounded-lg p-4 flex flex-col items-center justify-center text-center">
                            <span className="text-3xl font-bold text-primary">{clientProjects.length}</span>
                            <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Progetti Attivi</span>
                        </div>
                        <div className="bg-card border rounded-lg p-4 flex flex-col items-center justify-center text-center">
                            <span className="text-3xl font-bold text-primary">{clientTasks.length}</span>
                            <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Task Totali</span>
                        </div>
                        <div className="bg-card border rounded-lg p-4 flex flex-col items-center justify-center text-center">
                            <span className="text-3xl font-bold text-green-500">{completionRate}%</span>
                            <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Completamento</span>
                        </div>
                        <div className="bg-card border rounded-lg p-4 flex flex-col items-center justify-center text-center">
                            <span className="text-3xl font-bold text-primary">€{totalBudgetSpent.toFixed(0)}</span>
                            <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Speso (Stima)</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Managed By */}
            {client.managedBy && client.managedBy.length > 0 && (
                <Card className="glass-card">
                    <CardHeader>
                        <CardTitle>Account Managers</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-4">
                            {users.filter(u => client.managedBy?.includes(u.id)).map(manager => (
                                <div key={manager.id} className="flex items-center gap-3 bg-accent/50 p-2 pr-4 rounded-full border">
                                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs" style={{ backgroundColor: manager.color }}>
                                        {manager.name.charAt(0)}
                                    </div>
                                    <div className="text-sm font-medium">{manager.name}</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Note */}
            {client.notes && (
                <Card className="glass-card">
                    <CardHeader>
                        <CardTitle>Note</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="whitespace-pre-wrap text-sm">{client.notes}</p>
                    </CardContent>
                </Card>
            )}

            <TabsSection
                projects={clientProjects}
                tasks={clientTasks}
            />
        </div>
    );
}

function TabsSection({ projects, tasks }: { projects: Project[], tasks: Task[] }) {
    const [activeTab, setActiveTab] = useState('active-projects');

    return (
        <div className="space-y-4">
            <div className="flex gap-2 border-b pb-2 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('active-projects')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'active-projects' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
                >
                    Progetti Attivi
                </button>
                <button
                    onClick={() => setActiveTab('recent-tasks')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'recent-tasks' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
                >
                    Task Recenti
                </button>
            </div>

            {activeTab === 'active-projects' && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {projects.length === 0 ? (
                        <p className="text-muted-foreground col-span-full py-8 text-center bg-accent/20 rounded-lg">Nessun progetto attivo.</p>
                    ) : (
                        projects.map(project => (
                            <Card key={project.id} className="hover:shadow-md transition-shadow glass-card">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-lg">{project.name}</CardTitle>
                                        <Badge variant={project.status === 'Completato' ? 'default' : 'secondary'}>{project.status}</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-xs text-muted-foreground line-clamp-2 mb-4">{project.description}</p>
                                    <div className="flex items-center text-xs text-muted-foreground">
                                        <Calendar className="mr-1 h-3 w-3" />
                                        {project.startDate ? format(new Date(project.startDate), 'd MMM yyyy', { locale: it }) : '-'}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'recent-tasks' && (
                <div className="space-y-2">
                    {tasks.length === 0 ? (
                        <p className="text-muted-foreground py-8 text-center bg-accent/20 rounded-lg">Nessun task trovato.</p>
                    ) : (
                        tasks.slice(0, 10).map(task => (
                            <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`h-2 w-2 rounded-full ${task.status === 'Approvato' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                    <span className="font-medium text-sm">{task.title}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Badge variant="outline" className="text-xs">{task.status}</Badge>
                                    <span className="text-xs text-muted-foreground hidden sm:block">
                                        {task.dueDate ? format(new Date(task.dueDate), 'd MMM', { locale: it }) : '-'}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}
