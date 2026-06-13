'use client';

import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { addAbsence, deleteAbsence } from '@/lib/actions';
import type { Absence, User } from '@/lib/data';
import { allAbsenceTypes } from '@/lib/data';
import { format, isWithinInterval, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { PlusCircle, Trash2, Filter, Users, CalendarCheck, CalendarClock, Eraser } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useLayoutData } from '@/app/(app)/layout-context';
import { getInitials } from '@/lib/utils';


const IS_ADMIN = true; // Placeholder for role check

const statusColors: { [key: string]: string } = {
  'Approvato': 'bg-green-500 text-white',
  'In Attesa': 'bg-yellow-500 text-white',
  'Rifiutato': 'bg-red-500 text-white',
};


export default function AbsencesPage() {
  const { currentUser, users, absences, usersById, isLoadingLayout } = useLayoutData();
  const [absenceToDelete, setAbsenceToDelete] = useState<Absence | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => {
    // This ensures new Date() is only called on the client side, avoiding hydration errors.
    setToday(new Date());
  }, []);

  const [filters, setFilters] = useState({
    userId: 'all',
    type: 'all',
    startDate: '',
    endDate: '',
  });

  const handleFilterChange = (filterName: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const resetFilters = () => {
    setFilters({ userId: 'all', type: 'all', startDate: '', endDate: '' });
  };

  const filteredAbsences = useMemo(() => {
    return absences.filter(absence => {
      const userMatch = filters.userId === 'all' || absence.userId === filters.userId;
      const typeMatch = filters.type === 'all' || absence.type === filters.type;
      const startDateMatch = !filters.startDate || new Date(absence.startDate) >= new Date(filters.startDate);
      const endDateMatch = !filters.endDate || new Date(absence.endDate) <= new Date(absence.endDate);
      return userMatch && typeMatch && startDateMatch && endDateMatch;
    });
  }, [absences, filters]);

  const kpis = useMemo(() => {
    if (!today) {
      return { total: absences.length, absentToday: 0, upcomingAbsences: 0 };
    }

    const absentToday = absences.filter(a =>
      a.status === 'Approvato' && isWithinInterval(today, { start: parseISO(a.startDate), end: parseISO(a.endDate) })
    ).length;

    const upcomingAbsences = absences.filter(a =>
      new Date(a.startDate) > today
    ).length;

    return {
      total: absences.length,
      absentToday,
      upcomingAbsences,
    };
  }, [absences, today]);


  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser) {
      toast({ title: "Errore", description: "Utente non autenticato.", variant: "destructive" });
      return;
    }
    const formData = new FormData(event.currentTarget);

    const startDate = new Date(formData.get('startDate') as string);
    const endDate = new Date(formData.get('endDate') as string);

    if (endDate < startDate) {
      toast({ title: "Errore di validazione", description: "La data di fine non può essere precedente alla data di inizio.", variant: "destructive" });
      return;
    }

    try {
      const newAbsence: Omit<Absence, 'id'> = {
        userId: currentUser.id,
        type: formData.get('type') as Absence['type'],
        status: 'Approvato', // Auto-approved
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        notes: formData.get('notes') as string,
      };
      await addAbsence(newAbsence);
      toast({ title: "Successo", description: "Assenza registrata con successo." });
      handleCloseModal();
    } catch (error) {
      console.error("Failed to submit absence request:", error);
      toast({ title: "Errore", description: "Impossibile registrare l'assenza.", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!absenceToDelete) return;
    try {
      await deleteAbsence(absenceToDelete.id);
      toast({ title: "Successo", description: "Richiesta di assenza eliminata." });
      setAbsenceToDelete(null);
    } catch (e) {
      console.error("Failed to delete absence:", e);
      toast({ title: "Errore", description: "Impossibile eliminare la richiesta.", variant: "destructive" });
    }
  }

  if (isLoadingLayout) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Gestione Assenze</h1>
          <p className="text-muted-foreground">Aggiungi, visualizza e gestisci i periodi di assenza.</p>
        </div>
        <Button onClick={handleOpenModal}>
          <PlusCircle />
          Aggiungi Assenza
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assenze Totali</CardTitle>
            <Users />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utenti Assenti Oggi</CardTitle>
            <CalendarCheck />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.absentToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prossime Assenze</CardTitle>
            <CalendarClock />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.upcomingAbsences}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter /> Filtri</CardTitle>
          <CardDescription>Affina la ricerca delle assenze.</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label>Utente</Label>
            <Select value={filters.userId} onValueChange={v => handleFilterChange('userId', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli utenti</SelectItem>
                {[...users].sort((a, b) => a.name.localeCompare(b.name)).map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={filters.type} onValueChange={v => handleFilterChange('type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i tipi</SelectItem>
                {[...allAbsenceTypes].sort().map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Dal</Label>
              <Input type="date" value={filters.startDate} onChange={e => handleFilterChange('startDate', e.target.value)} />
            </div>
            <div>
              <Label>Al</Label>
              <Input type="date" value={filters.endDate} onChange={e => handleFilterChange('endDate', e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="opacity-0">Reset</Label>
            <Button variant="ghost" onClick={resetFilters} className="w-full text-red-500 font-bold">
              <Eraser />
              Pulisci Filtri
            </Button>
          </div>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Storico Assenze</CardTitle>
          <CardDescription>Visualizza tutte le assenze registrate in base ai filtri applicati.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dipendente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAbsences.map((absence) => {
                const user = usersById[absence.userId];
                return (
                  <TableRow key={absence.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback style={{ backgroundColor: user?.color, color: 'white' }}>
                            {user?.name ? getInitials(user.name) : '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user?.name || absence.userId}</span>
                      </div>
                    </TableCell>
                    <TableCell>{absence.type}</TableCell>
                    <TableCell>
                      {today ? `${format(new Date(absence.startDate), 'PPP', { locale: it })} - ${format(new Date(absence.endDate), 'PPP', { locale: it })}` : '...'}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[absence.status]}>
                        {absence.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {(absence.userId === currentUser?.id || IS_ADMIN) && (
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => setAbsenceToDelete(absence)}>
                          <Trash2 />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredAbsences.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">Nessuna assenza trovata per i filtri selezionati.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aggiungi Assenza</DialogTitle>
            <DialogDescription>Compila i campi per registrare un nuovo periodo di assenza.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4 pt-4">
            <div>
              <Label htmlFor="type">Tipo di Assenza</Label>
              <Select name="type" required>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona un tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {[...allAbsenceTypes].sort().map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Data Inizio</Label>
                <Input id="startDate" name="startDate" type="date" required />
              </div>
              <div>
                <Label htmlFor="endDate">Data Fine</Label>
                <Input id="endDate" name="endDate" type="date" required />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Note (opzionale)</Label>
              <Textarea id="notes" name="notes" placeholder="Aggiungi eventuali dettagli o commenti..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={handleCloseModal}>Annulla</Button>
              <Button type="submit">Aggiungi Assenza</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!absenceToDelete} onOpenChange={(isOpen) => !isOpen && setAbsenceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. Questo eliminerà permanentemente il periodo di assenza.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAbsenceToDelete(null)}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
