'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLayoutData } from '@/app/(app)/layout-context';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, Pause, RotateCcw, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Task } from '@/lib/data';
import { updateTask } from '@/lib/actions';

export default function FocusModePage() {
    const params = useParams();
    const taskId = params.taskId as string;
    const { allTasks, currentUser } = useLayoutData();
    const router = useRouter();

    const task = allTasks.find((t: Task) => t.id === taskId);

    const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 min
    const [isActive, setIsActive] = useState(false);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            setIsActive(false);
            // Play alarm sound (mock)
            const audio = new Audio('/sounds/notification.mp3'); // Mock path
            audio.play().catch(() => { });
        }
        return () => clearInterval(interval);
    }, [isActive, timeLeft]);

    if (!task) return null;

    const toggleTimer = () => setIsActive(!isActive);
    const resetTimer = () => { setIsActive(false); setTimeLeft(25 * 60); };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleComplete = async () => {
        if (!currentUser) return;
        await updateTask(task.id, { status: 'Completato' as any }, currentUser.id); // Cast as any due to status enum
        window.dispatchEvent(new Event('taskCompleted'));
        router.push('/projects');
    }

    return (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col animate-in fade-in duration-300">
            {/* Header */}
            <header className="flex items-center justify-between p-6 border-b">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Esci da Focus Mode
                </Button>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Focusing on:</span>
                    <span className="font-semibold">{task.title}</span>
                </div>
                <Button variant="default" onClick={handleComplete}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Completa Task
                </Button>
            </header>

            <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Timer Section */}
                <div className="flex-1 flex flex-col items-center justify-center p-12 border-r bg-slate-50/50">
                    <div className="text-[120px] font-bold font-variant-numeric tabular-nums tracking-tighter text-slate-800 leading-none">
                        {formatTime(timeLeft)}
                    </div>
                    <div className="flex gap-4 mt-8">
                        <Button size="lg" className="rounded-full w-32 h-16 text-xl" onClick={toggleTimer}>
                            {isActive ? <Pause /> : <Play />}
                        </Button>
                        <Button size="icon" variant="outline" className="rounded-full h-16 w-16" onClick={resetTimer}>
                            <RotateCcw />
                        </Button>
                    </div>
                    <div className="mt-12 flex gap-4 text-muted-foreground">
                        <Button variant="ghost" size="sm" onClick={() => { setIsActive(false); setTimeLeft(5 * 60); }} className="rounded-full">Short Break</Button>
                        <Button variant="ghost" size="sm" onClick={() => { setIsActive(false); setTimeLeft(25 * 60); }} className="rounded-full">Pomodoro</Button>
                        <Button variant="ghost" size="sm" onClick={() => { setIsActive(false); setTimeLeft(15 * 60); }} className="rounded-full">Long Break</Button>
                    </div>
                </div>

                {/* Details Section */}
                <div className="flex-1 flex flex-col p-8 max-w-xl bg-background">
                    <h2 className="text-2xl font-bold mb-4">{task.title}</h2>
                    <p className="text-muted-foreground mb-8 whitespace-pre-wrap">{task.description || 'Nessuna descrizione.'}</p>

                    <h3 className="font-semibold mb-2">Checklist</h3>
                    <ScrollArea className="flex-1 -mx-4 px-4">
                        {/* Placeholder for subtasks/checklist */}
                        <div className="space-y-2">
                            {['Analizza requisiti', 'Sviluppa soluzione', 'Testa funzionalità', 'Documenta modifiche'].map((item, i) => (
                                <div key={i} className="flex items-center space-x-2 p-2 rounded hover:bg-slate-50">
                                    <Checkbox id={`todo-${i}`} />
                                    <label htmlFor={`todo-${i}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                        {item}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </main>
        </div>
    );
}
