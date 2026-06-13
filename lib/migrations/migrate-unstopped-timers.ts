'use client';

/**
 * Script di migrazione per recuperare il tempo dei timer non fermati.
 * 
 * Problema: Se un task veniva inviato in approvazione con il timer attivo,
 * il tempo non veniva salvato e timerStartedAt rimaneva nel database.
 * 
 * Questo script:
 * 1. Trova tutti i task Approvati/Annullati che hanno ancora `timerStartedAt`
 * 2. Calcola il tempo trascorso tra timerStartedAt e la data di approvazione/annullamento
 * 3. Aggiunge questo tempo a `timeSpent`
 * 4. Rimuove `timerStartedAt` e `timerUserId`
 */

import { db } from '@/lib/firebase';
import { collection, getDocs, updateDoc, doc, Timestamp, deleteField } from 'firebase/firestore';

export interface TimerMigrationResult {
    success: boolean;
    totalTasks: number;
    tasksWithActiveTimer: number;
    migratedCount: number;
    skippedCount: number;
    totalTimeRecovered: number; // in secondi
    errors: string[];
    migratedTasks: Array<{
        id: string;
        title: string;
        status: string;
        timerStartedAt: string;
        endDate: string;
        timeRecovered: number;
        previousTimeSpent: number;
        newTimeSpent: number;
    }>;
}

export async function migrateUnstoppedTimers(): Promise<TimerMigrationResult> {
    const result: TimerMigrationResult = {
        success: false,
        totalTasks: 0,
        tasksWithActiveTimer: 0,
        migratedCount: 0,
        skippedCount: 0,
        totalTimeRecovered: 0,
        errors: [],
        migratedTasks: []
    };

    try {
        // Leggi tutti i task
        const tasksSnapshot = await getDocs(collection(db, 'tasks'));
        result.totalTasks = tasksSnapshot.size;

        console.log(`[Timer Migration] Trovati ${result.totalTasks} task totali`);

        for (const taskDoc of tasksSnapshot.docs) {
            const taskData = taskDoc.data();
            const taskId = taskDoc.id;

            // Controlla se il task ha timerStartedAt ed è Approvato o Annullato
            if (taskData.timerStartedAt &&
                (taskData.status === 'Approvato' || taskData.status === 'Annullato')) {

                result.tasksWithActiveTimer++;

                try {
                    // Converti timerStartedAt in Date
                    let timerStart: Date;
                    if (taskData.timerStartedAt instanceof Timestamp) {
                        timerStart = taskData.timerStartedAt.toDate();
                    } else if (typeof taskData.timerStartedAt === 'string') {
                        timerStart = new Date(taskData.timerStartedAt);
                    } else {
                        console.log(`[Timer Migration] ⏭️ Task ${taskId}: formato timerStartedAt non valido`);
                        result.skippedCount++;
                        continue;
                    }

                    // Determina la data di fine (approvazione o annullamento)
                    let endDate: Date | null = null;
                    let endDateSource = '';

                    if (taskData.status === 'Approvato') {
                        // Usa la data dell'ultima approvazione
                        if (taskData.approvals && taskData.approvals.length > 0) {
                            const lastApproval = taskData.approvals[taskData.approvals.length - 1];
                            if (lastApproval.timestamp) {
                                endDate = new Date(lastApproval.timestamp);
                                endDateSource = 'approvals';
                            }
                        }
                    } else if (taskData.status === 'Annullato') {
                        // Usa cancelledAt se disponibile
                        if (taskData.cancelledAt) {
                            endDate = new Date(taskData.cancelledAt);
                            endDateSource = 'cancelledAt';
                        }
                    }

                    // Fallback su updatedAt
                    if (!endDate && taskData.updatedAt) {
                        if (taskData.updatedAt instanceof Timestamp) {
                            endDate = taskData.updatedAt.toDate();
                        } else if (typeof taskData.updatedAt === 'string') {
                            endDate = new Date(taskData.updatedAt);
                        }
                        endDateSource = 'updatedAt';
                    }

                    if (!endDate) {
                        console.log(`[Timer Migration] ⏭️ Task ${taskId}: nessuna data di fine trovata`);
                        result.skippedCount++;
                        continue;
                    }

                    // Calcola il tempo trascorso
                    const elapsedMs = endDate.getTime() - timerStart.getTime();

                    // Verifica che il tempo sia positivo e ragionevole (max 24 ore per sessione)
                    if (elapsedMs <= 0) {
                        console.log(`[Timer Migration] ⏭️ Task ${taskId}: tempo negativo, saltato`);
                        result.skippedCount++;
                        continue;
                    }

                    let elapsedSeconds = Math.floor(elapsedMs / 1000);

                    // Cap a 24 ore (86400 secondi) per evitare valori assurdi
                    const MAX_SESSION_SECONDS = 24 * 60 * 60;
                    if (elapsedSeconds > MAX_SESSION_SECONDS) {
                        console.log(`[Timer Migration] ⚠️ Task ${taskId}: tempo > 24h, limitato a 24h`);
                        elapsedSeconds = MAX_SESSION_SECONDS;
                    }

                    // Calcola nuovo timeSpent
                    const previousTimeSpent = taskData.timeSpent || 0;
                    const newTimeSpent = previousTimeSpent + elapsedSeconds;

                    // Aggiorna il task
                    await updateDoc(doc(db, 'tasks', taskId), {
                        timeSpent: newTimeSpent,
                        timerStartedAt: deleteField(),
                        timerUserId: deleteField()
                    });

                    result.migratedCount++;
                    result.totalTimeRecovered += elapsedSeconds;
                    result.migratedTasks.push({
                        id: taskId,
                        title: taskData.title || 'Senza titolo',
                        status: taskData.status,
                        timerStartedAt: timerStart.toISOString(),
                        endDate: endDate.toISOString(),
                        timeRecovered: elapsedSeconds,
                        previousTimeSpent,
                        newTimeSpent
                    });

                    console.log(`[Timer Migration] ✅ Task ${taskId}: recuperati ${Math.round(elapsedSeconds / 60)} minuti (da ${endDateSource})`);

                } catch (error) {
                    const errorMsg = `Errore migrando task ${taskId}: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`;
                    result.errors.push(errorMsg);
                    console.error(`[Timer Migration] ❌ ${errorMsg}`);
                }
            }
        }

        result.success = result.errors.length === 0;
        console.log(`[Timer Migration] Completata! Migrati: ${result.migratedCount}, Saltati: ${result.skippedCount}, Errori: ${result.errors.length}`);
        console.log(`[Timer Migration] Tempo totale recuperato: ${Math.round(result.totalTimeRecovered / 3600)} ore ${Math.round((result.totalTimeRecovered % 3600) / 60)} minuti`);

    } catch (error) {
        const errorMsg = `Errore generale nella migrazione: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`;
        result.errors.push(errorMsg);
        console.error(`[Timer Migration] ❌ ${errorMsg}`);
    }

    return result;
}

// Funzione per preview senza modifiche
export async function previewUnstoppedTimers(): Promise<{
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
}> {
    const tasksToMigrate: Array<{
        id: string;
        title: string;
        status: string;
        timerStartedAt: string;
        estimatedEndDate?: string;
        estimatedTimeToRecover: number;
        currentTimeSpent: number;
    }> = [];
    let totalEstimatedTime = 0;

    try {
        const tasksSnapshot = await getDocs(collection(db, 'tasks'));

        for (const taskDoc of tasksSnapshot.docs) {
            const taskData = taskDoc.data();

            if (taskData.timerStartedAt &&
                (taskData.status === 'Approvato' || taskData.status === 'Annullato')) {

                // Converti timerStartedAt
                let timerStart: Date;
                if (taskData.timerStartedAt instanceof Timestamp) {
                    timerStart = taskData.timerStartedAt.toDate();
                } else if (typeof taskData.timerStartedAt === 'string') {
                    timerStart = new Date(taskData.timerStartedAt);
                } else {
                    continue;
                }

                // Determina la data di fine stimata
                let endDate: Date | null = null;

                if (taskData.status === 'Approvato' && taskData.approvals?.length > 0) {
                    const lastApproval = taskData.approvals[taskData.approvals.length - 1];
                    if (lastApproval.timestamp) {
                        endDate = new Date(lastApproval.timestamp);
                    }
                } else if (taskData.status === 'Annullato' && taskData.cancelledAt) {
                    endDate = new Date(taskData.cancelledAt);
                }

                if (!endDate && taskData.updatedAt) {
                    if (taskData.updatedAt instanceof Timestamp) {
                        endDate = taskData.updatedAt.toDate();
                    } else if (typeof taskData.updatedAt === 'string') {
                        endDate = new Date(taskData.updatedAt);
                    }
                }

                let estimatedTime = 0;
                if (endDate) {
                    estimatedTime = Math.floor((endDate.getTime() - timerStart.getTime()) / 1000);
                    // Cap a 24 ore
                    if (estimatedTime > 24 * 60 * 60) {
                        estimatedTime = 24 * 60 * 60;
                    }
                    if (estimatedTime > 0) {
                        totalEstimatedTime += estimatedTime;
                    }
                }

                tasksToMigrate.push({
                    id: taskDoc.id,
                    title: taskData.title || 'Senza titolo',
                    status: taskData.status,
                    timerStartedAt: timerStart.toISOString(),
                    estimatedEndDate: endDate?.toISOString(),
                    estimatedTimeToRecover: Math.max(0, estimatedTime),
                    currentTimeSpent: taskData.timeSpent || 0
                });
            }
        }

    } catch (error) {
        console.error('[Timer Migration Preview] Errore:', error);
    }

    return {
        tasksToMigrate,
        count: tasksToMigrate.length,
        totalEstimatedTime
    };
}

// Helper per formattare il tempo
export function formatDuration(seconds: number): string {
    if (seconds <= 0) return '0 min';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
}
