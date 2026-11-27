'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Square, CornerDownLeft, Timer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Task } from '@/lib/data';
import { useLayoutData } from '@/app/(app)/layout-context';
import { startTaskTimer, stopTaskTimer } from '@/lib/actions';
import { toast } from 'sonner';
import { playSound } from '@/lib/sounds';
import { formatElapsed } from '@/lib/timer-format';

/**
 * Cronometri in corso. Si possono far partire su più task contemporaneamente:
 * ogni riga tiene il proprio tempo e lo salva sul suo task quando si ferma
 * (con il pulsante, o se la riga sparisce per un cambio di pagina o un refresh).
 */

interface TimerRowProps {
    task: Task;
    onStopped: (taskId: string) => void;
    /** Ogni riga comunica i suoi secondi al pannello, per il totale nella vista ridotta. */
    onTick: (taskId: string, seconds: number) => void;
    compact: boolean;
}

function TimerRow({ task, onStopped, onTick, compact }: TimerRowProps) {
    const { currentUser, soundSettings } = useLayoutData();
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number | null>(null);
    // Ref per uso nel cleanup (evita closure stale su elapsedSeconds)
    const elapsedSecondsRef = useRef(0);
    // Flag: evita doppio salvataggio se handleStop è già stato chiamato prima del cleanup
    const cleanupRanRef = useRef(false);
    const onTickRef = useRef(onTick);
    onTickRef.current = onTick;

    useEffect(() => {
        startTimeRef.current = Date.now();
        cleanupRanRef.current = false;

        // Salva l'avvio del timer su Firestore per visibilità globale (Dashboard «Task in lavorazione»)
        if (currentUser) {
            startTaskTimer(task.id, currentUser.id).catch(console.error);
        }

        intervalRef.current = setInterval(() => {
            const elapsed = Math.floor((Date.now() - (startTimeRef.current || 0)) / 1000);
            setElapsedSeconds(elapsed);
            elapsedSecondsRef.current = elapsed;
            onTickRef.current(task.id, elapsed);
        }, 1000);

        // Safety net: salva il tempo quando la riga viene smontata senza handleStop esplicito
        // (navigazione, refresh, o stopTimer chiamato dall'esterno, es. invio in approvazione).
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (cleanupRanRef.current) return;
            cleanupRanRef.current = true;
            const elapsed = elapsedSecondsRef.current;
            if (elapsed > 0) stopTaskTimer(task.id, elapsed).catch(console.error);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [task.id, currentUser?.id]);

    const handleStop = async () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        cleanupRanRef.current = true;

        if (soundSettings.enabled && soundSettings.timerSound) {
            playSound('timer', soundSettings.volume);
        }

        const timeToSave = elapsedSecondsRef.current;
        if (timeToSave > 0) {
            try {
                await stopTaskTimer(task.id, timeToSave);
                toast.success(`«${task.title}»: registrati ${formatElapsed(timeToSave)}.`);
            } catch (error) {
                console.error('Error stopping timer:', error);
                toast.error('Errore nel salvataggio del tempo.');
                cleanupRanRef.current = false; // Permetti retry via cleanup
            }
        }
        onStopped(task.id);
    };

    if (compact) {
        return (
            <div className="flex items-center gap-3 rounded-lg bg-secondary px-3 py-2">
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" title={task.title}>{task.title}</p>
                    <p className="font-mono text-lg font-bold leading-tight tabular-nums">{formatElapsed(elapsedSeconds)}</p>
                </div>
                <Button onClick={handleStop} size="icon" variant="destructive" className="h-10 w-10 shrink-0 rounded-full" aria-label={`Ferma il cronometro di ${task.title}`}>
                    <Square className="h-4 w-4" />
                </Button>
            </div>
        );
    }

    return (
        <>
            <CardContent className="p-4 text-center bg-secondary">
                <p className="text-6xl font-bold font-mono text-foreground tabular-nums">{formatElapsed(elapsedSeconds)}</p>
            </CardContent>
            <div className="p-4 flex justify-center">
                <Button onClick={handleStop} size="lg" variant="destructive" className="w-20 h-20 rounded-full shadow-md" aria-label={`Ferma il cronometro di ${task.title}`}>
                    <Square className="w-8 h-8" />
                </Button>
            </div>
        </>
    );
}

interface TimersPanelProps {
    tasks: Task[];
    onStop: (taskId: string) => void;
}

export default function TimersPanel({ tasks, onStop }: TimersPanelProps) {
    const [isMinimized, setIsMinimized] = useState(false);
    const [seconds, setSeconds] = useState<Record<string, number>>({});

    const handleTick = React.useCallback((taskId: string, s: number) => {
        setSeconds(cur => (cur[taskId] === s ? cur : { ...cur, [taskId]: s }));
    }, []);

    if (tasks.length === 0) return null;
    const single = tasks.length === 1;
    const longest = Math.max(0, ...tasks.map(t => seconds[t.id] ?? 0));

    return (
        <>
            {/* Vista ridotta: le righe restano montate (nascoste) così i cronometri continuano a contare */}
            {isMinimized && (
                <Card className="fixed bottom-4 right-4 z-50 w-auto rounded-full shadow-lg border-primary border-2">
                    <CardContent className="p-0">
                        <Button onClick={() => setIsMinimized(false)} variant="ghost" className="rounded-full h-16 px-5 flex items-center justify-center gap-2">
                            <Timer className="h-6 w-6 text-primary animate-pulse" />
                            <span className="font-mono text-lg tabular-nums">{formatElapsed(longest)}</span>
                            {!single && <span className="text-sm font-semibold text-muted-foreground">· {tasks.length} attivi</span>}
                        </Button>
                    </CardContent>
                </Card>
            )}

            <Card className={isMinimized ? 'hidden' : 'fixed bottom-4 right-4 z-50 w-80 shadow-lg animate-in slide-in-from-bottom-10'}>
                <CardHeader className="p-4">
                    <div className="flex justify-between items-start">
                        <div className="min-w-0">
                            <CardTitle className="text-lg">{single ? 'Timer Sessione' : `${tasks.length} cronometri attivi`}</CardTitle>
                            {single && <CardDescription className="truncate">{tasks[0].title}</CardDescription>}
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => setIsMinimized(true)} aria-label="Riduci">
                            <CornerDownLeft />
                        </Button>
                    </div>
                </CardHeader>
                <div className={single ? '' : 'px-4 pb-4 space-y-2 max-h-[50vh] overflow-y-auto'}>
                    {tasks.map(task => (
                        <TimerRow key={task.id} task={task} onStopped={onStop} onTick={handleTick} compact={!single} />
                    ))}
                </div>
            </Card>
        </>
    );
}
