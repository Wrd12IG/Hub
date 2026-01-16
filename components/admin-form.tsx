

'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Client, Department, Team, User, ActivityType, BriefService, BriefServiceCategory, CalendarActivityPreset } from '@/lib/data';

type ModalState = 'user' | 'client' | 'department' | 'team' | 'activity' | 'service' | 'calendar_preset' | 'edit-user' | 'edit-client' | 'edit-department' | 'edit-team' | 'edit-activity' | 'edit-service' | 'edit-calendar_preset' | null;

interface AdminFormProps {
    modalOpen: ModalState;
    editingUser?: User | null;
    editingClient?: Client | null;
    editingDepartment?: Department | null;
    editingTeam?: Team | null;
    editingActivity?: ActivityType | null;
    editingService?: BriefService | null;
    editingCalendarPreset?: CalendarActivityPreset | null;
    departments: Department[];
    teams: Team[];
    users: User[];
    clients: Client[];
    briefServiceCategories: BriefServiceCategory[];
    activityTypes: ActivityType[];
    handleFormSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    handleCloseModal: () => void;
}

export default function AdminForm({ modalOpen, editingUser, editingClient, editingDepartment, editingTeam, editingActivity, editingService, editingCalendarPreset, departments, teams, users, clients, briefServiceCategories, activityTypes, handleFormSubmit, handleCloseModal }: AdminFormProps) {
    const isEdit = modalOpen?.startsWith('edit-') || false;
    const [selectedRole, setSelectedRole] = React.useState(editingUser?.role || '');

    React.useEffect(() => {
        if (modalOpen === 'user' || modalOpen === 'edit-user') {
            setSelectedRole(editingUser?.role || '');
        }
    }, [modalOpen, editingUser]);

    return (
        <form onSubmit={handleFormSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4 pt-2">
            {(modalOpen === 'user' || modalOpen === 'edit-user') && (
                <>
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label htmlFor="name">Nome</Label><Input id="name" name="name" required defaultValue={editingUser?.name} /></div>
                        <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required defaultValue={editingUser?.email} readOnly={isEdit} /></div>
                    </div>
                    <div><Label htmlFor="password">{modalOpen === 'edit-user' ? 'Nuova Password (lascia vuoto per non cambiare)' : 'Password'}</Label><Input id="password" name="password" type="password" required={modalOpen === 'user'} /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label htmlFor="phone">Telefono</Label><Input id="phone" name="phone" defaultValue={editingUser?.phone} /></div>
                        <div><Label htmlFor="role">Ruolo</Label><Select name="role" value={selectedRole} onValueChange={setSelectedRole}><SelectTrigger><SelectValue placeholder="Seleziona un ruolo" /></SelectTrigger><SelectContent><SelectItem value="Amministratore">Amministratore</SelectItem><SelectItem value="Project Manager">Project Manager</SelectItem><SelectItem value="Collaboratore">Collaboratore</SelectItem><SelectItem value="Cliente">Cliente</SelectItem></SelectContent></Select></div>
                    </div>

                    {selectedRole === 'Cliente' && (
                        <div>
                            <Label htmlFor="clientId">Cliente Associato</Label>
                            <Select name="clientId" defaultValue={editingUser?.clientId} required>
                                <SelectTrigger><SelectValue placeholder="Seleziona un cliente..." /></SelectTrigger>
                                <SelectContent>
                                    {clients.sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div><Label htmlFor="departmentId">Reparto</Label><Select name="departmentId" defaultValue={editingUser?.departmentId || undefined}><SelectTrigger><SelectValue placeholder="Seleziona un reparto" /></SelectTrigger><SelectContent>{[...departments].sort((a, b) => a.name.localeCompare(b.name)).map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
                        <div><Label htmlFor="teamId">Team</Label><Select name="teamId" defaultValue={editingUser?.teamId || undefined}><SelectTrigger><SelectValue placeholder="Seleziona un team" /></SelectTrigger><SelectContent>{[...teams].sort((a, b) => a.name.localeCompare(b.name)).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label htmlFor="startDate">Data Inizio</Label><Input id="startDate" name="startDate" type="date" defaultValue={editingUser?.startDate ? editingUser.startDate.split('T')[0] : ''} /></div>
                        <div><Label htmlFor="birthDate">Data di Nascita 🎂</Label><Input id="birthDate" name="birthDate" type="date" defaultValue={editingUser?.birthDate ? editingUser.birthDate.split('T')[0] : ''} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label htmlFor="color">Colore</Label><Input id="color" name="color" type="color" defaultValue={editingUser?.color || '#4285F4'} /></div>
                    </div>
                    <div><Label htmlFor="skills">Competenze (separate da virgola)</Label><Input id="skills" name="skills" defaultValue={editingUser?.skills?.join(', ')} /></div>
                    <div><Label htmlFor="status">Stato</Label><Select name="status" defaultValue={editingUser?.status || 'Attivo'}><SelectTrigger><SelectValue placeholder="Seleziona uno stato" /></SelectTrigger><SelectContent><SelectItem value="Attivo">Attivo</SelectItem><SelectItem value="Inattivo">Inattivo</SelectItem></SelectContent></Select></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label htmlFor="salary">Stipendio Mensile (€)</Label><Input id="salary" name="salary" type="number" step="0.01" placeholder="0.00" defaultValue={editingUser?.salary || ''} /></div>
                        <div><Label htmlFor="hourlyRate">Costo Orario (€)</Label><Input id="hourlyRate" name="hourlyRate" type="number" step="0.01" placeholder="0.00" defaultValue={editingUser?.hourlyRate || ''} /></div>
                    </div>
                </>
            )}
            {(modalOpen === 'client' || modalOpen === 'edit-client') && (
                <>
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label htmlFor="name">Nome</Label><Input id="name" name="name" required defaultValue={editingClient?.name} /></div>
                        <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required defaultValue={editingClient?.email} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label htmlFor="phone">Telefono</Label><Input id="phone" name="phone" defaultValue={editingClient?.phone} /></div>
                        <div><Label htmlFor="budget">Budget</Label><Input id="budget" name="budget" type="number" defaultValue={editingClient?.budget || 0} /></div>
                    </div>
                    <div><Label htmlFor="address">Indirizzo</Label><Input id="address" name="address" defaultValue={editingClient?.address} /></div>
                    <div><Label htmlFor="color">Colore</Label><Input id="color" name="color" type="color" defaultValue={editingClient?.color || "#34A853"} /></div>
                    <div><Label htmlFor="notes">Note</Label><Textarea id="notes" name="notes" defaultValue={editingClient?.notes} /></div>
                    <div>
                        <Label>Utenti Responsabili</Label>
                        <div className="space-y-2 max-h-48 overflow-y-auto border p-2 rounded-md">
                            {[...users].sort((a, b) => a.name.localeCompare(b.name)).map(user => (
                                <div key={user.id} className="flex items-center gap-2">
                                    <Checkbox id={`managedBy-${user.id}`} name="managedBy" value={user.id} defaultChecked={editingClient?.managedBy?.includes(user.id)} />
                                    <Label htmlFor={`managedBy-${user.id}`} className="font-normal">{user.name}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="mt-4">
                        <Label>Attività Autorizzate</Label>
                        <CardDescription className="mb-2">Seleziona le attività che possono essere svolte per questo cliente. Se nessuna è selezionata, tutte saranno disponibili.</CardDescription>
                        <div className="space-y-2 max-h-48 overflow-y-auto border p-2 rounded-md">
                            {[...activityTypes].sort((a, b) => a.name.localeCompare(b.name)).map(activity => (
                                <div key={activity.id} className="flex items-center gap-2">
                                    <Checkbox
                                        id={`allowedActivity-${activity.id}`}
                                        name="allowedActivityTypeIds"
                                        value={activity.id}
                                        defaultChecked={editingClient?.allowedActivityTypeIds?.includes(activity.id)}
                                    />
                                    <Label htmlFor={`allowedActivity-${activity.id}`} className="font-normal flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: activity.color }} />
                                        {activity.name}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
            {modalOpen === 'department' && (
                <>
                    <div><Label htmlFor="name">Nome Reparto</Label><Input id="name" name="name" required /></div>
                    <div><Label htmlFor="color">Colore</Label><Input id="color" name="color" type="color" defaultValue="#FBBC05" /></div>
                    <div>
                        <Label>Membri</Label>
                        <div className="space-y-2 max-h-48 overflow-y-auto border p-2 rounded-md">
                            {[...users].sort((a, b) => a.name.localeCompare(b.name)).map(user => (
                                <div key={user.id} className="flex items-center gap-2">
                                    <Checkbox id={`member-${user.id}`} name="members" value={user.id} />
                                    <Label htmlFor={`member-${user.id}`} className="font-normal">{user.name}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
            {modalOpen === 'edit-department' && editingDepartment && (
                <>
                    <div><Label htmlFor="name">Nome Reparto</Label><Input id="name" name="name" required defaultValue={editingDepartment.name} /></div>
                    <div><Label htmlFor="color">Colore</Label><Input id="color" name="color" type="color" defaultValue={editingDepartment.color} /></div>
                    <div>
                        <Label>Membri</Label>
                        <div className="space-y-2 max-h-48 overflow-y-auto border p-2 rounded-md">
                            {[...users].sort((a, b) => a.name.localeCompare(b.name)).map(user => (
                                <div key={user.id} className="flex items-center gap-2">
                                    <Checkbox id={`member-edit-${user.id}`} name="members" value={user.id} defaultChecked={editingDepartment.members?.includes(user.id)} />
                                    <Label htmlFor={`member-edit-${user.id}`} className="font-normal">{user.name}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
            {modalOpen === 'team' && (
                <>
                    <div><Label htmlFor="name">Nome Team</Label><Input id="name" name="name" required /></div>
                    <div><Label htmlFor="color">Colore</Label><Input id="color" name="color" type="color" defaultValue="#EA4335" /></div>
                    <div>
                        <Label>Membri</Label>
                        <div className="space-y-2 max-h-48 overflow-y-auto border p-2 rounded-md">
                            {[...users].sort((a, b) => a.name.localeCompare(b.name)).map(user => (
                                <div key={user.id} className="flex items-center gap-2">
                                    <Checkbox id={`member-team-${user.id}`} name="members" value={user.id} />
                                    <Label htmlFor={`member-team-${user.id}`} className="font-normal">{user.name}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
            {modalOpen === 'edit-team' && editingTeam && (
                <>
                    <div><Label htmlFor="name">Nome Team</Label><Input id="name" name="name" required defaultValue={editingTeam.name} /></div>
                    <div><Label htmlFor="color">Colore</Label><Input id="color" name="color" type="color" defaultValue={editingTeam.color} /></div>
                    <div>
                        <Label>Membri</Label>
                        <div className="space-y-2 max-h-48 overflow-y-auto border p-2 rounded-md">
                            {[...users].sort((a, b) => a.name.localeCompare(b.name)).map(user => (
                                <div key={user.id} className="flex items-center gap-2">
                                    <Checkbox id={`member-team-edit-${user.id}`} name="members" value={user.id} defaultChecked={editingTeam.members?.includes(user.id)} />
                                    <Label htmlFor={`member-team-edit-${user.id}`} className="font-normal">{user.name}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
            {modalOpen === 'activity' && (
                <>
                    <div><Label htmlFor="name">Nome Attività</Label><Input id="name" name="name" required /></div>
                    <div><Label htmlFor="description">Descrizione</Label><Textarea id="description" name="description" /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label htmlFor="hourlyRate">Costo Orario (€)</Label><Input id="hourlyRate" name="hourlyRate" type="number" step="0.01" required /></div>
                        <div><Label htmlFor="color">Colore</Label><Input id="color" name="color" type="color" defaultValue="#3b82f6" /></div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="hasDeadlineTask" name="hasDeadlineTask" />
                        <Label htmlFor="hasDeadlineTask">Crea Task Scadenza</Label>
                    </div>
                </>
            )}
            {modalOpen === 'edit-activity' && editingActivity && (
                <>
                    <div><Label htmlFor="name">Nome Attività</Label><Input id="name" name="name" required defaultValue={editingActivity.name} /></div>
                    <div><Label htmlFor="description">Descrizione</Label><Textarea id="description" name="description" defaultValue={editingActivity.description} /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label htmlFor="hourlyRate">Costo Orario (€)</Label><Input id="hourlyRate" name="hourlyRate" type="number" step="0.01" required defaultValue={editingActivity.hourlyRate} /></div>
                        <div><Label htmlFor="color">Colore</Label><Input id="color" name="color" type="color" defaultValue={editingActivity.color} /></div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="hasDeadlineTask" name="hasDeadlineTask" defaultChecked={editingActivity.hasDeadlineTask} />
                        <Label htmlFor="hasDeadlineTask">Crea Task Scadenza</Label>
                    </div>
                </>
            )}
            {(modalOpen === 'service' || modalOpen === 'edit-service') && (
                <>
                    <div><Label htmlFor="name">Nome Servizio</Label><Input id="name" name="name" required defaultValue={editingService?.name} /></div>
                    <div>
                        <Label htmlFor="categoryId">Categoria</Label>
                        <Select name="categoryId" required defaultValue={editingService?.categoryId}>
                            <SelectTrigger><SelectValue placeholder="Seleziona una categoria" /></SelectTrigger>
                            <SelectContent>
                                {briefServiceCategories.map(cat => (
                                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div><Label htmlFor="description">Descrizione</Label><Textarea id="description" name="description" defaultValue={editingService?.description} /></div>
                </>
            )}
            {(modalOpen === 'calendar_preset' || modalOpen === 'edit-calendar_preset') && (
                <>
                    <div><Label htmlFor="name">Nome Attività</Label><Input id="name" name="name" required defaultValue={editingCalendarPreset?.name} /></div>
                    <div><Label htmlFor="description">Descrizione</Label><Textarea id="description" name="description" defaultValue={editingCalendarPreset?.description} placeholder="A cosa serve questa attività?" /></div>
                    <div><Label htmlFor="color">Colore</Label><Input id="color" name="color" type="color" defaultValue={editingCalendarPreset?.color || "#8884d8"} /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label htmlFor="defaultDuration">Durata Predefinita (minuti)</Label><Input id="defaultDuration" name="defaultDuration" type="number" required defaultValue={editingCalendarPreset?.defaultDuration || 60} /></div>
                        <div><Label htmlFor="hourlyRate">Costo Orario (€)</Label><Input id="hourlyRate" name="hourlyRate" type="number" step="0.01" required defaultValue={editingCalendarPreset?.hourlyRate || 20} /></div>
                    </div>
                </>
            )}
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={handleCloseModal}>Annulla</Button>
                <Button type="submit">
                    {modalOpen?.startsWith('edit-') ? 'Salva Modifiche' : 'Crea'}
                </Button>
            </DialogFooter>
        </form>
    );
}

