
'use client';

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { deleteAttachment } from '@/lib/actions';
import type { Task, Attachment, Client, Project, User, ActivityType } from '@/lib/data';
import { Download, FileText, Trash2, Filter } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useLayoutData } from '@/app/(app)/layout-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';

export default function DocumentsPage() {
  const {
    clients,
    users,
    allTasks,
    allProjects,
    activityTypes,
    isLoadingLayout
  } = useLayoutData();


  const [attachmentToDelete, setAttachmentToDelete] = useState<{ taskId: string, url: string, filename: string } | null>(null);

  const [filters, setFilters] = useState({
    clientId: 'all',
    projectId: 'all',
    userId: 'all',
    activityType: 'all',
  });


  const { toast } = useToast();

  const allAttachments = useMemo(() =>
    allTasks.flatMap((task) =>
      (task.attachments || []).map((att) => ({
        ...att,
        taskTitle: task.title,
        taskId: task.id,
        clientId: task.clientId,
        projectId: task.projectId,
        assignedUserId: task.assignedUserId,
        activityType: task.activityType,
      }))
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [allTasks]);

  const filteredAttachments = useMemo(() => {
    return allAttachments.filter(att => {
      const clientMatch = filters.clientId === 'all' || att.clientId === filters.clientId;
      const projectMatch = filters.projectId === 'all' || att.projectId === filters.projectId;
      const userMatch = filters.userId === 'all' || att.assignedUserId === filters.userId;
      const activityMatch = filters.activityType === 'all' || att.activityType === filters.activityType;
      return clientMatch && projectMatch && userMatch && activityMatch;
    });
  }, [allAttachments, filters]);

  const handleFilterChange = (filterName: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const resetFilters = () => {
    setFilters({
      clientId: 'all',
      projectId: 'all',
      userId: 'all',
      activityType: 'all',
    });
  };

  const handleDeleteAttachment = async () => {
    if (!attachmentToDelete) return;
    const { taskId, url, filename } = attachmentToDelete;

    try {
      await deleteAttachment(taskId, url);
      toast({ title: 'File eliminato', description: `"${filename}" è stato rimosso.` });
    } catch (error) {
      console.error("Failed to delete attachment:", error);
      toast({ title: 'Errore', description: 'Impossibile eliminare il file.', variant: 'destructive' });
    } finally {
      setAttachmentToDelete(null);
    }
  };

  if (isLoadingLayout) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const projectsForFilter = filters.clientId === 'all'
    ? allProjects
    : allProjects.filter(p => p.clientId === filters.clientId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" />Filtri Archivio</CardTitle>
          <CardDescription>Cerca tra i documenti utilizzando i filtri sottostanti.</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <Label htmlFor="client-filter">Cliente</Label>
            <Select value={filters.clientId} onValueChange={(v) => handleFilterChange('clientId', v)}>
              <SelectTrigger id="client-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i Clienti</SelectItem>
                {[...clients].sort((a, b) => a.name.localeCompare(b.name)).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="project-filter">Progetto</Label>
            <Select value={filters.projectId} onValueChange={(v) => handleFilterChange('projectId', v)}>
              <SelectTrigger id="project-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i Progetti</SelectItem>
                {[...projectsForFilter].sort((a, b) => a.name.localeCompare(b.name)).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="user-filter">Utente</Label>
            <Select value={filters.userId} onValueChange={(v) => handleFilterChange('userId', v)}>
              <SelectTrigger id="user-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli Utenti</SelectItem>
                {[...users].sort((a, b) => a.name.localeCompare(b.name)).map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="activity-filter">Attività</Label>
            <Select value={filters.activityType} onValueChange={(v) => handleFilterChange('activityType', v)}>
              <SelectTrigger id="activity-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le Attività</SelectItem>
                {[...activityTypes].sort((a, b) => a.name.localeCompare(b.name)).map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="ghost" onClick={resetFilters} className="w-full">Pulisci Filtri</Button>
          </div>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Archivio Documenti</CardTitle>
          <CardDescription>
            {filteredAttachments.length} file trovati in base ai filtri applicati.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Tipo</TableHead>
                <TableHead>Nome File</TableHead>
                <TableHead className="hidden sm:table-cell">Task Associato</TableHead>
                <TableHead className="hidden md:table-cell">Data Caricamento</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Azioni</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAttachments.map((att, index) => (
                <TableRow key={`${att.taskId}-${index}`}>
                  <TableCell>
                    <FileText className="w-6 h-6 text-muted-foreground" />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{att.filename}</div>
                    <div className="text-sm text-muted-foreground">
                      {(att as any).description || 'Nessuna descrizione'}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {att.taskTitle}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {new Date(att.date).toLocaleDateString('it-IT')}
                  </TableCell>
                  <TableCell className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" asChild>
                      <a href={att.url} target="_blank" rel="noopener noreferrer">
                        <Download className="w-4 h-4 mr-2" />
                        Visualizza
                      </a>
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setAttachmentToDelete({ taskId: att.taskId, url: att.url, filename: att.filename })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredAttachments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Nessun documento trovato per i filtri selezionati.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!attachmentToDelete} onOpenChange={() => setAttachmentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. Questo eliminerà permanentemente il file <span className="font-bold">"{attachmentToDelete?.filename}"</span> dal task associato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAttachmentToDelete(null)}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAttachment} className="bg-destructive hover:bg-destructive/90">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
