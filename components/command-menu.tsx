"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
    Calendar,
    CheckSquare,
    FolderKanban,
    Users,
    FileText,
    MessageSquare,
    Search,
    Plus,
    Clock,
    ArrowRight,
    Sparkles,
    Settings,
    LayoutDashboard,
    Briefcase,
    Timer,
    FileStack,
    Hash,
    Building2,
    User,
    Loader2,
} from "lucide-react"

import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useLayoutData } from "@/app/(app)/layout-context"
import { useDebounce } from "@/hooks/use-debounce"
import { collection, query, getDocs, where, limit, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Task, Project, Client, Brief, User as UserType, CalendarActivity } from "@/lib/data"
import { cn, getInitials } from "@/lib/utils"
import { format } from "date-fns"
import { it } from "date-fns/locale"

// Storage key for recent searches
const RECENT_SEARCHES_KEY = "wrdigital-hub-recent-searches"
const MAX_RECENT_SEARCHES = 5

interface CommandMenuContextType {
    open: boolean
    setOpen: (open: boolean) => void
}

const CommandMenuContext = React.createContext<CommandMenuContextType | undefined>(undefined)

export function useCommandMenu() {
    const context = React.useContext(CommandMenuContext)
    if (!context) {
        throw new Error("useCommandMenu must be used within a CommandMenuProvider")
    }
    return context
}

export function CommandMenuProvider({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = React.useState(false)

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
            }
        }

        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [])

    return (
        <CommandMenuContext.Provider value={{ open, setOpen }}>
            {children}
        </CommandMenuContext.Provider>
    )
}

// Result types for search
interface SearchResults {
    tasks: Task[]
    projects: Project[]
    clients: Client[]
    briefs: Brief[]
    users: UserType[]
    calendarActivities: CalendarActivity[]
}

// Quick actions
const quickActions = [
    { id: 'new-task', label: 'Crea nuovo Task', icon: Plus, path: '/tasks?action=new', shortcut: '⌘N' },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', shortcut: '⌘D' },
    { id: 'tasks', label: 'Tutti i Task', icon: CheckSquare, path: '/tasks', shortcut: '⌘T' },
    { id: 'projects', label: 'Progetti', icon: FolderKanban, path: '/projects', shortcut: '⌘P' },
    { id: 'calendar', label: 'Calendario', icon: Calendar, path: '/calendar', shortcut: '⌘L' },
    { id: 'chat', label: 'Chat', icon: MessageSquare, path: '/chat', shortcut: '⌘M' },
]

const adminActions = [
    { id: 'admin', label: 'Pannello Admin', icon: Settings, path: '/admin' },
    { id: 'briefs', label: 'Brief', icon: FileText, path: '/briefs' },
    { id: 'absences', label: 'Assenze', icon: Timer, path: '/absences' },
    { id: 'documents', label: 'Documenti', icon: FileStack, path: '/documents' },
    { id: 'editorial', label: 'Piano Editoriale', icon: FileText, path: '/editorial-plan' },
]

// Status colors for visual feedback
const statusColors: Record<string, string> = {
    'Da Fare': 'bg-gray-500',
    'In Lavorazione': 'bg-primary',
    'In Approvazione': 'bg-orange-500',
    'Approvato': 'bg-emerald-500',
    'Annullato': 'bg-slate-500',
    'Pianificazione': 'bg-accent',
    'In Corso': 'bg-primary',
    'Completato': 'bg-green-500',
    'In Pausa': 'bg-yellow-500',
}

export default function CommandMenu() {
    const { open, setOpen } = useCommandMenu()
    const router = useRouter()
    const { currentUser, clients, users } = useLayoutData()

    const [searchQuery, setSearchQuery] = React.useState("")
    const [isSearching, setIsSearching] = React.useState(false)
    const [results, setResults] = React.useState<SearchResults>({
        tasks: [],
        projects: [],
        clients: [],
        briefs: [],
        users: [],
        calendarActivities: [],
    })
    const [recentSearches, setRecentSearches] = React.useState<string[]>([])

    const debouncedSearch = useDebounce(searchQuery, 300)

    // Load recent searches from localStorage
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(RECENT_SEARCHES_KEY)
            if (saved) {
                try {
                    setRecentSearches(JSON.parse(saved))
                } catch (e) {
                    console.error("Failed to parse recent searches", e)
                }
            }
        }
    }, [])

    // Save search to recent
    const saveRecentSearch = React.useCallback((search: string) => {
        if (!search.trim()) return
        setRecentSearches(prev => {
            const updated = [search, ...prev.filter(s => s !== search)].slice(0, MAX_RECENT_SEARCHES)
            if (typeof window !== 'undefined') {
                localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
            }
            return updated
        })
    }, [])

    // Clear recent searches
    const clearRecentSearches = React.useCallback(() => {
        setRecentSearches([])
        if (typeof window !== 'undefined') {
            localStorage.removeItem(RECENT_SEARCHES_KEY)
        }
    }, [])

    // Parse search query for shortcuts
    const parseSearchQuery = React.useCallback((query: string) => {
        const shortcuts: Record<string, 'task' | 'project' | 'client' | 'user' | 'brief' | 'all'> = {
            't:': 'task',
            'task:': 'task',
            'p:': 'project',
            'progetto:': 'project',
            'c:': 'client',
            'cliente:': 'client',
            'u:': 'user',
            'utente:': 'user',
            'b:': 'brief',
            'brief:': 'brief',
        }

        for (const [prefix, type] of Object.entries(shortcuts)) {
            if (query.toLowerCase().startsWith(prefix)) {
                return {
                    type,
                    searchTerm: query.slice(prefix.length).trim()
                }
            }
        }

        return { type: 'all' as const, searchTerm: query.trim() }
    }, [])

    // Perform search
    React.useEffect(() => {
        const performSearch = async () => {
            if (!debouncedSearch || debouncedSearch.length < 2) {
                setResults({
                    tasks: [],
                    projects: [],
                    clients: [],
                    briefs: [],
                    users: [],
                    calendarActivities: [],
                })
                return
            }

            setIsSearching(true)

            try {
                const { type, searchTerm } = parseSearchQuery(debouncedSearch)
                const searchLower = searchTerm.toLowerCase()

                const newResults: SearchResults = {
                    tasks: [],
                    projects: [],
                    clients: [],
                    briefs: [],
                    users: [],
                    calendarActivities: [],
                }

                // Search Tasks
                if (type === 'all' || type === 'task') {
                    const tasksSnapshot = await getDocs(collection(db, "tasks"))
                    newResults.tasks = tasksSnapshot.docs
                        .map(d => ({ id: d.id, ...d.data() }) as Task)
                        .filter(t =>
                            t.title?.toLowerCase().includes(searchLower) ||
                            t.description?.toLowerCase().includes(searchLower)
                        )
                        .slice(0, 5)
                }

                // Search Projects
                if (type === 'all' || type === 'project') {
                    const projectsSnapshot = await getDocs(collection(db, "projects"))
                    newResults.projects = projectsSnapshot.docs
                        .map(d => ({ id: d.id, ...d.data() }) as Project)
                        .filter(p =>
                            p.name?.toLowerCase().includes(searchLower) ||
                            p.description?.toLowerCase().includes(searchLower)
                        )
                        .slice(0, 5)
                }

                // Search Clients (from context for speed)
                if (type === 'all' || type === 'client') {
                    newResults.clients = clients
                        .filter(c =>
                            c.name?.toLowerCase().includes(searchLower) ||
                            c.email?.toLowerCase().includes(searchLower)
                        )
                        .slice(0, 5)
                }

                // Search Users (from context for speed)
                if (type === 'all' || type === 'user') {
                    newResults.users = users
                        .filter(u =>
                            u.name?.toLowerCase().includes(searchLower) ||
                            u.email?.toLowerCase().includes(searchLower)
                        )
                        .slice(0, 5)
                }

                // Search Briefs
                if (type === 'all' || type === 'brief') {
                    const briefsSnapshot = await getDocs(collection(db, "briefs"))
                    newResults.briefs = briefsSnapshot.docs
                        .map(d => ({ id: d.id, ...d.data() }) as Brief)
                        .filter(b =>
                            b.title?.toLowerCase().includes(searchLower) ||
                            b.projectName?.toLowerCase().includes(searchLower)
                        )
                        .slice(0, 5)
                }

                setResults(newResults)
            } catch (error) {
                console.error("Search error:", error)
            } finally {
                setIsSearching(false)
            }
        }

        performSearch()
    }, [debouncedSearch, clients, users, parseSearchQuery])

    // Navigation handler
    const handleSelect = React.useCallback((path: string, saveSearch = true) => {
        if (saveSearch && searchQuery) {
            saveRecentSearch(searchQuery)
        }
        setOpen(false)
        setSearchQuery("")
        router.push(path)
    }, [router, setOpen, searchQuery, saveRecentSearch])

    // Get client name by ID
    const getClientName = React.useCallback((clientId: string) => {
        return clients.find(c => c.id === clientId)?.name || 'Cliente sconosciuto'
    }, [clients])

    // Check if we have any results
    const hasResults = React.useMemo(() => {
        return (
            results.tasks.length > 0 ||
            results.projects.length > 0 ||
            results.clients.length > 0 ||
            results.users.length > 0 ||
            results.briefs.length > 0
        )
    }, [results])

    const isAdmin = currentUser?.role === 'Amministratore'

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <div className="flex items-center gap-2 px-3 border-b">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <CommandInput
                    placeholder="Cerca task, progetti, clienti... (usa t: p: c: per filtrare)"
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0"
                />
                {isSearching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <CommandList className="max-h-[500px]">
                {/* Show helper text when empty */}
                {!searchQuery && !hasResults && (
                    <>
                        {/* Recent Searches */}
                        {recentSearches.length > 0 && (
                            <CommandGroup heading={
                                <div className="flex justify-between items-center">
                                    <span>Ricerche Recenti</span>
                                    <button
                                        onClick={clearRecentSearches}
                                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        Cancella
                                    </button>
                                </div>
                            }>
                                {recentSearches.map((search, idx) => (
                                    <CommandItem
                                        key={idx}
                                        value={search}
                                        onSelect={() => setSearchQuery(search)}
                                        className="flex items-center gap-2"
                                    >
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                        <span>{search}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}

                        {/* Quick Actions */}
                        <CommandGroup heading="Azioni Rapide">
                            {quickActions.map((action) => (
                                <CommandItem
                                    key={action.id}
                                    value={action.label}
                                    onSelect={() => handleSelect(action.path, false)}
                                    className="flex items-center gap-2"
                                >
                                    <action.icon className="h-4 w-4 text-muted-foreground" />
                                    <span>{action.label}</span>
                                    {action.shortcut && (
                                        <CommandShortcut>{action.shortcut}</CommandShortcut>
                                    )}
                                </CommandItem>
                            ))}
                        </CommandGroup>

                        <CommandSeparator />

                        {/* More Actions */}
                        <CommandGroup heading="Altre Sezioni">
                            {adminActions.map((action) => (
                                <CommandItem
                                    key={action.id}
                                    value={action.label}
                                    onSelect={() => handleSelect(action.path, false)}
                                    className="flex items-center gap-2"
                                >
                                    <action.icon className="h-4 w-4 text-muted-foreground" />
                                    <span>{action.label}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>

                        <CommandSeparator />

                        {/* Search Tips */}
                        <CommandGroup heading="💡 Suggerimenti di Ricerca">
                            <div className="px-2 py-3 text-sm space-y-2 text-muted-foreground">
                                <p className="flex items-center gap-2">
                                    <Hash className="h-3 w-3" />
                                    <code className="bg-muted px-1 rounded">t:</code> Cerca solo nei task
                                </p>
                                <p className="flex items-center gap-2">
                                    <Hash className="h-3 w-3" />
                                    <code className="bg-muted px-1 rounded">p:</code> Cerca solo nei progetti
                                </p>
                                <p className="flex items-center gap-2">
                                    <Hash className="h-3 w-3" />
                                    <code className="bg-muted px-1 rounded">c:</code> Cerca solo nei clienti
                                </p>
                                <p className="flex items-center gap-2">
                                    <Hash className="h-3 w-3" />
                                    <code className="bg-muted px-1 rounded">u:</code> Cerca solo negli utenti
                                </p>
                            </div>
                        </CommandGroup>
                    </>
                )}

                {/* No results found */}
                {searchQuery && !hasResults && !isSearching && (
                    <CommandEmpty>
                        <div className="flex flex-col items-center gap-2 py-6">
                            <Search className="h-8 w-8 text-muted-foreground" />
                            <p>Nessun risultato per "{searchQuery}"</p>
                            <p className="text-sm text-muted-foreground">
                                Prova con termini diversi o usa i filtri (t:, p:, c:)
                            </p>
                        </div>
                    </CommandEmpty>
                )}

                {/* Search Results */}
                {searchQuery && hasResults && (
                    <>
                        {/* Tasks */}
                        {results.tasks.length > 0 && (
                            <CommandGroup heading={`📋 Task (${results.tasks.length})`}>
                                {results.tasks.map((task) => (
                                    <CommandItem
                                        key={task.id}
                                        value={`task-${task.id}-${task.title}`}
                                        onSelect={() => handleSelect(`/tasks?taskId=${task.id}`)}
                                        className="flex items-center gap-3 py-3"
                                    >
                                        <div className={cn("h-2 w-2 rounded-full shrink-0", statusColors[task.status] || 'bg-gray-400')} />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{task.title}</p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span>{getClientName(task.clientId)}</span>
                                                {task.dueDate && (
                                                    <>
                                                        <span>•</span>
                                                        <span>{format(new Date(task.dueDate), 'dd MMM', { locale: it })}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <Badge variant="secondary" className="shrink-0 text-xs">
                                            {task.status}
                                        </Badge>
                                    </CommandItem>
                                ))}
                                <CommandItem
                                    value="see-all-tasks"
                                    onSelect={() => handleSelect(`/tasks?search=${encodeURIComponent(searchQuery)}`)}
                                    className="text-primary justify-center"
                                >
                                    Vedi tutti i task con "{searchQuery}" <ArrowRight className="ml-2 h-4 w-4" />
                                </CommandItem>
                            </CommandGroup>
                        )}

                        {/* Projects */}
                        {results.projects.length > 0 && (
                            <CommandGroup heading={`📁 Progetti (${results.projects.length})`}>
                                {results.projects.map((project) => (
                                    <CommandItem
                                        key={project.id}
                                        value={`project-${project.id}-${project.name}`}
                                        onSelect={() => handleSelect(`/projects?projectId=${project.id}`)}
                                        className="flex items-center gap-3 py-3"
                                    >
                                        <FolderKanban className="h-4 w-4 shrink-0 text-primary" />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{project.name}</p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span>{getClientName(project.clientId)}</span>
                                                {project.endDate && (
                                                    <>
                                                        <span>•</span>
                                                        <span>Scade: {format(new Date(project.endDate), 'dd MMM', { locale: it })}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <Badge variant="secondary" className="shrink-0 text-xs">
                                            {project.status}
                                        </Badge>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}

                        {/* Clients */}
                        {results.clients.length > 0 && (
                            <CommandGroup heading={`🏢 Clienti (${results.clients.length})`}>
                                {results.clients.map((client) => (
                                    <CommandItem
                                        key={client.id}
                                        value={`client-${client.id}-${client.name}`}
                                        onSelect={() => handleSelect(`/tasks?clientId=${client.id}`)}
                                        className="flex items-center gap-3 py-3"
                                    >
                                        <Avatar className="h-6 w-6 shrink-0">
                                            <AvatarFallback style={{ backgroundColor: client.color }} className="text-white text-xs">
                                                {getInitials(client.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{client.name}</p>
                                            {client.email && (
                                                <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                                            )}
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}

                        {/* Users */}
                        {results.users.length > 0 && (
                            <CommandGroup heading={`👤 Utenti (${results.users.length})`}>
                                {results.users.map((user) => (
                                    <CommandItem
                                        key={user.id}
                                        value={`user-${user.id}-${user.name}`}
                                        onSelect={() => handleSelect(`/tasks?userId=${user.id}`)}
                                        className="flex items-center gap-3 py-3"
                                    >
                                        <Avatar className="h-6 w-6 shrink-0">
                                            <AvatarFallback style={{ backgroundColor: user.color }} className="text-white text-xs">
                                                {getInitials(user.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{user.name}</p>
                                            <p className="text-xs text-muted-foreground">{user.role}</p>
                                        </div>
                                        <Badge variant="outline" className="shrink-0 text-xs">
                                            {user.status || 'Attivo'}
                                        </Badge>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}

                        {/* Briefs */}
                        {results.briefs.length > 0 && (
                            <CommandGroup heading={`📝 Brief (${results.briefs.length})`}>
                                {results.briefs.map((brief) => (
                                    <CommandItem
                                        key={brief.id}
                                        value={`brief-${brief.id}-${brief.title}`}
                                        onSelect={() => handleSelect(`/briefs?briefId=${brief.id}`)}
                                        className="flex items-center gap-3 py-3"
                                    >
                                        <FileText className="h-4 w-4 shrink-0 text-amber-500" />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{brief.title || brief.projectName}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {getClientName(brief.clientId)}
                                            </p>
                                        </div>
                                        <Badge variant="secondary" className="shrink-0 text-xs">
                                            {brief.status}
                                        </Badge>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </>
                )}
            </CommandList>

            {/* Footer with keyboard shortcuts */}
            <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                            ↑↓
                        </kbd>
                        <span>navigare</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                            ↵
                        </kbd>
                        <span>selezionare</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                            esc
                        </kbd>
                        <span>chiudere</span>
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    <span>Powered by W[r]Digital</span>
                </div>
            </div>
        </CommandDialog>
    )
}
