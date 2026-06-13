'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Square, CornerDownLeft, Timer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Task } from '@/lib/data';
import { useLayoutData } from '@/app/(app)/layout-context';
import { startTaskTimer, stopTaskTimer } from '@/lib/actions';
import { toast } from 'sonner';
import { playSound } from '@/lib/sounds';

interface PomodoroWidgetProps {
    task: Task;
    onClose: () => void;
}

export default function PomodoroWidget({ task, onClose }: PomodoroWidgetProps) {
    const { currentUser, soundSettings } = useLayoutData();
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [isMinimized, setIsMinimized] = useState(false);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number | null>(null);
    // Ref per uso nel cleanup (evita closure stale su elapsedSeconds)
    const elapsedSecondsRef = useRef(0);
    // Flag: evita doppio salvataggio se handleStop è già stato chiamato prima del cleanup
    const cleanupRanRef = useRef(false);

    const formatTime = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return [hours, minutes, seconds].map(v => v.toString().padStart(2, '0')).join(':');
    };

    useEffect(() => {
        startTimeRef.current = Date.now();
        cleanupRanRef.current = false;

        // Salva l'avvio del timer su Firestore per visibilità globale
        if (currentUser) {
            startTaskTimer(task.id, currentUser.id).catch(console.error);
        }

        intervalRef.current = setInterval(() => {
            const elapsed = Math.floor((Date.now() - (startTimeRef.current || 0)) / 1000);
            setElapsedSeconds(elapsed);
            elapsedSecondsRef.current = elapsed; // Aggiorna sempre il ref
        }, 1000);

        // Safety net: salva il tempo quando il componente viene smontato senza handleStop esplicito
        // (es. navigazione pagina, refresh, o setPomodoroTask(null) chiamato dall'esterno).
        // Il flag cleanupRanRef evita il doppio salvataggio quando handleStop viene chiamato prima.
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }

            if (cleanupRanRef.current) return; // Il tempo è già stato salvato
            cleanupRanRef.current = true;

            // Fire-and-forget: non possiamo usare await nel cleanup di useEffect
            const elapsed = elapsedSecondsRef.current;
            if (elapsed > 0) {
                stopTaskTimer(task.id, elapsed).catch(console.error);
            }
        };
    }, [task.id, currentUser]);

    const handleStop = async () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        // Marca come già salvato per evitare doppio salvataggio nel cleanup
        cleanupRanRef.current = true;

        // Suono di completamento
        if (soundSettings.enabled && soundSettings.timerSound) {
            playSound('timer', soundSettings.volume);
        }

        const timeToSave = elapsedSecondsRef.current;
        if (timeToSave > 0) {
            try {
                await stopTaskTimer(task.id, timeToSave);
                toast.success(`Sessione terminata! Registrati ${formatTime(timeToSave)}.`);
            } catch (error) {
                console.error('Error stopping timer:', error);
                toast.error("Errore nel salvataggio del tempo.");
                cleanupRanRef.current = false; // Permetti retry via cleanup
            }
        }

        onClose();
    };

    if (isMinimized) {
        return (
            <Card className="fixed bottom-4 right-4 z-50 w-auto rounded-full shadow-lg border-primary border-2">
                <CardContent className="p-0">
                    <Button
                        onClick={() => setIsMinimized(false)}
                        variant="ghost"
                        className="rounded-full h-16 w-36 flex items-center justify-center gap-2"
                    >
                        <Timer className="h-6 w-6 text-primary animate-pulse" />
                        <span className="font-mono text-lg">{formatTime(elapsedSeconds)}</span>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="fixed bottom-4 right-4 z-50 w-80 shadow-lg animate-in slide-in-from-bottom-10">
            <CardHeader className="p-4">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-lg">Timer Sessione</CardTitle>
                        <CardDescription className="truncate">{task.title}</CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => setIsMinimized(true)}>
                        <CornerDownLeft />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-4 text-center bg-secondary">
                <p className="text-6xl font-bold font-mono text-foreground">
                    {formatTime(elapsedSeconds)}
                </p>
            </CardContent>
            <CardFooter className="p-4 flex justify-center gap-4">
                <Button
                    onClick={handleStop}
                    size="lg"
                    variant="destructive"
                    className="w-20 h-20 rounded-full shadow-md"
                >
                    <Square className="w-8 h-8" />
                </Button>
            </CardFooter>
        </Card>
    );
}
