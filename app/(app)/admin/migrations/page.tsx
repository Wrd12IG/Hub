'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Database, Play, Eye, CheckCircle, AlertTriangle, Loader2, Clock, Timer } from 'lucide-react';
import { migrateCancelledTasksDates, previewCancelledTasksMigration, type MigrationResult } from '@/lib/migrations/migrate-cancelled-tasks';
import { migrateUnstoppedTimers, previewUnstoppedTimers, formatDuration, type TimerMigrationResult } from '@/lib/migrations/migrate-unstopped-timers';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

export default function MigrationsPage() {
    const { toast } = useToast();

    // State per migrazione cancelledAt
    const [isLoading, setIsLoading] = useState(false);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [previewData, setPreviewData] = useState<{
        tasksToMigrate: Array<{ id: string; title: string; updatedAt?: string; createdAt?: string }>;
        count: number;
    } | null>(null);
    const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);

    // State per migrazione timer
    const [isTimerLoading, setIsTimerLoading] = useState(false);
    const [isTimerPreviewLoading, setIsTimerPreviewLoading] = useState(false);
    const [timerPreviewData, setTimerPreviewData] = useState<{
        tasksToMigrate: Array<{
            id: string;
            title: string;
            status: string;
            timerStartedAt: string;
            estimatedEndDate?: string;
            estimatedTimeToRecover: number;
            currentTimeSpent: number;
        }>;
        count: number;
        totalEstimatedTime: number;
    } | null>(null);
    const [timerMigrationResult, setTimerMigrationResult] = useState<TimerMigrationResult | null>(null);

    // Handler per migrazione cancelledAt
    const handlePreview = async () => {
        setIsPreviewLoading(true);
        try {
            const result = await previewCancelledTasksMigration();
            setPreviewData(result);
            toast({
                title: 'Preview completata',
                description: `Trovati ${result.count} task da migrare.`,
            });
        } catch (error) {
            toast({
                title: 'Errore',
                description: 'Errore durante la preview della migrazione.',
                variant: 'destructive',
            });
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const handleMigrate = async () => {
        if (!confirm('Sei sicuro di voler eseguire la migrazione? Questa operazione modificherà i dati nel database.')) {
            return;
        }

        setIsLoading(true);
        try {
            const result = await migrateCancelledTasksDates();
            setMigrationResult(result);

            if (result.success) {
                toast({
                    title: 'Migrazione completata! ✅',
                    description: `${result.migratedCount} task migrati con successo.`,
                });
            } else {
                toast({
                    title: 'Migrazione completata con errori',
                    description: `${result.migratedCount} task migrati, ${result.errors.length} errori.`,
                    variant: 'destructive',
                });
            }

            await handlePreview();
        } catch (error) {
            toast({
                title: 'Errore',
                description: 'Errore durante la migrazione.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Handler per migrazione timer
    const handleTimerPreview = async () => {
        setIsTimerPreviewLoading(true);
        try {
            const result = await previewUnstoppedTimers();
            setTimerPreviewData(result);
            toast({
                title: 'Preview completata',
                description: `Trovati ${result.count} task con timer non fermato. Tempo stimato da recuperare: ${formatDuration(result.totalEstimatedTime)}`,
            });
        } catch (error) {
            toast({
                title: 'Errore',
                description: 'Errore durante la preview.',
                variant: 'destructive',
            });
        } finally {
            setIsTimerPreviewLoading(false);
        }
    };

    const handleTimerMigrate = async () => {
        if (!confirm('Sei sicuro di voler eseguire la migrazione? Questa operazione aggiungerà il tempo recuperato a timeSpent e rimuoverà timerStartedAt.')) {
            return;
        }

        setIsTimerLoading(true);
        try {
            const result = await migrateUnstoppedTimers();
            setTimerMigrationResult(result);

            if (result.success) {
                toast({
                    title: 'Migrazione completata! ✅',
                    description: `${result.migratedCount} task migrati. Recuperate ${formatDuration(result.totalTimeRecovered)}.`,
                });
            } else {
                toast({
                    title: 'Migrazione completata con errori',
                    description: `${result.migratedCount} task migrati, ${result.errors.length} errori.`,
                    variant: 'destructive',
                });
            }

            await handleTimerPreview();
        } catch (error) {
            toast({
                title: 'Errore',
                description: 'Errore durante la migrazione.',
                variant: 'destructive',
            });
        } finally {
            setIsTimerLoading(false);
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'N/D';
        try {
            return format(parseISO(dateStr), 'dd/MM/yyyy HH:mm', { locale: it });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center gap-3">
                <Database className="h-8 w-8 text-primary" />
                <div>
                    <h1 className="text-3xl font-bold">Migrazioni Database</h1>
                    <p className="text-muted-foreground">Strumenti per aggiornare la struttura dei dati</p>
                </div>
            </div>

            {/* Migrazione Timer Non Fermati */}
            <Card className="border-2 border-orange-500/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Timer className="h-5 w-5 text-orange-500" />
                        <span>⏱️ Migrazione: Recupero Tempo Timer Non Fermati</span>
                        <Badge variant="destructive">IMPORTANTE</Badge>
                    </CardTitle>
                    <CardDescription>
                        Recupera il tempo dei timer che non sono stati fermati prima dell&apos;approvazione/annullamento dei task.
                        Calcola il tempo tra <code className="bg-muted px-1 rounded">timerStartedAt</code> e la data di approvazione/annullamento,
                        lo aggiunge a <code className="bg-muted px-1 rounded">timeSpent</code> e rimuove il timer.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={handleTimerPreview}
                            disabled={isTimerPreviewLoading || isTimerLoading}
                        >
                            {isTimerPreviewLoading ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Eye className="h-4 w-4 mr-2" />
                            )}
                            Preview
                        </Button>
                        <Button
                            onClick={handleTimerMigrate}
                            disabled={isTimerLoading || isTimerPreviewLoading}
                            className="bg-orange-600 hover:bg-orange-700"
                        >
                            {isTimerLoading ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Play className="h-4 w-4 mr-2" />
                            )}
                            Recupera Tempo
                        </Button>
                    </div>

                    {/* Risultato migrazione timer */}
                    {timerMigrationResult && (
                        <Alert variant={timerMigrationResult.success ? 'default' : 'destructive'}>
                            {timerMigrationResult.success ? (
                                <CheckCircle className="h-4 w-4" />
                            ) : (
                                <AlertTriangle className="h-4 w-4" />
                            )}
                            <AlertTitle>
                                {timerMigrationResult.success ? 'Migrazione completata!' : 'Migrazione completata con errori'}
                            </AlertTitle>
                            <AlertDescription>
                                <ul className="mt-2 space-y-1">
                                    <li>✅ Task migrati: <strong>{timerMigrationResult.migratedCount}</strong></li>
                                    <li>⏭️ Task saltati: <strong>{timerMigrationResult.skippedCount}</strong></li>
                                    <li>⏱️ Tempo totale recuperato: <strong>{formatDuration(timerMigrationResult.totalTimeRecovered)}</strong></li>
                                    {timerMigrationResult.errors.length > 0 && (
                                        <li>❌ Errori: <strong>{timerMigrationResult.errors.length}</strong></li>
                                    )}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Preview timer */}
                    {timerPreviewData && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <h4 className="font-medium">Task con timer non fermato:</h4>
                                <Badge variant={timerPreviewData.count > 0 ? 'destructive' : 'secondary'}>
                                    {timerPreviewData.count}
                                </Badge>
                                {timerPreviewData.count > 0 && (
                                    <Badge variant="outline" className="text-orange-600 border-orange-500">
                                        ~{formatDuration(timerPreviewData.totalEstimatedTime)} da recuperare
                                    </Badge>
                                )}
                            </div>

                            {timerPreviewData.count === 0 ? (
                                <Alert>
                                    <CheckCircle className="h-4 w-4" />
                                    <AlertTitle>Nessun timer da recuperare</AlertTitle>
                                    <AlertDescription>
                                        Tutti i task approvati/annullati hanno i timer correttamente fermati.
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Titolo</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Timer Avviato</TableHead>
                                                <TableHead>Data Fine</TableHead>
                                                <TableHead>Tempo da Recuperare</TableHead>
                                                <TableHead>Tempo Attuale</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {timerPreviewData.tasksToMigrate.map((task) => (
                                                <TableRow key={task.id}>
                                                    <TableCell className="font-medium">{task.title}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={task.status === 'Approvato' ? 'default' : 'secondary'}>
                                                            {task.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>{formatDate(task.timerStartedAt)}</TableCell>
                                                    <TableCell>{formatDate(task.estimatedEndDate)}</TableCell>
                                                    <TableCell className="font-semibold text-orange-600">
                                                        +{formatDuration(task.estimatedTimeToRecover)}
                                                    </TableCell>
                                                    <TableCell>{formatDuration(task.currentTimeSpent)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Migrazione cancelledAt */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        <span>🗓️ Migrazione: Data Annullamento Task</span>
                    </CardTitle>
                    <CardDescription>
                        Popola il campo <code className="bg-muted px-1 rounded">cancelledAt</code> per tutti i task
                        con status &quot;Annullato&quot; che non hanno ancora questo campo. Utilizza la data di ultimo aggiornamento
                        (<code className="bg-muted px-1 rounded">updatedAt</code>) come valore.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={handlePreview}
                            disabled={isPreviewLoading || isLoading}
                        >
                            {isPreviewLoading ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Eye className="h-4 w-4 mr-2" />
                            )}
                            Preview
                        </Button>
                        <Button
                            onClick={handleMigrate}
                            disabled={isLoading || isPreviewLoading}
                        >
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Play className="h-4 w-4 mr-2" />
                            )}
                            Esegui Migrazione
                        </Button>
                    </div>

                    {/* Risultato migrazione cancelledAt */}
                    {migrationResult && (
                        <Alert variant={migrationResult.success ? 'default' : 'destructive'}>
                            {migrationResult.success ? (
                                <CheckCircle className="h-4 w-4" />
                            ) : (
                                <AlertTriangle className="h-4 w-4" />
                            )}
                            <AlertTitle>
                                {migrationResult.success ? 'Migrazione completata!' : 'Migrazione completata con errori'}
                            </AlertTitle>
                            <AlertDescription>
                                <ul className="mt-2 space-y-1">
                                    <li>✅ Task migrati: <strong>{migrationResult.migratedCount}</strong></li>
                                    <li>⏭️ Task saltati (già migrati): <strong>{migrationResult.skippedCount}</strong></li>
                                    {migrationResult.errors.length > 0 && (
                                        <li>❌ Errori: <strong>{migrationResult.errors.length}</strong></li>
                                    )}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Preview cancelledAt */}
                    {previewData && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <h4 className="font-medium">Task da migrare:</h4>
                                <Badge variant={previewData.count > 0 ? 'default' : 'secondary'}>
                                    {previewData.count}
                                </Badge>
                            </div>

                            {previewData.count === 0 ? (
                                <Alert>
                                    <CheckCircle className="h-4 w-4" />
                                    <AlertTitle>Nessun task da migrare</AlertTitle>
                                    <AlertDescription>
                                        Tutti i task annullati hanno già il campo cancelledAt popolato.
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>ID</TableHead>
                                                <TableHead>Titolo</TableHead>
                                                <TableHead>Data Aggiornamento</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewData.tasksToMigrate.map((task) => (
                                                <TableRow key={task.id}>
                                                    <TableCell className="font-mono text-xs">
                                                        {task.id.substring(0, 8)}...
                                                    </TableCell>
                                                    <TableCell>{task.title}</TableCell>
                                                    <TableCell>{formatDate(task.updatedAt)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Info */}
            <Card>
                <CardHeader>
                    <CardTitle>ℹ️ Informazioni</CardTitle>
                </CardHeader>
                <CardContent className="prose prose-sm max-w-none dark:prose-invert">
                    <h4>⏱️ Migrazione Timer</h4>
                    <ul>
                        <li>Recupera il tempo dei timer che non sono stati fermati prima dell&apos;approvazione</li>
                        <li>Calcola il tempo tra l&apos;avvio del timer e la data di approvazione/annullamento</li>
                        <li>Limita il tempo massimo a 24 ore per sessione (evita valori assurdi)</li>
                        <li>Rimuove <code>timerStartedAt</code> e <code>timerUserId</code> dopo la migrazione</li>
                    </ul>

                    <h4>🗓️ Migrazione Data Annullamento</h4>
                    <ul>
                        <li>Aggiunge il campo <code>cancelledAt</code> ai task annullati</li>
                        <li>Usato per i filtri della dashboard basati su data di approvazione/annullamento</li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}
