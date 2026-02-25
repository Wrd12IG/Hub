// Type definitions for the application

export interface User {
    id: string;
    email: string;
    name: string;
    role: 'Amministratore' | 'Project Manager' | 'Collaboratore' | 'Cliente';
    avatar?: string;
    color?: string;
    phone?: string;
    status?: 'Attivo' | 'Inattivo';
    clientId?: string;
    createdAt?: string;
    updatedAt?: string;
    departmentId?: string;
    teamId?: string;
    bio?: string;
    startDate?: string;
    birthDate?: string; // Data di nascita per celebrazioni compleanno (formato: YYYY-MM-DD)
    skills?: string[];
    salary?: number;
    hourlyRate?: number; // Costo orario dell'utente per il calcolo dei costi cliente
    visibleDashboardWidgets?: string[]; // Widget della dashboard visibili per questo utente (configurato dall'admin)
}

export interface Client {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    budget?: number;
    color?: string;
    notes?: string;
    managedBy?: string[]; // User IDs managing this client
    allowedActivityTypeIds?: string[]; // IDs of activity types allowed for this client
    publicToken?: string; // Token for public secure access
    publicTokenCreatedAt?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface Project {
    id: string;
    name: string;
    description?: string;
    status: 'Pianificazione' | 'In Corso' | 'Completato' | 'In Pausa' | 'Annullato';
    clientId: string;
    startDate?: string;
    endDate?: string;
    budget?: number;
    teamLeaderId?: string;
    tags?: string;
    notes?: string;
    priority?: 'Bassa' | 'Media' | 'Alta' | 'Critica';
    createdBy?: string;
    createdAt?: string;
    updatedAt?: string;
    spentBudget?: number;
    progress: number;
}

export interface Attachment {
    url: string;
    filename: string;
    type?: string;
    size?: number;
    documentType?: 'Approvazione' | 'Altro';
    description?: string;
    date: string;
    userId?: string;
    version?: number;
}

export interface TaskComment {
    id: string;
    text: string;
    userId: string;
    timestamp: string;
}

export interface TaskApproval {
    userId: string;
    timestamp: string;
    notes?: string;
}

export interface Task {
    id: string;
    title: string;
    description?: string;
    status: 'Da Fare' | 'In Lavorazione' | 'In Approvazione' | 'In Approvazione Cliente' | 'Approvato' | 'Annullato';
    priority: 'Bassa' | 'Media' | 'Alta' | 'Critica';
    dueDate?: string;
    estimatedDuration: number;
    timeSpent: number;
    actualDuration?: number;
    clientId: string;
    projectId?: string;
    assignedUserId?: string;
    createdBy?: string;
    activityType?: string;
    dependencies?: string[];
    attachments?: Attachment[];
    comments?: TaskComment[];
    approvals?: TaskApproval[];
    requiresTwoStepApproval?: boolean;
    skipAttachmentOnApproval?: boolean;
    rejectionReason?: string;
    cancelledAt?: string;  // Data di annullamento del task
    createdAt?: string;
    updatedAt?: string;
    spentBudget?: number;
    // Timer tracking fields
    timerStartedAt?: string;  // ISO timestamp when timer was started
    timerUserId?: string;     // User ID who started the timer
}

export interface ActivityType {
    id: string;
    name: string;
    description?: string;
    hourlyRate: number;
    color?: string;
    hasDeadlineTask?: boolean;
}

export interface Absence {
    id: string;
    userId: string;
    type: 'Ferie' | 'Malattia' | 'Permesso' | 'Altro';
    startDate: string;
    endDate: string;
    notes?: string;
    status: 'In Attesa' | 'Approvato' | 'Rifiutato';
    createdAt?: string;
}

export interface RolePermissions {
    [role: string]: string[];
}

export interface CalendarActivity {
    id: string;
    title: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    start?: string;  // Legacy field name
    end?: string;    // Legacy field name
    color?: string;
    presetId?: string;
    userId?: string;
    clientId?: string;  // Legacy - single client
    clientIds?: string[]; // New - multiple clients
    notes?: string;
    createdAt?: string;
}

export interface CalendarActivityPreset {
    id: string;
    name: string;
    description?: string;
    color?: string;
    defaultDuration?: number;
    hourlyRate?: number;
}

// Costi aziendali - ripartiti su ogni dipendente per il calcolo del costo orario effettivo
export interface CompanyCosts {
    id?: string;
    dirigenza: number;      // Costi di dirigenza/management
    struttura: number;      // Costi di struttura (affitto, utenze, ecc.)
    varie: number;          // Altri costi vari
    updatedAt?: string;
    // Campi calcolati (non salvati in DB)
    totalMonthlyCost?: number;      // Totale mensile
    costPerEmployee?: number;       // Costo per dipendente al mese
    hourlyOverhead?: number;        // Sovrapprezzo orario da aggiungere al costo dipendente
}



export interface BriefService {
    id: string;
    name: string;
    categoryId: string;
    description?: string;
}

export interface BriefServiceCategory {
    id: string;
    name: string;
}

export interface Brief {
    id: string;
    // Core fields
    clientId: string;
    projectName: string; // Nome azienda/progetto
    title: string; // Can serve as a summary or same as projectName
    contactPerson: string;
    budget?: number;
    deadline?: string;
    mainObjective: string;

    // Services
    selectedServiceIds: string[];

    // Creative Details
    formatDimensions?: string;
    toneOfVoice?: string;
    stylePreferences?: string; // Stile desiderato o da evitare
    references?: string; // Esempi di riferimento

    // Content & Messages
    keyMessages?: string;
    slogans?: string;

    // Technical Constraints
    publishingPlatforms?: string;

    // Process & Approvals
    revisionCount?: string; // Numero di revisioni incluse
    approvalStakeholders?: string; // Stakeholder per approvazione
    deliveryMethods?: string; // Modalità di consegna preferita

    // Metadata
    status: 'Bozza' | 'Inviato' | 'In Revisione' | 'Approvato';
    createdAt: string;
    updatedAt?: string;
    createdBy?: string;

    // Legacy/Optional
    description?: string;
    serviceCategoryId?: string;
    attachments?: Attachment[];
}

export interface ServiceContract {
    id: string;
    clientId: string;
    services: string[];
    startDate: string;
    endDate?: string;
    budget?: number;
    notes?: string;
}

export interface Message {
    id: string;
    text: string;
    senderId: string;
    userId?: string; // Alias for senderId
    timestamp: string;
    attachments?: Attachment[];
    replyCount?: number;
    readBy?: string[];  // Array of user IDs who have read this message
    reactions?: Record<string, string[]>;  // emoji -> array of user IDs
    replyTo?: {
        id: string;
        text: string;
        senderId: string;
        username?: string;
    };
    isEdited?: boolean;
    deleted?: boolean;
    deletedAt?: string;
}

export interface Conversation {
    id: string;
    memberIds: string[];
    lastMessage?: Message;
    type?: 'direct' | 'group_channel' | 'client_channel';
    name?: string;
    createdAt?: string;
    updatedAt?: string;
}

// Notification Types
export type NotificationType =
    // Tasks
    | 'task_assigned'
    | 'task_due_soon'      // 24h before
    | 'task_due_urgent'    // 3h before
    | 'task_overdue'
    | 'task_comment'
    | 'task_approval_requested'
    | 'task_client_approval_requested'
    | 'task_approved'
    | 'task_rejected'
    | 'task_attachment'
    | 'client_approval_reminder'
    // Projects
    | 'project_added'
    | 'project_due_soon'
    | 'project_completed'
    | 'project_new_task'
    // Absences
    | 'absence_request'
    | 'absence_approved'
    | 'absence_rejected'
    | 'absence_colleague'
    // Chat
    | 'chat_message'
    | 'chat_mention'
    | 'chat_group_added'
    | 'chat_unread_reminder'
    // Briefs
    | 'brief_assigned'
    | 'brief_approved'
    | 'brief_revision'
    // Editorial
    | 'editorial_due_soon'
    | 'editorial_publish_today'
    // Calendar
    | 'calendar_reminder'
    | 'calendar_event_assigned';

export interface Notification {
    id: string;
    userId: string;
    text: string;
    title?: string;
    link?: string;
    type: NotificationType;
    category: 'task' | 'project' | 'absence' | 'chat' | 'brief' | 'editorial' | 'calendar' | 'system';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    isRead: boolean;
    timestamp: string;
    resourceId?: string;
    resourceType?: string;
    readAt?: string;
    emailSent?: boolean;
    chatSent?: boolean;
    metadata?: Record<string, any>;
}

// Global notification settings (admin-managed)
export interface GlobalNotificationSettings {
    // By category - which channels are enabled globally
    categories: {
        task: { inApp: boolean; email: boolean; chat: boolean };
        project: { inApp: boolean; email: boolean; chat: boolean };
        absence: { inApp: boolean; email: boolean; chat: boolean };
        chat: { inApp: boolean; email: boolean; chat: boolean };
        brief: { inApp: boolean; email: boolean; chat: boolean };
        editorial: { inApp: boolean; email: boolean; chat: boolean };
        calendar: { inApp: boolean; email: boolean; chat: boolean };
    };
    // Quiet hours (global)
    quietHoursEnabled: boolean;
    quietHoursStart?: string; // "22:00"
    quietHoursEnd?: string;   // "08:00"
    // Email settings
    emailEnabled: boolean;
    emailFromName: string;
    emailFromAddress: string;
    // Chat bot settings
    chatBotEnabled: boolean;
    // Brevo API key (stored securely)
    brevoApiKey?: string;
}

// Email Template for customizable notifications
export interface EmailTemplate {
    id: string;
    type: NotificationType;
    name: string;
    subject: string;
    headerTitle: string;
    headerColor: string; // Gradient CSS
    bodyContent: string; // HTML content with placeholders like {{userName}}, {{taskTitle}}
    buttonText: string;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
}

// Available placeholders for email templates
export const EMAIL_TEMPLATE_PLACEHOLDERS = {
    common: ['{{userName}}', '{{link}}'],
    task: ['{{taskTitle}}', '{{taskId}}', '{{priority}}', '{{dueDate}}', '{{assignedBy}}', '{{approverName}}', '{{requesterName}}', '{{reason}}'],
    project: ['{{projectName}}', '{{projectId}}', '{{clientName}}', '{{deadline}}', '{{days}}'],
    absence: ['{{type}}', '{{startDate}}', '{{endDate}}'],
    chat: ['{{senderName}}', '{{preview}}', '{{conversationName}}', '{{groupName}}', '{{count}}'],
    brief: ['{{briefTitle}}'],
    editorial: ['{{topic}}', '{{clientName}}'],
    calendar: ['{{eventTitle}}', '{{date}}']
};

// Editorial Plan Types
export interface EditorialContent {
    id: string;
    topic: string;
    clientId: string;
    format: string;
    status: string;
    publicationDate?: string;
    focus?: string;
    copy?: string;
    facebook: boolean;
    instagram: boolean;
    igStories?: boolean;
    linkedin: boolean;
    tiktok: boolean;
    youtube: boolean;
    gbp: boolean;
    tags?: string;
    imageUrls?: string[];
    videoUrl?: string; // URL for video content
    taskId?: string;
    projectId?: string;
    customFields?: Record<string, string>;
    createdAt?: string;
    updatedAt?: string;
}

export interface EditorialFormat {
    id: string;
    name: string;
    description?: string;
}

export interface EditorialColumn {
    id: string;
    name: string;
    slug: string;
    type: 'text' | 'textarea' | 'select';
    options?: string[];
    clientIds?: string[];
}

export interface EditorialStatus {
    id: string;
    name: string;
    color?: string;
    order?: number;
}

// Team type
export interface Team {
    id: string;
    name: string;
    description?: string;
    memberIds: string[];
    members?: string[]; // Alias for memberIds for backward compatibility
    leaderId?: string;
    color?: string;
}

// Editorial Pillar type
export interface EditorialPillar {
    id: string;
    name: string;
    description?: string;
    color?: string;
    clientId?: string;
}

// Department type
export interface Department {
    id: string;
    name: string;
    description?: string;
    memberIds?: string[];
    members?: string[]; // Alias for memberIds
    color?: string;
}

// Recurring Task type
export interface RecurringTask {
    id: string;
    title: string;
    description?: string;
    priority: 'Bassa' | 'Media' | 'Alta' | 'Critica';
    clientId: string;
    projectId?: string;
    activityType?: string;
    estimatedDuration: number;
    assignedUserId?: string;
    recurrence: RecurrenceConfig;
    isActive: boolean;
    nextRunDate?: string;
    createdAt?: string;
}

export interface TaskPrioritySettings {
    id?: string;
    Bassa: number;
    Media: number;
    Alta: number;
    Critica: number;
}

// ... (User update handled separately or below if in range)

// Recurrence Configuration
export interface RecurrenceConfig {
    type: 'Settimanale' | 'Mensile' | 'Annuale' | 'Trimestrale' | 'daily' | 'weekly' | 'monthly'; // Or string
    time?: string;
    dayOfWeek?: number;
    weekOfMonth?: number;
    interval?: number;
    endDate?: string; // Data di fine della ricorrenza
}



// Task Template type
export interface TaskTemplate {
    id?: string;
    tempId?: number;
    title: string;
    description?: string;
    priority: 'Bassa' | 'Media' | 'Alta' | 'Critica';
    estimatedDuration: number;
    offsetDays: number;
    activityType?: string;
    assignedUserId?: string;
    dueDateConfig?: {
        type: 'PROJECT_END' | 'DAYS_BEFORE_END';
        value?: number;
    };
}

// Task Template Bundle - Set riutilizzabile di template per task
export interface TaskTemplateBundle {
    id: string;
    name: string;
    description?: string;
    category?: 'Social Media' | 'Design' | 'Development' | 'Marketing' | 'Content' | 'Altro';
    tasks: TaskTemplate[];
    createdBy: string;
    isPublic: boolean; // Disponibile a tutto il team
    clientIds?: string[]; // Se specificati, suggerito solo per questi clienti
    createdAt?: string;
    updatedAt?: string;
}

// Recurring Project type
export interface RecurringProject {
    id: string;
    name: string;
    description?: string;
    clientId: string;
    teamLeaderId?: string;
    recurrence: 'Settimanale' | 'Mensile' | 'Trimestrale' | 'Annuale' | RecurrenceConfig;
    durationDays: number;
    taskTemplates: TaskTemplate[];
    isActive: boolean;
    nextRunDate?: string;
    lastGenerated?: string;
    createdAt?: string;
    projectDetails: { // Required now
        name: string;
        description?: string;
        budget?: number;
        clientId: string;
        teamLeaderId?: string;
        priority: 'Bassa' | 'Media' | 'Alta' | 'Critica';
    };
}

export const allTaskStatuses: Task['status'][] = [
    'Da Fare',
    'In Lavorazione',
    'In Approvazione',
    'In Approvazione Cliente',
    'Approvato',
    'Annullato'
];

export const allTaskPriorities: Task['priority'][] = [
    'Bassa',
    'Media',
    'Alta',
    'Critica'
];

export const allUserRoles: User['role'][] = [
    'Amministratore',
    'Project Manager',
    'Collaboratore',
    'Cliente'
];

export const allAbsenceTypes: Absence['type'][] = [
    'Ferie',
    'Malattia',
    'Permesso',
    'Altro'
];
