'use client';

/**
 * Script di migrazione per popolare il campo `cancelledAt` sui task già annullati.
 * 
 * Questo script:
 * 1. Trova tutti i task con status "Annullato" che non hanno il campo `cancelledAt`
 * 2. Imposta `cancelledAt` uguale a `updatedAt` (o alla data corrente se manca anche updatedAt)
 * 
 * Eseguire dalla pagina Admin > Dashboard cliccando sul pulsante apposito
 * oppure dalla console del browser.
 */

import { db } from '@/lib/firebase';
import { collection, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';

export interface MigrationResult {
    success: boolean;
    totalTasks: number;
    migratedCount: number;
    skippedCount: number;
    errors: string[];
    migratedTaskIds: string[];
}

export async function migrateCancelledTasksDates(): Promise<MigrationResult> {
    const result: MigrationResult = {
        success: false,
        totalTasks: 0,
        migratedCount: 0,
        skippedCount: 0,
        errors: [],
        migratedTaskIds: []
    };

    try {
        // Leggi tutti i task
        const tasksSnapshot = await getDocs(collection(db, 'tasks'));
        result.totalTasks = tasksSnapshot.size;

        console.log(`[Migration] Trovati ${result.totalTasks} task totali`);

        for (const taskDoc of tasksSnapshot.docs) {
            const taskData = taskDoc.data();
            const taskId = taskDoc.id;

            // Controlla se il task è annullato e non ha cancelledAt
            if (taskData.status === 'Annullato' && !taskData.cancelledAt) {
                try {
                    // Usa updatedAt se disponibile, altrimenti createdAt, altrimenti la data corrente
                    let cancelledAtValue: string;

                    if (taskData.updatedAt) {
                        // Se updatedAt è un Timestamp Firestore, convertilo
                        if (taskData.updatedAt instanceof Timestamp) {
                            cancelledAtValue = taskData.updatedAt.toDate().toISOString();
                        } else if (typeof taskData.updatedAt === 'string') {
                            cancelledAtValue = taskData.updatedAt;
                        } else {
                            cancelledAtValue = new Date().toISOString();
                        }
                    } else if (taskData.createdAt) {
                        // Fallback su createdAt
                        if (taskData.createdAt instanceof Timestamp) {
                            cancelledAtValue = taskData.createdAt.toDate().toISOString();
                        } else if (typeof taskData.createdAt === 'string') {
                            cancelledAtValue = taskData.createdAt;
                        } else {
                            cancelledAtValue = new Date().toISOString();
                        }
                    } else {
                        // Ultimo fallback: data corrente
                        cancelledAtValue = new Date().toISOString();
                    }

                    // Aggiorna il task con cancelledAt
                    await updateDoc(doc(db, 'tasks', taskId), {
                        cancelledAt: cancelledAtValue
                    });

                    result.migratedCount++;
                    result.migratedTaskIds.push(taskId);
                    console.log(`[Migration] ✅ Task ${taskId} migrato con cancelledAt: ${cancelledAtValue}`);

                } catch (error) {
                    const errorMsg = `Errore migrando task ${taskId}: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`;
                    result.errors.push(errorMsg);
                    console.error(`[Migration] ❌ ${errorMsg}`);
                }
            } else if (taskData.status === 'Annullato' && taskData.cancelledAt) {
                // Task già ha cancelledAt
                result.skippedCount++;
                console.log(`[Migration] ⏭️ Task ${taskId} già ha cancelledAt, saltato`);
            }
        }

        result.success = result.errors.length === 0;
        console.log(`[Migration] Completata! Migrati: ${result.migratedCount}, Saltati: ${result.skippedCount}, Errori: ${result.errors.length}`);

    } catch (error) {
        const errorMsg = `Errore generale nella migrazione: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`;
        result.errors.push(errorMsg);
        console.error(`[Migration] ❌ ${errorMsg}`);
    }

    return result;
}

// Funzione per eseguire la migrazione in modo dry-run (solo preview, senza modifiche)
export async function previewCancelledTasksMigration(): Promise<{
    tasksToMigrate: Array<{ id: string; title: string; updatedAt?: string; createdAt?: string }>;
    count: number;
}> {
    const tasksToMigrate: Array<{ id: string; title: string; updatedAt?: string; createdAt?: string }> = [];

    try {
        const tasksSnapshot = await getDocs(collection(db, 'tasks'));

        for (const taskDoc of tasksSnapshot.docs) {
            const taskData = taskDoc.data();

            if (taskData.status === 'Annullato' && !taskData.cancelledAt) {
                let updatedAt = taskData.updatedAt;
                let createdAt = taskData.createdAt;

                // Converti Timestamp se necessario
                if (updatedAt instanceof Timestamp) {
                    updatedAt = updatedAt.toDate().toISOString();
                }
                if (createdAt instanceof Timestamp) {
                    createdAt = createdAt.toDate().toISOString();
                }

                tasksToMigrate.push({
                    id: taskDoc.id,
                    title: taskData.title || 'Senza titolo',
                    updatedAt,
                    createdAt
                });
            }
        }

    } catch (error) {
        console.error('[Migration Preview] Errore:', error);
    }

    return {
        tasksToMigrate,
        count: tasksToMigrate.length
    };
}
