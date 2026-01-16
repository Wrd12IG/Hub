'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Client, Project, Task } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export default function ClientSharePage() {
    const params = useParams();
    const token = params.token as string;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [client, setClient] = useState<Client | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);

    useEffect(() => {
        async function fetchData() {
            try {
                // 1. Find Client by Token
                const qClient = query(collection(db, 'clients'), where('publicToken', '==', token));
                const clientSnap = await getDocs(qClient);

                if (clientSnap.empty) {
                    setError('Link non valido o scaduto.');
                    setLoading(false);
                    return;
                }

                const clientData = { id: clientSnap.docs[0].id, ...clientSnap.docs[0].data() } as Client;
                setClient(clientData);

                // 2. Fetch Projects
                const qProjects = query(collection(db, 'projects'), where('clientId', '==', clientData.id));
                const projectsSnap = await getDocs(qProjects);
                const projectsData = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Project[];
                setProjects(projectsData);

                // 3. Fetch Tasks
                const qTasks = query(collection(db, 'tasks'), where('clientId', '==', clientData.id));
                const tasksSnap = await getDocs(qTasks);
                const tasksData = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Task[];
                setTasks(tasksData);

            } catch (err) {
                console.error(err);
                setError('Si è verificato un errore nel caricamento dei dati.');
            } finally {
                setLoading(false);
            }
        }

        if (token) fetchData();
    }, [token]);

    if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    if (error) return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 gap-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <h1 className="text-2xl font-bold text-slate-800">Spiacenti</h1>
            <p className="text-muted-foreground">{error}</p>
        </div>
    );

    if (!client) return null;

    // Calculate stats
    const activeProjects = projects.filter(p => p.status !== 'Completato' && p.status !== 'Annullato');
    const completedProjects = projects.filter(p => p.status === 'Completato');

    // Sort tasks by completion date (newest first)
    const completedTasks = tasks.filter(t => t.status === 'Approvato').sort((a, b) => (new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())).slice(0, 5);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-12">
            <div className="max-w-5xl mx-auto space-y-8">
                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard Cliente</h1>
                        <p className="text-slate-500 mt-1">Benvenuto, <span className="font-semibold text-primary">{client.name}</span></p>
                    </div>
                    <div className="flex gap-4 text-sm">
                        <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-full font-medium">
                            {activeProjects.length} Progetti Attivi
                        </div>
                        <div className="px-4 py-2 bg-green-50 text-green-700 rounded-full font-medium">
                            {completedProjects.length} Completati
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content: Active Projects */}
                    <div className="lg:col-span-2 space-y-6">
                        <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                            <Clock className="h-5 w-5 text-primary" /> Progetti in Corso
                        </h2>

                        {activeProjects.length === 0 ? (
                            <Card className="bg-white/60 border-dashed">
                                <CardContent className="pt-6 text-center text-muted-foreground">Nessun progetto attivo al momento.</CardContent>
                            </Card>
                        ) : (
                            activeProjects.map(project => {
                                const pTasks = tasks.filter(t => t.projectId === project.id);
                                const doneCount = pTasks.filter(t => t.status === 'Approvato').length;
                                const progress = pTasks.length > 0 ? Math.round((doneCount / pTasks.length) * 100) : 0;

                                return (
                                    <Card key={project.id} className="border-0 shadow-md bg-white hover:translate-y-[-2px] transition-transform duration-300 overflow-hidden">
                                        <div className="h-1 bg-gradient-to-r from-primary to-purple-400"></div>
                                        <CardHeader>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <CardTitle className="text-lg">{project.name}</CardTitle>
                                                    <CardDescription>{format(new Date(project.createdAt || new Date()), 'dd MMM yyyy', { locale: it })}</CardDescription>
                                                </div>
                                                <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">{project.status}</Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {project.description && <p className="text-sm text-slate-600 line-clamp-2">{project.description}</p>}

                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs font-medium text-slate-500">
                                                    <span>Progresso Attività</span>
                                                    <span>{progress}%</span>
                                                </div>
                                                <Progress value={progress} className="h-2 bg-slate-100" />
                                            </div>

                                            <div className="pt-2 flex items-center gap-4 text-xs text-slate-400">
                                                <span>Data Fine: {project.endDate ? format(new Date(project.endDate), 'dd MMM yyyy', { locale: it }) : 'N/D'}</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })
                        )}
                    </div>

                    {/* Sidebar: Recent Activity & Stats */}
                    <div className="space-y-6">
                        <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600" /> Attività Recenti
                        </h2>

                        <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
                            <CardContent className="p-0">
                                {completedTasks.length === 0 ? (
                                    <div className="p-6 text-center text-sm text-muted-foreground">Nessuna attività completata di recente.</div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {completedTasks.map(task => (
                                            <div key={task.id} className="p-4 flex items-start gap-3 hover:bg-slate-50/50 transition-colors">
                                                <div className="mt-1">
                                                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <p className="text-sm font-medium text-slate-800 leading-none">{task.title}</p>
                                                    <p className="text-xs text-slate-500">
                                                        Completato il {task.updatedAt ? format(new Date(task.updatedAt), 'dd MMM', { locale: it }) : 'N/D'}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                    </div>
                </div>

                <footer className="text-center text-slate-400 text-sm py-8">
                    <p>&copy; {new Date().getFullYear()} W[r]Digital Hub. Secure Client View.</p>
                </footer>
            </div>
        </div>
    );
}
