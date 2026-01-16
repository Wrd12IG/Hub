'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
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

    const formatTime = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return [hours, minutes, seconds].map(v => v.toString().padStart(2, '0')).join(':');
    };

    const saveTime = useCallback(async (timeToSave: number) => {
        if (timeToSave <= 0) return;

        try {
            await stopTaskTimer(task.id, timeToSave);
            toast.success(`Sessione terminata! Registrati ${formatTime(timeToSave)}.`);
        } catch (error) {
            console.error('Error stopping timer:', error);
            toast.error("Errore nel salvataggio del tempo.");
        }
    }, [task.id]);

    useEffect(() => {
        startTimeRef.current = Date.now();

        // Save timer start to Firestore for global visibility
        if (currentUser) {
            startTaskTimer(task.id, currentUser.id).catch(console.error);
        }

        intervalRef.current = setInterval(() => {
            setElapsedSeconds(Math.floor((Date.now() - (startTimeRef.current || 0)) / 1000));
        }, 1000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [task.id, currentUser]);

    const handleStop = async () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        // Play timer completion sound
        if (soundSettings.enabled && soundSettings.timerSound) {
            playSound('timer', soundSettings.volume);
        }

        await saveTime(elapsedSeconds);
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
