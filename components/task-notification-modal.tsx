'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLayoutData } from '@/app/(app)/layout-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { markNotificationsAsRead, getClients, getProject } from '@/lib/actions';
import type { Client, Notification, Project, Task } from '@/lib/data';
import { BellRing } from 'lucide-react';

interface TaskNotificationModalProps {
    notificationPayload: { notification: Notification; entity: Task | Project } | null;
    onClose: () => void;
}

export function TaskNotificationModal({ notificationPayload, onClose }: TaskNotificationModalProps) {
    const { currentUser } = useLayoutData();
    const router = useRouter();
    const [clients, setClients] = useState<Client[]>([]);

    useEffect(() => {
        getClients().then(setClients);
    }, []);

    const handleClose = () => {
        if (currentUser && notificationPayload) {
            markNotificationsAsRead(currentUser.id, [notificationPayload.notification.id]);
        }
        onClose();
    };

    const handleGoToEntity = () => {
        if (notificationPayload && notificationPayload.notification.link) {
            router.push(notificationPayload.notification.link);
        }
        handleClose();
    };

    if (!notificationPayload) {
        return null;
    }

    const { notification, entity } = notificationPayload;
    const isTask = 'dueDate' in entity;
    const client = clients.find(c => c.id === entity.clientId);

    const title = notification.type === 'task_assigned' ? "Nuovo Task Assegnato" : "Aggiornamento Task";
    const entityName = isTask ? (entity as Task).title : (entity as Project).name;
    const entityLabel = isTask ? "Task" : "Progetto";
    const status = isTask ? (entity as Task).status : (entity as Project).status;

    return (
        <Dialog open={!!notificationPayload} onOpenChange={(isOpen) => !isOpen && handleClose()}>
            <DialogContent className="sm:max-w-md border-primary border-2">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BellRing className="text-primary animate-pulse" />
                        {title}
                    </DialogTitle>
                    <DialogDescription>
                        {notification.text}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-4 text-sm">
                    <div>
                        <h4 className="font-semibold text-muted-foreground">{entityLabel}:</h4>
                        <p className="font-medium">{entityName}</p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-muted-foreground">Cliente:</h4>
                        <p>{client?.name || 'N/D'}</p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-muted-foreground">Stato Attuale:</h4>
                        <p>{status}</p>
                    </div>
                </div>
                <DialogFooter className="sm:justify-between gap-2">
                    <Button variant="ghost" onClick={handleClose}>Chiudi</Button>
                    <Button onClick={handleGoToEntity}>Vai ai Dettagli</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
