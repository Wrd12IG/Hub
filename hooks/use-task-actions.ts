'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { updateTask, deleteTask, uploadFilesAndGetAttachments } from '@/lib/actions';
import type { Task, User, Attachment } from '@/lib/data';
import { playSound } from '@/lib/sounds';

export interface UseTaskActionsOptions {
    currentUser: User | null;
    canApprove: boolean;
    onTaskUpdated?: (task: Task) => void;
    onTaskDeleted?: (taskId: string) => void;
}

export function useTaskActions({
    currentUser,
    canApprove,
    onTaskUpdated,
    onTaskDeleted,
}: UseTaskActionsOptions) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Send task for approval
    const sendForApproval = useCallback(async (
        task: Task,
        options?: { attachment?: { url?: string; file?: File; filename?: string } }
    ) => {
        if (!currentUser) {
            toast.error('Utente non autenticato');
            return false;
        }

        setIsSubmitting(true);

        try {
            let updatedAttachments = [...(task.attachments || [])];

            // Handle attachment upload if provided
            if (options?.attachment?.file) {
                const uploadedAttachments = await uploadFilesAndGetAttachments(
                    [options.attachment.file],
                    `tasks/${task.id}/approvals`,
                    currentUser.id
                );

                if (uploadedAttachments.length > 0) {
                    updatedAttachments.push({
                        ...uploadedAttachments[0],
                        documentType: 'Approvazione',
                    });
                }
            } else if (options?.attachment?.url) {
                updatedAttachments.push({
                    url: options.attachment.url,
                    filename: options.attachment.filename || 'Link allegato',
                    date: new Date().toISOString(),
                    userId: currentUser.id,
                    version: 1,
                    documentType: 'Approvazione',
                });
            }

            await updateTask(
                task.id,
                {
                    status: 'In Approvazione',
                    attachments: updatedAttachments,
                },
                currentUser.id,
                canApprove,
                true
            );

            toast.success('Task inviato in approvazione');
            playSound('success');
            return true;
        } catch (error: any) {
            console.error('Failed to send for approval:', error);
            toast.error(error.message || 'Impossibile inviare il task in approvazione');
            playSound('error');
            return false;
        } finally {
            setIsSubmitting(false);
        }
    }, [currentUser, canApprove]);

    // Approve a task
    const approveTask = useCallback(async (task: Task, sendEmail: boolean = true) => {
        if (!currentUser) {
            toast.error('Utente non autenticato');
            return false;
        }

        if (!canApprove) {
            toast.error('Non hai i permessi per approvare questo task');
            return false;
        }

        setIsSubmitting(true);

        try {
            const newApproval = {
                userId: currentUser.id,
                timestamp: new Date().toISOString(),
            };

            const existingApprovals = task.approvals || [];
            const updatedApprovals = [...existingApprovals, newApproval];

            // Check if two-step approval is required
            const needsSecondApproval = task.requiresTwoStepApproval && updatedApprovals.length < 2;

            await updateTask(
                task.id,
                {
                    status: needsSecondApproval ? 'In Approvazione' : 'Approvato',
                    approvals: updatedApprovals,
                },
                currentUser.id,
                canApprove,
                sendEmail
            );

            if (needsSecondApproval) {
                toast.success('Prima approvazione registrata. In attesa del secondo approvatore.');
            } else {
                toast.success('Task approvato con successo!');
                playSound('success');
            }

            return true;
        } catch (error: any) {
            console.error('Failed to approve task:', error);
            toast.error(error.message || 'Impossibile approvare il task');
            playSound('error');
            return false;
        } finally {
            setIsSubmitting(false);
        }
    }, [currentUser, canApprove]);

    // Reject a task
    const rejectTask = useCallback(async (
        task: Task,
        reason: string,
        sendEmail: boolean = true
    ) => {
        if (!currentUser) {
            toast.error('Utente non autenticato');
            return false;
        }

        if (!canApprove) {
            toast.error('Non hai i permessi per rifiutare questo task');
            return false;
        }

        if (!reason.trim()) {
            toast.error('Inserisci un motivo per il rifiuto');
            return false;
        }

        setIsSubmitting(true);

        try {
            // Remove approval attachments when rejecting
            const cleanedAttachments = (task.attachments || []).filter(
                (att: Attachment) => att.documentType !== 'Approvazione'
            );

            await updateTask(
                task.id,
                {
                    status: 'In Lavorazione',
                    rejectionReason: reason,
                    approvals: [], // Clear any partial approvals
                    attachments: cleanedAttachments,
                },
                currentUser.id,
                canApprove,
                sendEmail
            );

            toast.success('Task rifiutato. L\'assegnatario riceverà una notifica.');
            playSound('task_rejected');
            return true;
        } catch (error: any) {
            console.error('Failed to reject task:', error);
            toast.error(error.message || 'Impossibile rifiutare il task');
            playSound('error');
            return false;
        } finally {
            setIsSubmitting(false);
        }
    }, [currentUser, canApprove]);

    // Delete a task
    const removeTask = useCallback(async (taskId: string) => {
        if (!currentUser) {
            toast.error('Utente non autenticato');
            return false;
        }

        setIsSubmitting(true);

        try {
            await deleteTask(taskId, currentUser.id);
            toast.success('Task eliminato con successo');
            onTaskDeleted?.(taskId);
            return true;
        } catch (error: any) {
            console.error('Failed to delete task:', error);
            toast.error(error.message || 'Impossibile eliminare il task');
            return false;
        } finally {
            setIsSubmitting(false);
        }
    }, [currentUser, onTaskDeleted]);

    // Update task status quickly
    const quickUpdateStatus = useCallback(async (
        task: Task,
        newStatus: Task['status']
    ) => {
        if (!currentUser) {
            toast.error('Utente non autenticato');
            return false;
        }

        setIsSubmitting(true);

        try {
            await updateTask(
                task.id,
                { status: newStatus },
                currentUser.id,
                canApprove,
                false // Don't send email for quick status updates
            );

            toast.success(`Stato aggiornato a "${newStatus}"`);
            return true;
        } catch (error: any) {
            console.error('Failed to update status:', error);
            toast.error(error.message || 'Impossibile aggiornare lo stato');
            return false;
        } finally {
            setIsSubmitting(false);
        }
    }, [currentUser, canApprove]);

    return {
        isSubmitting,
        sendForApproval,
        approveTask,
        rejectTask,
        removeTask,
        quickUpdateStatus,
    };
}
