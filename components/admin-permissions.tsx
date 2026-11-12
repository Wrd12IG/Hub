'use client';

/**
 * components/admin-permissions.tsx
 *
 * Admin → Permessi, un ruolo alla volta. Prima c'era un'unica tabella con quattro colonne di caselle senza spiegazioni, in cui
 * «Cliente» e sei azioni su nove non cambiavano nulla. Qui ogni voce dice cosa fa, i report dei clienti stanno in evidenza,
 * ciò che oggi non ha effetto è dichiarato come tale, e il salvataggio compare quando c'è qualcosa da salvare.
 */
import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, Crown, Info, Loader2, Lock, Minus, UserRound, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
    ACTIVE_ACTIONS, ALL_PAGE_ITEMS, EDITABLE_ROLES, INACTIVE_ACTIONS, PAGE_GROUPS, changedCount, has, isLockedOn,
    type EditableRole, type PermissionItem, type Permissions,
} from '@/lib/admin-permissions-model';

interface Props {
    permissions: Permissions;
    initial: Permissions;
    onChange: (role: string, key: string, on: boolean) => void;
    onDiscard: () => void;
    onSave: () => void;
    saving: boolean;
    /** Porta al tab Utenti (per dare l'accesso alle persone di un cliente). */
    onGoToUsers?: () => void;
}

function Row({ item, role, on, locked, disabled, onToggle }: { item: PermissionItem; role: string; on: boolean; locked?: boolean; disabled?: boolean; onToggle: (v: boolean) => void }) {
    const id = `perm-${role}-${item.key}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    return (
        <div className="flex items-start justify-between gap-4 border-b py-3 last:border-b-0">
            <div className="min-w-0">
                <label htmlFor={id} className={cn('block text-sm font-medium', !disabled && !locked && 'cursor-pointer')}>{item.label}</label>
                <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-0.5">
                {locked && <Badge variant="secondary" className="gap-1 text-[11px]"><Lock className="h-3 w-3" />Sempre attivo</Badge>}
                <Switch id={id} checked={locked ? true : on} disabled={locked || disabled} onCheckedChange={onToggle} aria-label={`${item.label} per ${role}`} className="cursor-pointer disabled:cursor-not-allowed" />
            </div>
        </div>
    );
}

function RolePanel({ role, permissions, onChange }: { role: EditableRole; permissions: Permissions; onChange: Props['onChange'] }) {
    return (
        <div className="space-y-4">
            <p className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Le pagine spuntate compaiono nel <b>menu</b> e nella barra in basso di chi ha il ruolo <b>{role}</b>. Servono a organizzare ciò che si vede, <b>non a proteggere i dati</b>: chi conosce l&apos;indirizzo di una pagina dello staff la apre comunque.</span>
            </p>

            {PAGE_GROUPS.map((group) => (
                <Card key={group.id} id={`permessi-${group.id}`} className={cn(group.id === 'clients' && 'border-amber-500/50 shadow-sm')}>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                            {group.id === 'clients' && <Users className="h-4 w-4 text-amber-500" />}
                            {group.title}
                        </CardTitle>
                        {group.hint && <CardDescription className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{group.hint}</CardDescription>}
                    </CardHeader>
                    <CardContent>
                        {group.items.map((item) => (
                            <Row key={item.key} item={item} role={role} on={has(permissions, role, item.key)} locked={isLockedOn(role, item.key)} onToggle={(v) => onChange(role, item.key, v)} />
                        ))}
                    </CardContent>
                </Card>
            ))}

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Azioni</CardTitle>
                    <CardDescription>Cosa può fare, oltre a vedere le pagine.</CardDescription>
                </CardHeader>
                <CardContent>
                    {ACTIVE_ACTIONS.map((item) => <Row key={item.key} item={item} role={role} on={has(permissions, role, item.key)} onToggle={(v) => onChange(role, item.key, v)} />)}
                </CardContent>
            </Card>

            <details className="group rounded-xl border bg-card">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                    <span>Da attivare: budget e costi</span>
                    <span className="text-xs text-muted-foreground group-open:hidden">Mostra</span>
                    <span className="hidden text-xs text-muted-foreground group-open:inline">Nascondi</span>
                </summary>
                <div className="space-y-2 border-t p-4">
                    <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>Questa casella c&apos;è ma l&apos;app non la legge ancora: spuntarla o toglierla <b>non cambia nulla</b>. Togliere «Visualizza Budget e Costi» non nasconde i budget: oggi li vede tutto lo staff.</span>
                    </p>
                    {INACTIVE_ACTIONS.map((item) => <Row key={item.key} item={item} role={role} on={has(permissions, role, item.key)} disabled onToggle={() => {}} />)}
                </div>
            </details>
        </div>
    );
}

function Overview({ permissions }: { permissions: Permissions }) {
    const cell = (on: boolean, label: string) => (on ? <><Check className="mx-auto h-4 w-4 text-emerald-600" aria-hidden /><span className="sr-only">{label}: sì</span></> : <><Minus className="mx-auto h-4 w-4 text-muted-foreground/50" aria-hidden /><span className="sr-only">{label}: no</span></>);
    return (
        <details className="group rounded-xl border bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                <span>Vedi tutti i ruoli in una tabella</span>
                <span className="text-xs text-muted-foreground group-open:hidden">Mostra</span>
                <span className="hidden text-xs text-muted-foreground group-open:inline">Nascondi</span>
            </summary>
            <div className="overflow-x-auto border-t">
                <table className="w-full text-sm">
                    <caption className="sr-only">Pagine e azioni attive per ogni ruolo</caption>
                    <thead>
                        <tr className="text-left text-xs text-muted-foreground">
                            <th scope="col" className="p-3 font-medium">Voce</th>
                            <th scope="col" className="p-3 text-center font-medium">Amministratore</th>
                            <th scope="col" className="p-3 text-center font-medium">Project Manager</th>
                            <th scope="col" className="p-3 text-center font-medium">Collaboratore</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...ALL_PAGE_ITEMS, ...ACTIVE_ACTIONS].map((item) => (
                            <tr key={item.key} className="border-t">
                                <th scope="row" className="p-3 text-left font-medium">{item.label}</th>
                                <td className="p-3 text-center">{cell(true, `${item.label} per Amministratore`)}</td>
                                <td className="p-3 text-center">{cell(isLockedOn('Project Manager', item.key) || has(permissions, 'Project Manager', item.key), `${item.label} per Project Manager`)}</td>
                                <td className="p-3 text-center">{cell(has(permissions, 'Collaboratore', item.key), `${item.label} per Collaboratore`)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </details>
    );
}

export function AdminPermissions({ permissions, initial, onChange, onDiscard, onSave, saving, onGoToUsers }: Props) {
    const [tab, setTab] = useState<string>('Collaboratore');
    const changes = useMemo(() => changedCount(initial, permissions), [initial, permissions]);
    const count = (role: EditableRole) => ALL_PAGE_ITEMS.filter((i) => isLockedOn(role, i.key) || has(permissions, role, i.key)).length;

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold">Permessi per ruolo</h2>
                <p className="text-sm text-muted-foreground">Scegli un ruolo e decidi cosa vede e cosa può fare. Vale per tutte le persone di quel ruolo.</p>
            </div>

            <Tabs value={tab} onValueChange={setTab} className="space-y-4">
                <TabsList className="h-auto flex-wrap justify-start gap-1">
                    {EDITABLE_ROLES.map((r) => (
                        <TabsTrigger key={r} value={r} className="gap-2">{r}<Badge variant="secondary" className="px-1.5 text-[10px]">{count(r)}/{ALL_PAGE_ITEMS.length} pagine</Badge></TabsTrigger>
                    ))}
                    <TabsTrigger value="Cliente" className="gap-1.5"><UserRound className="h-3.5 w-3.5" />Cliente</TabsTrigger>
                    <TabsTrigger value="Amministratore" className="gap-1.5"><Crown className="h-3.5 w-3.5" />Amministratore</TabsTrigger>
                </TabsList>

                {EDITABLE_ROLES.map((r) => (
                    <TabsContent key={r} value={r} className="mt-0"><RolePanel role={r} permissions={permissions} onChange={onChange} /></TabsContent>
                ))}

                <TabsContent value="Cliente" className="mt-0">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Le persone dei clienti</CardTitle>
                            <CardDescription>Il ruolo Cliente non si imposta da qui: vede sempre e solo il proprio cliente.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                                <li><b className="text-foreground">I miei risultati</b>: la panoramica e i report del proprio cliente;</li>
                                <li><b className="text-foreground">Piano editoriale</b>: i contenuti da approvare;</li>
                                <li><b className="text-foreground">Brief</b>: le richieste al team.</li>
                            </ul>
                            <p className="rounded-lg border bg-muted/40 p-3">Per dare l&apos;accesso a una persona di un cliente: <b>Utenti</b> → crea (o modifica) l&apos;utente con ruolo <b>Cliente</b> e scegli il <b>Cliente associato</b>.</p>
                            {onGoToUsers && <Button variant="outline" size="sm" onClick={onGoToUsers}>Vai agli utenti</Button>}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="Amministratore" className="mt-0">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Amministratore</CardTitle>
                            <CardDescription>Ha sempre tutte le pagine e tutte le azioni, e può scavalcare l&apos;approvazione del cliente sui contenuti. Non si può limitare da qui.</CardDescription>
                        </CardHeader>
                    </Card>
                </TabsContent>
            </Tabs>

            <Overview permissions={permissions} />

            {changes > 0 && (
                <div role="status" className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-card/95 p-3 shadow-lg backdrop-blur">
                    <p className="text-sm"><b>{changes}</b> {changes === 1 ? 'modifica non salvata' : 'modifiche non salvate'}</p>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>Annulla modifiche</Button>
                        <Button size="sm" onClick={onSave} disabled={saving} className="gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? 'Salvo…' : 'Salva permessi'}</Button>
                    </div>
                </div>
            )}
        </div>
    );
}
