// Automation Types and Default Rules
// Separate file to avoid "use server" restrictions

export interface AutomationRule {
    id: string;
    name: string;
    description: string;
    isActive: boolean;
    trigger: {
        type: 'task_created' | 'task_updated' | 'task_due_soon' | 'task_overdue' |
        'project_status_change' | 'brief_approved' | 'time_based' | 'task_stuck';
        conditions?: {
            field: string;
            operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
            value: any;
        }[];
    };
    actions: {
        type: 'send_notification' | 'send_email' | 'update_field' | 'create_task' | 'add_label';
        config: Record<string, any>;
    }[];
    createdAt: string;
    updatedAt: string;
    createdBy: string;
}

export interface AutomationLog {
    id: string;
    ruleId: string;
    ruleName: string;
    triggerType: string;
    entityType: 'task' | 'project' | 'brief';
    entityId: string;
    actionsExecuted: string[];
    status: 'success' | 'partial' | 'failed';
    error?: string;
    executedAt: string;
}

// Default automation rules
export const DEFAULT_AUTOMATION_RULES: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>[] = [
    {
        name: 'Notifica Task in Scadenza (24h)',
        description: 'Invia notifica quando un task scade entro 24 ore',
        isActive: true,
        trigger: {
            type: 'task_due_soon',
            conditions: [{ field: 'hoursUntilDue', operator: 'less_than', value: 24 }]
        },
        actions: [
            { type: 'send_notification', config: { to: 'assignee', title: 'Task in scadenza!', template: 'task_due_soon' } },
            { type: 'send_email', config: { to: 'assignee', subject: 'Task in scadenza tra 24h', template: 'task_due_soon' } }
        ]
    },
    {
        name: 'Notifica Task Scaduto',
        description: 'Notifica admin e team leader quando un task è scaduto',
        isActive: true,
        trigger: {
            type: 'task_overdue',
            conditions: []
        },
        actions: [
            { type: 'send_notification', config: { to: 'admin', title: 'Task scaduto!', template: 'task_overdue' } },
            { type: 'send_notification', config: { to: 'team_leader', title: 'Task scaduto nel tuo progetto', template: 'task_overdue' } }
        ]
    },
    {
        name: 'Reminder Approvazione in Attesa',
        description: 'Ricorda all\'approvatore dopo 48h',
        isActive: true,
        trigger: {
            type: 'task_stuck',
            conditions: [
                { field: 'status', operator: 'equals', value: 'In Approvazione' },
                { field: 'daysSinceUpdate', operator: 'greater_than', value: 2 }
            ]
        },
        actions: [
            { type: 'send_notification', config: { to: 'admin', title: 'Task in attesa di approvazione', template: 'approval_reminder' } }
        ]
    },
    {
        name: 'Reminder Approvazione Cliente',
        description: 'Ricorda al cliente dopo 4 giorni',
        isActive: true,
        trigger: {
            type: 'task_stuck',
            conditions: [
                { field: 'status', operator: 'equals', value: 'In Approvazione Cliente' },
                { field: 'daysSinceUpdate', operator: 'greater_than', value: 4 }
            ]
        },
        actions: [
            { type: 'send_notification', config: { to: 'admin', title: 'Task in attesa di approvazione cliente', template: 'client_approval_reminder' } }
        ]
    },
    {
        name: 'Aggiorna Stato Progetto Automatico',
        description: 'Quando tutti i task sono completati, completa il progetto',
        isActive: true,
        trigger: {
            type: 'task_updated',
            conditions: [{ field: 'status', operator: 'equals', value: 'Approvato' }]
        },
        actions: [
            { type: 'update_field', config: { entity: 'project', field: 'status', value: 'Completato', condition: 'all_tasks_completed' } }
        ]
    },
    {
        name: 'Task da Brief Approvato',
        description: 'Crea task standard quando un brief viene approvato',
        isActive: true,
        trigger: {
            type: 'brief_approved',
            conditions: []
        },
        actions: [
            {
                type: 'create_task', config: {
                    title: 'Produzione contenuto - {brief.title}',
                    status: 'Da Fare',
                    priority: 'Media',
                    copyFromBrief: ['clientId', 'projectId', 'description']
                }
            },
            {
                type: 'create_task', config: {
                    title: 'Revisione - {brief.title}',
                    status: 'Da Fare',
                    priority: 'Media',
                    copyFromBrief: ['clientId', 'projectId']
                }
            }
        ]
    },
    {
        name: 'Notifica Nuovo Task Assegnato',
        description: 'Notifica l\'utente quando gli viene assegnato un task',
        isActive: true,
        trigger: {
            type: 'task_created',
            conditions: [{ field: 'assignedUserId', operator: 'not_equals', value: null }]
        },
        actions: [
            { type: 'send_notification', config: { to: 'assignee', title: 'Nuovo task assegnato', template: 'task_assigned' } }
        ]
    }
];
