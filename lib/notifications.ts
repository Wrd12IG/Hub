/**
 * Notification Service
 * Centralized service for creating and managing notifications across the app
 * Settings are managed globally by admin
 */

import { db } from './firebase';
import { collection, addDoc, doc, getDoc, getDocs, updateDoc, setDoc, Timestamp } from 'firebase/firestore';
import type { Notification, NotificationType, GlobalNotificationSettings, User, Task, Absence, Brief, CalendarActivity, EditorialContent, Client, Project, ActivityType } from './data';

// Default global notification settings
const DEFAULT_SETTINGS: GlobalNotificationSettings = {
    categories: {
        task: { inApp: true, email: true, chat: true },
        project: { inApp: true, email: true, chat: false },
        absence: { inApp: true, email: true, chat: true },
        chat: { inApp: true, email: false, chat: false },
        brief: { inApp: true, email: true, chat: true },
        editorial: { inApp: true, email: true, chat: false },
        calendar: { inApp: true, email: true, chat: false }
    },
    quietHoursEnabled: false,
    emailEnabled: true,
    emailFromName: 'W[r]Digital Hub',
    emailFromAddress: 'hub@wrdigital.it',
    chatBotEnabled: false
};

// Notification templates
const NOTIFICATION_TEMPLATES: Record<NotificationType, {
    title: string;
    getText: (data: any) => string;
    category: Notification['category'];
    priority: Notification['priority'];
}> = {
    // Tasks
    task_assigned: {
        title: '📋 Nuovo task assegnato',
        getText: (d) => `Ti è stato assegnato il task "${d.taskTitle}"`,
        category: 'task',
        priority: 'high'
    },
    task_due_soon: {
        title: '⏰ Task in scadenza',
        getText: (d) => `Il task "${d.taskTitle}" scade tra 24 ore`,
        category: 'task',
        priority: 'normal'
    },
    task_due_urgent: {
        title: '🚨 Task in scadenza urgente',
        getText: (d) => `Il task "${d.taskTitle}" scade tra 3 ore!`,
        category: 'task',
        priority: 'urgent'
    },
    task_overdue: {
        title: '❌ Task scaduto',
        getText: (d) => `Il task "${d.taskTitle}" è scaduto`,
        category: 'task',
        priority: 'urgent'
    },
    task_comment: {
        title: '💬 Nuovo commento',
        getText: (d) => `${d.userName} ha commentato su "${d.taskTitle}"`,
        category: 'task',
        priority: 'normal'
    },
    task_approval_requested: {
        title: '✅ Richiesta approvazione',
        getText: (d) => `Il task "${d.taskTitle}" richiede la tua approvazione`,
        category: 'task',
        priority: 'high'
    },
    task_client_approval_requested: {
        title: '👥 Richiesta approvazione cliente',
        getText: (d) => `Il task "${d.taskTitle}" richiede l'approvazione del cliente`,
        category: 'task',
        priority: 'high'
    },
    task_approved: {
        title: '🎉 Task approvato',
        getText: (d) => `Il tuo task "${d.taskTitle}" è stato approvato`,
        category: 'task',
        priority: 'normal'
    },
    task_rejected: {
        title: '🔄 Task da rivedere',
        getText: (d) => `Il task "${d.taskTitle}" è stato rifiutato: ${d.reason || 'Verifica i dettagli'}`,
        category: 'task',
        priority: 'high'
    },
    task_attachment: {
        title: '📎 Nuovo allegato',
        getText: (d) => `${d.userName} ha aggiunto un allegato a "${d.taskTitle}"`,
        category: 'task',
        priority: 'low'
    },
    client_approval_reminder: {
        title: '⏳ Sollecito approvazione cliente',
        getText: (d) => `Il task "${d.taskTitle}" è in attesa di approvazione cliente da oltre 4 giorni`,
        category: 'task',
        priority: 'high'
    },

    // Projects
    project_added: {
        title: '📁 Aggiunto a progetto',
        getText: (d) => `Sei stato aggiunto al progetto "${d.projectName}"`,
        category: 'project',
        priority: 'normal'
    },
    project_due_soon: {
        title: '📅 Progetto in scadenza',
        getText: (d) => `Il progetto "${d.projectName}" scade tra ${d.days} giorni`,
        category: 'project',
        priority: 'high'
    },
    project_completed: {
        title: '🎊 Progetto completato',
        getText: (d) => `Il progetto "${d.projectName}" è stato completato!`,
        category: 'project',
        priority: 'normal'
    },
    project_new_task: {
        title: '📋 Nuovo task nel progetto',
        getText: (d) => `Nuovo task "${d.taskTitle}" nel progetto "${d.projectName}"`,
        category: 'project',
        priority: 'low'
    },

    // Absences
    absence_request: {
        title: '🏖️ Richiesta assenza',
        getText: (d) => `${d.userName} ha richiesto ${d.type} dal ${d.startDate} al ${d.endDate}`,
        category: 'absence',
        priority: 'high'
    },
    absence_approved: {
        title: '✅ Assenza approvata',
        getText: (d) => `La tua richiesta di ${d.type} è stata approvata`,
        category: 'absence',
        priority: 'normal'
    },
    absence_rejected: {
        title: '❌ Assenza rifiutata',
        getText: (d) => `La tua richiesta di ${d.type} è stata rifiutata`,
        category: 'absence',
        priority: 'high'
    },
    absence_colleague: {
        title: '👋 Collega in ferie',
        getText: (d) => `${d.userName} sarà assente domani`,
        category: 'absence',
        priority: 'low'
    },

    // Chat
    chat_message: {
        title: '💬 Nuovo messaggio',
        getText: (d) => `${d.senderName}: ${d.preview}`,
        category: 'chat',
        priority: 'normal'
    },
    chat_mention: {
        title: '📢 Ti hanno menzionato',
        getText: (d) => `${d.senderName} ti ha menzionato in ${d.conversationName}`,
        category: 'chat',
        priority: 'high'
    },
    chat_group_added: {
        title: '👥 Aggiunto a gruppo',
        getText: (d) => `Sei stato aggiunto al gruppo "${d.groupName}"`,
        category: 'chat',
        priority: 'normal'
    },
    chat_unread_reminder: {
        title: '📬 Messaggi non letti',
        getText: (d) => `Hai ${d.count} messaggi non letti`,
        category: 'chat',
        priority: 'low'
    },

    // Briefs
    brief_assigned: {
        title: '📝 Nuovo brief',
        getText: (d) => `Ti è stato assegnato il brief "${d.briefTitle}"`,
        category: 'brief',
        priority: 'high'
    },
    brief_approved: {
        title: '✅ Brief approvato',
        getText: (d) => `Il brief "${d.briefTitle}" è stato approvato`,
        category: 'brief',
        priority: 'normal'
    },
    brief_revision: {
        title: '🔄 Brief in revisione',
        getText: (d) => `Il brief "${d.briefTitle}" richiede modifiche`,
        category: 'brief',
        priority: 'normal'
    },

    // Editorial
    editorial_due_soon: {
        title: '📰 Contenuto in scadenza',
        getText: (d) => `Il contenuto "${d.topic}" per ${d.clientName} scade domani`,
        category: 'editorial',
        priority: 'high'
    },
    editorial_publish_today: {
        title: '📢 Da pubblicare oggi',
        getText: (d) => `Pubblica "${d.topic}" per ${d.clientName}`,
        category: 'editorial',
        priority: 'urgent'
    },

    // Calendar
    calendar_reminder: {
        title: '📆 Promemoria evento',
        getText: (d) => `"${d.eventTitle}" tra 15 minuti`,
        category: 'calendar',
        priority: 'high'
    },
    calendar_event_assigned: {
        title: '📅 Nuovo evento',
        getText: (d) => `Nuovo evento: "${d.eventTitle}" il ${d.date}`,
        category: 'calendar',
        priority: 'normal'
    }
};

// ============ GLOBAL SETTINGS ============

/**
 * Get global notification settings (admin-managed)
 */
export async function getGlobalNotificationSettings(): Promise<GlobalNotificationSettings> {
    try {
        const docRef = doc(db, 'settings', 'notifications');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { ...DEFAULT_SETTINGS, ...docSnap.data() } as GlobalNotificationSettings;
        }

        return DEFAULT_SETTINGS;
    } catch (error) {
        console.error('Error getting notification settings:', error);
        return DEFAULT_SETTINGS;
    }
}

/**
 * Save global notification settings (admin only)
 */
export async function saveGlobalNotificationSettings(
    settings: Partial<GlobalNotificationSettings>
): Promise<void> {
    try {
        const docRef = doc(db, 'settings', 'notifications');
        const current = await getGlobalNotificationSettings();
        await setDoc(docRef, { ...current, ...settings });
    } catch (error) {
        console.error('Error saving notification settings:', error);
        throw error;
    }
}

/**
 * Check if notification should be sent based on global settings and quiet hours
 */
function shouldSendNotification(
    settings: GlobalNotificationSettings,
    category: Notification['category'],
    channel: 'inApp' | 'email' | 'chat'
): boolean {
    // System notifications always go through
    if (category === 'system') return true;

    // Check email enabled for email channel
    if (channel === 'email' && !settings.emailEnabled) return false;

    // Check chat bot enabled for chat channel
    if (channel === 'chat' && !settings.chatBotEnabled) return false;

    // Check if category allows this channel
    const categoryKey = category as keyof typeof settings.categories;
    const categorySettings = settings.categories[categoryKey];
    if (categorySettings && !categorySettings[channel]) return false;

    // Check quiet hours
    if (settings.quietHoursEnabled && settings.quietHoursStart && settings.quietHoursEnd) {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const start = settings.quietHoursStart;
        const end = settings.quietHoursEnd;

        if (start > end) {
            if (currentTime >= start || currentTime < end) return false;
        } else {
            if (currentTime >= start && currentTime < end) return false;
        }
    }

    return true;
}

// ============ NOTIFICATION CREATION ============

const cleanData = (data: any): any => {
    const cleaned: any = {};
    Object.keys(data).forEach(key => {
        if (data[key] !== undefined) {
            cleaned[key] = data[key];
        }
    });
    return cleaned;
};

/**
 * Create a notification for a user
 */
export async function createNotification(
    userId: string,
    type: NotificationType,
    data: Record<string, any>,
    options?: {
        link?: string;
        resourceId?: string;
        resourceType?: string;
        skipEmail?: boolean;
        skipChat?: boolean;
    }
): Promise<string | null> {
    try {
        const template = NOTIFICATION_TEMPLATES[type];
        if (!template) {
            console.error(`Unknown notification type: ${type}`);
            return null;
        }

        const settings = await getGlobalNotificationSettings();

        // Check if in-app notification should be created
        const shouldCreateInApp = shouldSendNotification(settings, template.category, 'inApp');

        if (!shouldCreateInApp && !options?.link) {
            return null;
        }

        const notification: Omit<Notification, 'id'> = {
            userId,
            type,
            title: template.title,
            text: template.getText(data),
            category: template.category,
            priority: template.priority,
            link: options?.link,
            resourceId: options?.resourceId,
            resourceType: options?.resourceType,
            isRead: false,
            timestamp: new Date().toISOString(),
            emailSent: false,
            chatSent: false,
            metadata: data
        };


        const cleanedNotification = cleanData(notification);

        // Create in-app notification in User subcollection to match frontend LayoutContext
        const docRef = await addDoc(collection(db, 'users', userId, 'notifications'), cleanedNotification);

        // Check if email should be sent
        const shouldSendEmail = !options?.skipEmail &&
            shouldSendNotification(settings, template.category, 'email');

        if (shouldSendEmail) {
            await sendEmailNotification(userId, notification, settings);
            await updateDoc(doc(db, 'users', userId, 'notifications', docRef.id), { emailSent: true });
        }

        // Check if chat notification should be sent
        const shouldSendChat = !options?.skipChat &&
            shouldSendNotification(settings, template.category, 'chat');

        if (shouldSendChat) {
            await sendChatNotification(userId, notification);
            await updateDoc(doc(db, 'users', userId, 'notifications', docRef.id), { chatSent: true });
        }

        return docRef.id;
    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
}

/**
 * Create notifications for multiple users
 */
export async function createNotificationForUsers(
    userIds: string[],
    type: NotificationType,
    data: Record<string, any>,
    options?: {
        link?: string;
        resourceId?: string;
        resourceType?: string;
    }
): Promise<void> {
    await Promise.all(
        userIds.map(userId => createNotification(userId, type, data, options))
    );
}

// ============ EMAIL SERVICE (BREVO) ============

/**
 * Send email notification via Brevo API
 */
async function sendEmailNotification(
    userId: string,
    notification: Omit<Notification, 'id'>,
    settings: GlobalNotificationSettings
): Promise<void> {
    // Get user email
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        console.error('User not found for email notification:', userId);
        return;
    }

    const user = userSnap.data() as User;
    if (!user.email) {
        console.error('User has no email:', userId);
        return;
    }

    // Use server action for secure sending
    // Dynamic import to avoid build issues if mixed with client code
    try {
        const { sendEmailServerAction } = await import('./email-server');

        const subject = notification.title?.replace(/[^\w\s]/gi, '') || 'Notifica Hub';
        const htmlContent = await generateEmailHtml(notification, user.name);

        const result = await sendEmailServerAction(
            user.email,
            user.name,
            subject,
            htmlContent,
            settings.emailFromName,
            settings.emailFromAddress
        );

        if (!result.success) {
            throw new Error(result.error);
        }

        console.log('[EMAIL] Sent successfully via server action to:', user.email);
    } catch (error) {
        console.error('Error sending email:', error);

        // Queue for retry
        await addDoc(collection(db, 'emailQueue'), {
            to: user.email,
            toName: user.name,
            subject: notification.title,
            body: notification.text,
            link: notification.link,
            type: notification.type,
            status: 'failed',
            error: String(error),
            createdAt: Timestamp.now()
        });
    }
}

/**
 * Generate HTML email content using custom templates or fallback to professional defaults
 */
async function generateEmailHtml(notification: Omit<Notification, 'id'>, userName: string): Promise<string> {
    const data = notification.metadata || {};
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:9002';
    const link = notification.link ? `${baseUrl}${notification.link}` : '#';

    // Try to get custom template first
    try {
        const { getEmailTemplateByType } = await import('./actions');
        const customTemplate = await getEmailTemplateByType(notification.type);

        if (customTemplate && customTemplate.isActive) {
            return generateFromCustomTemplate(customTemplate, userName, data, link);
        }
    } catch (error) {
        console.log('[EMAIL] No custom template found, using default');
    }

    // Fallback to default template generation
    return generateDefaultEmailHtml(notification, userName, data, link);
}

/**
 * Generate email from custom template with placeholder replacement
 */
function generateFromCustomTemplate(
    template: import('./data').EmailTemplate,
    userName: string,
    data: Record<string, any>,
    link: string
): string {
    // Replace placeholders in content
    let content = template.bodyContent;

    // Standard replacements
    const replacements: Record<string, string> = {
        '{{userName}}': userName,
        '{{link}}': link,
        '{{taskTitle}}': data.taskTitle || '',
        '{{taskId}}': data.taskId || '',
        '{{priority}}': data.priority || 'Normale',
        '{{dueDate}}': data.dueDate ? new Date(data.dueDate).toLocaleDateString('it-IT') : 'N/D',
        '{{assignedBy}}': data.assignedBy || '',
        '{{approverName}}': data.approverName || '',
        '{{requesterName}}': data.requesterName || '',
        '{{reason}}': data.reason || '',
        '{{projectName}}': data.projectName || '',
        '{{projectId}}': data.projectId || '',
        '{{clientName}}': data.clientName || '',
        '{{deadline}}': data.deadline ? new Date(data.deadline).toLocaleDateString('it-IT') : 'N/D',
        '{{days}}': String(data.days || ''),
        '{{type}}': data.type || '',
        '{{startDate}}': data.startDate ? new Date(data.startDate).toLocaleDateString('it-IT') : 'N/D',
        '{{endDate}}': data.endDate ? new Date(data.endDate).toLocaleDateString('it-IT') : 'N/D',
        '{{senderName}}': data.senderName || '',
        '{{preview}}': data.preview || '',
        '{{conversationName}}': data.conversationName || '',
        '{{groupName}}': data.groupName || '',
        '{{count}}': String(data.count || ''),
        '{{briefTitle}}': data.briefTitle || '',
        '{{topic}}': data.topic || '',
        '{{eventTitle}}': data.eventTitle || '',
        '{{date}}': data.date || '',
    };

    Object.entries(replacements).forEach(([placeholder, value]) => {
        content = content.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    });

    // Replace in subject too
    let subject = template.subject;
    Object.entries(replacements).forEach(([placeholder, value]) => {
        subject = subject.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    });

    // Common CSS styles
    const styles = `
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f5f5f5; padding: 20px; margin: 0; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .email-header { padding: 30px; text-align: center; }
        .email-header h1 { color: white; margin: 0; font-size: 24px; font-weight: 600; }
        .email-body { padding: 40px 30px; color: #374151; line-height: 1.6; }
        .email-body p { margin: 0 0 15px 0; }
        .email-highlight { background: #f3f4f6; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .email-highlight strong { color: #1f2937; display: block; margin-bottom: 5px; }
        .email-button { display: inline-block; padding: 14px 32px; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 500; text-align: center; }
        .email-footer { background: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb; }
        .email-footer p { color: #6b7280; font-size: 13px; margin: 5px 0; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
        .info-item { background: #f9fafb; padding: 15px; border-radius: 6px; }
        .info-item label { display: block; font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 5px; }
        .info-item strong { color: #1f2937; font-size: 14px; }
        .status-badge { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 500; background: #e5e7eb; color: #374151; }
    `;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${template.headerTitle}</title>
    <style>${styles}</style>
</head>
<body>
    <div class="container">
        <div class="email-header" style="background: ${template.headerColor};">
            <h1>${template.headerTitle}</h1>
        </div>
        <div class="email-body">
            ${content}
            <div style="text-align: center; margin-top: 30px;">
                <a href="${link}" class="email-button" style="background: ${template.headerColor}; color: #ffffff !important;">${template.buttonText}</a>
            </div>
        </div>
        <div class="email-footer">
            <p><strong>W[r]Digital Hub</strong></p>
            <p>Questa è una notifica automatica. Si prega di non rispondere a questa email.</p>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Generate default email HTML (fallback when no custom template exists)
 */
function generateDefaultEmailHtml(notification: Omit<Notification, 'id'>, userName: string, data: Record<string, any>, link: string): string {

    // Common CSS styles from the provided template
    const styles = `
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f5f5f5; padding: 20px; margin: 0; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .email-header { padding: 30px; text-align: center; }
        .email-header h1 { color: white; margin: 0; font-size: 24px; font-weight: 600; }
        .email-body { padding: 40px 30px; color: #374151; line-height: 1.6; }
        .email-body p { margin: 0 0 15px 0; }
        .email-highlight { background: #f3f4f6; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .email-highlight strong { color: #1f2937; display: block; margin-bottom: 5px; }
        .email-button { display: inline-block; padding: 14px 32px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 500; text-align: center; }
        .email-footer { background: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb; }
        .email-footer p { color: #6b7280; font-size: 13px; margin: 5px 0; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
        .info-item { background: #f9fafb; padding: 15px; border-radius: 6px; }
        .info-item label { display: block; font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 5px; }
        .info-item strong { color: #1f2937; font-size: 14px; }
        .status-badge { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 500; background: #e5e7eb; color: #374151; }
    `;

    // Helper to render specific content based on type
    let headerColor = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    let headerTitle = notification.title;
    let buttonText = 'Visualizza Dettagli';
    let contentHtml = '';
    let showButton = true; // Flag per mostrare/nascondere il pulsante

    // Helper per formattare la durata in ore
    const formatDuration = (minutes: number): string => {
        if (!minutes) return 'N/D';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
        if (hours > 0) return `${hours}h`;
        return `${mins}m`;
    };

    // Helper per formattare la priorità con colore
    const getPriorityBadge = (priority: string): string => {
        const colors: Record<string, { bg: string; text: string }> = {
            'Critica': { bg: '#fee2e2', text: '#991b1b' },
            'Alta': { bg: '#fed7aa', text: '#9a3412' },
            'Media': { bg: '#fef3c7', text: '#92400e' },
            'Bassa': { bg: '#d1fae5', text: '#065f46' }
        };
        const c = colors[priority] || colors['Media'];
        return `<span class="status-badge" style="background: ${c.bg}; color: ${c.text};">${priority}</span>`;
    };

    switch (notification.type) {
        // --- TASKS ---
        case 'task_assigned':
            headerColor = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            showButton = false; // Rimuoviamo il pulsante, tutti i dettagli sono nell'email
            contentHtml = `
                <p>Ciao <strong>${userName}</strong>,</p>
                <p>Ti è stato assegnato un nuovo task. Di seguito trovi tutti i dettagli:</p>
                
                <div class="email-highlight">
                    <strong style="font-size: 18px;">📋 ${data.taskTitle}</strong>
                    ${getPriorityBadge(data.priority || 'Media')}
                </div>

                ${data.description ? `
                <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <label style="display: block; font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 8px;">📝 Descrizione</label>
                    <p style="margin: 0; color: #374151; white-space: pre-wrap;">${data.description}</p>
                </div>
                ` : ''}

                <div class="info-grid" style="grid-template-columns: repeat(2, 1fr);">
                    <div class="info-item"><label>📅 Scadenza</label><strong>${data.dueDate ? new Date(data.dueDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Non specificata'}</strong></div>
                    <div class="info-item"><label>⏱️ Tempo Stimato</label><strong>${formatDuration(data.estimatedDuration)}</strong></div>
                    <div class="info-item"><label>⏳ Tempo Effettivo</label><strong>${formatDuration(data.timeSpent) || '0m'}</strong></div>
                    <div class="info-item"><label>🏢 Cliente</label><strong>${data.clientName || 'N/D'}</strong></div>
                    <div class="info-item"><label>📁 Progetto</label><strong>${data.projectName || 'Nessuno'}</strong></div>
                    <div class="info-item"><label>🎯 Tipo Attività</label><strong>${data.activityType || 'Non specificato'}</strong></div>
                    <div class="info-item"><label>👤 Assegnato da</label><strong>${data.assignedBy || 'Admin'}</strong></div>
                </div>

                ${data.notes ? `
                <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px 20px; border-radius: 4px; margin: 20px 0;">
                    <label style="display: block; font-size: 12px; color: #92400e; text-transform: uppercase; margin-bottom: 8px;">📌 Note</label>
                    <p style="margin: 0; color: #78350f;">${data.notes}</p>
                </div>
                ` : ''}

                <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #6b7280; font-size: 13px;">
                        📧 Questa email contiene tutte le informazioni del task. Buon lavoro!
                    </p>
                </div>
            `;
            break;

        case 'task_approval_requested':
            headerColor = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
            headerTitle = '✅ Richiesta di Approvazione';
            showButton = false;
            contentHtml = `
                <p>Ciao <strong>${userName}</strong>,</p>
                <p>Il seguente task è stato completato e necessita della tua approvazione.</p>
                
                <div class="email-highlight">
                    <strong style="font-size: 18px;">📋 ${data.taskTitle}</strong>
                    <span class="status-badge" style="background: #fef3c7; color: #92400e;">In Attesa di Approvazione</span>
                </div>

                ${data.description ? `
                <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <label style="display: block; font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 8px;">📝 Descrizione</label>
                    <p style="margin: 0; color: #374151; white-space: pre-wrap;">${data.description}</p>
                </div>
                ` : ''}

                <div class="info-grid" style="grid-template-columns: repeat(2, 1fr);">
                    <div class="info-item"><label>👤 Richiesto da</label><strong>${data.requesterName || 'Utente'}</strong></div>
                    <div class="info-item"><label>📅 Scadenza</label><strong>${data.dueDate ? new Date(data.dueDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }) : 'N/D'}</strong></div>
                    <div class="info-item"><label>🏢 Cliente</label><strong>${data.clientName || 'N/D'}</strong></div>
                    <div class="info-item"><label>📁 Progetto</label><strong>${data.projectName || 'Nessuno'}</strong></div>
                    <div class="info-item"><label>⏱️ Tempo Impiegato</label><strong>${formatDuration(data.timeSpent)}</strong></div>
                    <div class="info-item"><label>🎯 Tipo Attività</label><strong>${data.activityType || 'Non specificato'}</strong></div>
                </div>

                ${data.attachmentCount ? `
                <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px 20px; border-radius: 4px; margin: 20px 0;">
                    <p style="margin: 0; color: #1e40af;">📎 <strong>${data.attachmentCount} allegat${data.attachmentCount > 1 ? 'i' : 'o'}</strong> disponibil${data.attachmentCount > 1 ? 'i' : 'e'} per la revisione</p>
                </div>
                ` : ''}

                <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #6b7280; font-size: 13px;">
                        ⚠️ Per approvare o richiedere modifiche, accedi all'app WRDigital Hub.
                    </p>
                </div>
            `;
            break;

        case 'task_approved':
            headerColor = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            headerTitle = '🎉 Task Approvato';
            showButton = false;
            contentHtml = `
                <p>Ciao <strong>${userName}</strong>,</p>
                <p>Ottimo lavoro! Il tuo task è stato approvato.</p>
                
                <div class="email-highlight">
                    <strong style="font-size: 18px;">✅ ${data.taskTitle}</strong>
                    <span class="status-badge" style="background: #d1fae5; color: #065f46;">Approvato</span>
                </div>

                <div class="info-grid" style="grid-template-columns: repeat(2, 1fr);">
                    <div class="info-item"><label>👤 Approvato da</label><strong>${data.approverName || 'Manager'}</strong></div>
                    <div class="info-item"><label>📅 Data</label><strong>${new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></div>
                    <div class="info-item"><label>🏢 Cliente</label><strong>${data.clientName || 'N/D'}</strong></div>
                    <div class="info-item"><label>📁 Progetto</label><strong>${data.projectName || 'Nessuno'}</strong></div>
                </div>

                ${data.approvalNotes ? `
                <div style="background: #d1fae5; border-left: 4px solid #10b981; padding: 15px 20px; border-radius: 4px; margin: 20px 0;">
                    <label style="display: block; font-size: 12px; color: #065f46; text-transform: uppercase; margin-bottom: 8px;">💬 Note approvazione</label>
                    <p style="margin: 0; color: #047857;">${data.approvalNotes}</p>
                </div>
                ` : ''}

                <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                    <p style="margin: 0; color: #059669; font-size: 14px;">🎊 Complimenti per l'ottimo lavoro!</p>
                </div>
            `;
            break;

        case 'task_rejected':
            headerColor = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
            headerTitle = '🔄 Task da Rivedere';
            showButton = false;
            contentHtml = `
                <p>Ciao <strong>${userName}</strong>,</p>
                <p>Il task richiede delle revisioni. Leggi attentamente il feedback per procedere.</p>
                
                <div class="email-highlight">
                    <strong style="font-size: 18px;">📋 ${data.taskTitle}</strong>
                    <span class="status-badge" style="background: #fee2e2; color: #991b1b;">Da Rivedere</span>
                </div>

                <div style="background: #fff5f5; border: 1px solid #fecaca; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <label style="display: block; font-size: 12px; color: #991b1b; text-transform: uppercase; margin-bottom: 10px;">❌ Motivo del Rifiuto</label>
                    <p style="margin: 0; color: #b91c1c; font-size: 15px;">${data.reason || 'Sono necessarie alcune modifiche. Contatta il revisore per maggiori dettagli.'}</p>
                </div>

                <div class="info-grid" style="grid-template-columns: repeat(2, 1fr);">
                    <div class="info-item"><label>👤 Rifiutato da</label><strong>${data.approverName || 'Revisore'}</strong></div>
                    <div class="info-item"><label>📅 Data</label><strong>${new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</strong></div>
                    <div class="info-item"><label>🏢 Cliente</label><strong>${data.clientName || 'N/D'}</strong></div>
                    <div class="info-item"><label>📁 Progetto</label><strong>${data.projectName || 'Nessuno'}</strong></div>
                </div>

                <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #6b7280; font-size: 13px;">⚠️ Apporta le modifiche richieste e invia nuovamente il task per l'approvazione.</p>
                </div>
            `;
            break;

        case 'task_comment':
            headerColor = 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)';
            headerTitle = '💬 Nuovo Commento';
            showButton = false;
            contentHtml = `
                <p>Ciao <strong>${userName}</strong>,</p>
                <p>È stato aggiunto un nuovo commento al task.</p>
                
                <div class="email-highlight" style="border-left-color: #8b5cf6;">
                    <strong style="font-size: 18px;">📋 ${data.taskTitle}</strong>
                </div>

                <div style="background: #faf5ff; border: 1px solid #e9d5ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <div style="display: flex; align-items: flex-start; gap: 12px;">
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #8b5cf6, #6d28d9); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 16px;">
                            ${(data.commenterName || data.userName || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div style="flex: 1;">
                            <div style="margin-bottom: 8px;">
                                <strong style="color: #1f2937;">${data.commenterName || data.userName || 'Utente'}</strong>
                                <span style="color: #9ca3af; font-size: 12px; margin-left: 8px;">${data.commentDate || new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #e9d5ff;">
                                <p style="margin: 0; color: #374151; white-space: pre-wrap;">${data.commentText || 'Nuovo commento sul task.'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="info-grid" style="grid-template-columns: repeat(2, 1fr);">
                    <div class="info-item"><label>🏢 Cliente</label><strong>${data.clientName || 'N/D'}</strong></div>
                    <div class="info-item"><label>📁 Progetto</label><strong>${data.projectName || 'Nessuno'}</strong></div>
                </div>

                <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #6b7280; font-size: 13px;">💬 Per rispondere, accedi all'app WRDigital Hub.</p>
                </div>
            `;
            break;

        // --- ABSENCES ---
        case 'absence_request':
            headerColor = 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)';
            headerTitle = '🏖️ Nuova Richiesta Assenza';
            buttonText = 'Gestisci Richiesta';
            contentHtml = `
                <p>Ciao <strong>${userName}</strong>,</p>
                <p>Hai ricevuto una nuova richiesta di assenza da approvare.</p>
                
                <div class="email-highlight" style="border-left-color: #06b6d4;">
                    <strong>Richiedente: ${data.userName}</strong>
                    <span class="status-badge" style="background: #fef3c7; color: #92400e;">In Attesa</span>
                </div>

                <div class="info-grid">
                    <div class="info-item"><label>Tipo</label><strong>${data.type}</strong></div>
                    <div class="info-item"><label>Periodo</label><strong>${new Date(data.startDate).toLocaleDateString('it-IT')} - ${new Date(data.endDate).toLocaleDateString('it-IT')}</strong></div>
                </div>
            `;
            break;

        case 'absence_approved':
            headerColor = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            headerTitle = '✈️ Richiesta Approvata';
            buttonText = 'Vedi Calendario';
            contentHtml = `
                <p>Ciao <strong>${userName}</strong>,</p>
                <p>Buone notizie! La tua richiesta di assenza è stata approvata.</p>
                
                <div class="email-highlight">
                    <strong>Periodo di Assenza (${data.type})</strong>
                    <span class="status-badge" style="background: #d1fae5; color: #065f46;">Approvata</span>
                </div>

                <div class="info-grid">
                    <div class="info-item"><label>Dal</label><strong>${new Date(data.startDate).toLocaleDateString('it-IT')}</strong></div>
                    <div class="info-item"><label>Al</label><strong>${new Date(data.endDate).toLocaleDateString('it-IT')}</strong></div>
                </div>
            `;
            break;

        case 'absence_rejected':
            headerColor = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
            headerTitle = '❌ Richiesta Rifiutata';
            contentHtml = `
                <p>Ciao <strong>${userName}</strong>,</p>
                <p>Ci dispiace, la tua richiesta di assenza è stata rifiutata.</p>
                
                <div class="email-highlight" style="border-left-color: #ef4444;">
                    <strong>Periodo: ${new Date(data.startDate).toLocaleDateString('it-IT')} - ${new Date(data.endDate).toLocaleDateString('it-IT')}</strong>
                    <span class="status-badge" style="background: #fee2e2; color: #991b1b;">Rifiutata</span>
                </div>
            `;
            break;

        // --- PROJECTS ---
        case 'project_added':
            headerColor = 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)';
            headerTitle = '🚀 Nuovo Progetto Assegnato';
            buttonText = 'Accedi al Progetto';
            contentHtml = `
                <p>Ciao <strong>${userName}</strong>,</p>
                <p>Sei stato aggiunto a un nuovo progetto! Ecco i dettagli:</p>
                
                <div class="email-highlight" style="border-left-color: #ec4899;">
                    <strong>Progetto: ${data.projectName}</strong>
                </div>

                <div class="info-grid">
                    <div class="info-item"><label>Cliente</label><strong>${data.clientName || 'N/D'}</strong></div>
                    <div class="info-item"><label>Scadenza</label><strong>${data.deadline ? new Date(data.deadline).toLocaleDateString('it-IT') : 'N/D'}</strong></div>
                </div>
            `;
            break;

        case 'project_due_soon':
            headerColor = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
            contentHtml = `
                <p>Ciao <strong>${userName}</strong>,</p>
                <p>Promemoria importante: il progetto è in scadenza.</p>
                
                <div class="email-highlight" style="border-left-color: #f59e0b;">
                    <strong>Progetto: ${data.projectName}</strong>
                    <div style="margin-top: 5px;"><span class="status-badge" style="background: #fed7aa; color: #9a3412;">Scadenza tra ${data.days} giorni</span></div>
                </div>
            `;
            break;

        // --- BRIEFS ---
        case 'brief_assigned':
            headerColor = 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)';
            headerTitle = '📝 Nuovo Brief da Gestire';
            buttonText = 'Apri Brief Completo';
            contentHtml = `
                <p>Ciao <strong>${userName}</strong>,</p>
                <p>È stato creato un nuovo brief che richiede la tua gestione.</p>
                
                <div class="email-highlight" style="border-left-color: #14b8a6;">
                    <strong>Brief: ${data.briefTitle}</strong>
                </div>

                <p style="margin-top: 20px;">Analizza il brief e organizza il lavoro con il team.</p>
            `;
            break;

        // --- EDITORIAL ---
        case 'editorial_publish_today':
            headerColor = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
            headerTitle = '📱 Contenuto da Pubblicare Oggi';
            buttonText = 'Visualizza Calendario Editoriale';
            contentHtml = `
                <p>Ciao <strong>${userName}</strong>,</p>
                <p>Promemoria: hai dei contenuti programmati per la pubblicazione di oggi.</p>
                
                <div class="email-highlight" style="border-left-color: #6366f1;">
                    <strong>Cliente: ${data.clientName}</strong>
                    <span class="status-badge" style="background: #e0e7ff; color: #3730a3;">Da Pubblicare Oggi</span>
                </div>

                <div style="background: white; padding: 15px; border-radius: 4px; margin-bottom: 10px; border-left: 3px solid #6366f1; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <strong style="color: #1f2937;">${data.topic}</strong>
                </div>
            `;
            break;

        // --- CALENDAR ---
        case 'calendar_event_assigned':
        case 'calendar_reminder':
            headerColor = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
            headerTitle = '🔔 Evento Calendario';
            buttonText = 'Visualizza Evento';
            contentHtml = `
                <p>Ciao <strong>${userName}</strong>,</p>
                <p>Promemoria per il seguente evento in calendario:</p>
                
                <div class="email-highlight" style="border-left-color: #ef4444;">
                    <strong>${data.eventTitle}</strong>
                </div>

                <div class="info-grid">
                    <div class="info-item"><label>Data</label><strong>${data.date || 'Oggi'}</strong></div>
                </div>
            `;
            break;

        default:
            contentHtml = `
                <p>Ciao <strong>${userName}</strong>,</p>
                <p>${notification.text}</p>
            `;
    }

    // Wrap everything in the container
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${headerTitle}</title>
    <style>${styles}</style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="email-header" style="background: ${headerColor};">
            <h1>${headerTitle}</h1>
        </div>
        
        <!-- Body -->
        <div class="email-body">
            ${contentHtml}
            
            ${showButton ? `
            <div style="text-align: center; margin-top: 30px;">
                <a href="${link}" class="email-button" style="background: ${headerColor}; color: #ffffff !important;">${buttonText}</a>
            </div>
            ` : ''}
        </div>
        
        <!-- Footer -->
        <div class="email-footer">
            <p><strong>W[r]Digital Hub</strong></p>
            <p>Questa è una notifica automatica. Si prega di non rispondere a questa email.</p>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Send chat notification (via system bot)
 */
async function sendChatNotification(
    userId: string,
    notification: Omit<Notification, 'id'>
): Promise<void> {
    // TODO: Implement chat bot notification
    console.log(`[CHAT] Would send to user ${userId}:`, notification.title, notification.text);
}

/**
 * Helper function to get task related data (client, project, activity type)
 */
async function getTaskRelatedData(task: Task): Promise<{
    clientName: string;
    projectName: string;
    activityType: string;
}> {
    let clientName = '';
    let projectName = '';
    let activityTypeName = '';

    try {
        if (task.clientId) {
            const clientSnap = await getDoc(doc(db, 'clients', task.clientId));
            if (clientSnap.exists()) {
                clientName = (clientSnap.data() as Client).name || '';
            }
        }

        if (task.projectId) {
            const projectSnap = await getDoc(doc(db, 'projects', task.projectId));
            if (projectSnap.exists()) {
                projectName = (projectSnap.data() as Project).name || '';
            }
        }

        if (task.activityType) {
            const activitySnap = await getDoc(doc(db, 'activityTypes', task.activityType));
            if (activitySnap.exists()) {
                activityTypeName = (activitySnap.data() as ActivityType).name || task.activityType;
            } else {
                activityTypeName = task.activityType;
            }
        }
    } catch (error) {
        console.error('Error fetching task related data:', error);
    }

    return { clientName, projectName, activityType: activityTypeName };
}

/**
 * Notify about task assignment
 */
export async function notifyTaskAssigned(
    task: Task,
    assignedUserId: string,
    assignedByName: string
): Promise<void> {
    const relatedData = await getTaskRelatedData(task);

    await createNotification(assignedUserId, 'task_assigned', {
        taskTitle: task.title,
        taskId: task.id,
        assignedBy: assignedByName,
        description: task.description || '',
        priority: task.priority,
        dueDate: task.dueDate,
        estimatedDuration: task.estimatedDuration,
        timeSpent: task.timeSpent || 0,
        ...relatedData
    }, {
        link: `/tasks?taskId=${task.id}`,
        resourceId: task.id,
        resourceType: 'task'
    });
}

/**
 * Notify about task comment
 */
export async function notifyTaskComment(
    task: Task,
    commentUserId: string,
    commentUserName: string,
    commentText?: string
): Promise<void> {
    if (task.assignedUserId && task.assignedUserId !== commentUserId) {
        const relatedData = await getTaskRelatedData(task);

        await createNotification(task.assignedUserId, 'task_comment', {
            taskTitle: task.title,
            taskId: task.id,
            userName: commentUserName,
            commenterName: commentUserName,
            commentText: commentText || '',
            commentDate: new Date().toISOString(),
            ...relatedData
        }, {
            link: `/tasks?taskId=${task.id}`,
            resourceId: task.id,
            resourceType: 'task'
        });
    }
}

/**
 * Notify about task approval request
 */
export async function notifyTaskApprovalRequested(
    task: Task,
    approverIds: string[],
    requesterName: string
): Promise<void> {
    const relatedData = await getTaskRelatedData(task);

    await createNotificationForUsers(approverIds, 'task_approval_requested', {
        taskTitle: task.title,
        taskId: task.id,
        requesterName,
        description: task.description || '',
        dueDate: task.dueDate,
        timeSpent: task.timeSpent,
        attachmentCount: task.attachments?.length || 0,
        ...relatedData
    }, {
        link: `/tasks?taskId=${task.id}`,
        resourceId: task.id,
        resourceType: 'task'
    });
}

/**
 * Notify about task client approval request
 */
export async function notifyTaskClientApprovalRequested(
    task: Task,
    approverIds: string[],
    requesterName: string
): Promise<void> {
    const relatedData = await getTaskRelatedData(task);

    await createNotificationForUsers(approverIds, 'task_client_approval_requested', {
        taskTitle: task.title,
        taskId: task.id,
        requesterName,
        description: task.description || '',
        dueDate: task.dueDate,
        timeSpent: task.timeSpent,
        attachmentCount: task.attachments?.length || 0,
        ...relatedData
    }, {
        link: `/tasks?taskId=${task.id}`,
        resourceId: task.id,
        resourceType: 'task'
    });
}

/**
 * Notify about task approval
 */
export async function notifyTaskApproved(
    task: Task,
    approverName: string,
    approvalNotes?: string
): Promise<void> {
    if (task.assignedUserId) {
        const relatedData = await getTaskRelatedData(task);

        await createNotification(task.assignedUserId, 'task_approved', {
            taskTitle: task.title,
            taskId: task.id,
            approverName,
            approvalNotes: approvalNotes || '',
            ...relatedData
        }, {
            link: `/tasks?taskId=${task.id}`,
            resourceId: task.id,
            resourceType: 'task'
        });
    }
}

/**
 * Notify about task rejection
 */
export async function notifyTaskRejected(
    task: Task,
    rejectorName: string,
    reason?: string
): Promise<void> {
    if (task.assignedUserId) {
        const relatedData = await getTaskRelatedData(task);

        await createNotification(task.assignedUserId, 'task_rejected', {
            taskTitle: task.title,
            taskId: task.id,
            approverName: rejectorName,
            reason,
            ...relatedData
        }, {
            link: `/tasks?taskId=${task.id}`,
            resourceId: task.id,
            resourceType: 'task'
        });
    }
}

/**
 * Notify about absence request (to managers)
 */
export async function notifyAbsenceRequest(
    absence: Absence,
    userName: string,
    managerIds: string[]
): Promise<void> {
    await createNotificationForUsers(managerIds, 'absence_request', {
        userName,
        type: absence.type,
        startDate: absence.startDate,
        endDate: absence.endDate,
        absenceId: absence.id
    }, {
        link: '/absences',
        resourceId: absence.id,
        resourceType: 'absence'
    });
}

/**
 * Notify about absence approval
 */
export async function notifyAbsenceApproved(
    absence: Absence
): Promise<void> {
    await createNotification(absence.userId, 'absence_approved', {
        type: absence.type,
        startDate: absence.startDate,
        endDate: absence.endDate
    }, {
        link: '/absences',
        resourceId: absence.id,
        resourceType: 'absence'
    });
}

/**
 * Notify about absence rejection
 */
export async function notifyAbsenceRejected(
    absence: Absence
): Promise<void> {
    await createNotification(absence.userId, 'absence_rejected', {
        type: absence.type,
        startDate: absence.startDate,
        endDate: absence.endDate
    }, {
        link: '/absences',
        resourceId: absence.id,
        resourceType: 'absence'
    });
}

/**
 * Notify about new chat message
 */
export async function notifyChatMessage(
    recipientId: string,
    senderName: string,
    preview: string,
    conversationId: string
): Promise<void> {
    await createNotification(recipientId, 'chat_message', {
        senderName,
        preview: preview.substring(0, 50) + (preview.length > 50 ? '...' : '')
    }, {
        link: `/chat?conversationId=${conversationId}`,
        resourceId: conversationId,
        resourceType: 'conversation',
        skipChat: true
    });
}

/**
 * Notify about brief assignment
 */
export async function notifyBriefAssigned(
    brief: Brief,
    assignedUserId: string
): Promise<void> {
    await createNotification(assignedUserId, 'brief_assigned', {
        briefTitle: brief.title || brief.projectName,
        briefId: brief.id
    }, {
        link: `/briefs?briefId=${brief.id}`,
        resourceId: brief.id,
        resourceType: 'brief'
    });
}

/**
 * Notify about brief approval
 */
export async function notifyBriefApproved(
    brief: Brief,
    userId: string
): Promise<void> {
    if (brief.createdBy) {
        await createNotification(brief.createdBy, 'brief_approved', {
            briefTitle: brief.title || brief.projectName,
            briefId: brief.id
        }, {
            link: `/briefs?briefId=${brief.id}`,
            resourceId: brief.id,
            resourceType: 'brief'
        });
    }
}

/**
 * Notify about editorial content due soon
 */
export async function notifyEditorialDueSoon(
    content: EditorialContent,
    assignedUserId: string,
    clientName: string
): Promise<void> {
    await createNotification(assignedUserId, 'editorial_due_soon', {
        topic: content.topic,
        clientName,
        contentId: content.id
    }, {
        link: `/editorial-plan?contentId=${content.id}`,
        resourceId: content.id,
        resourceType: 'editorial'
    });
}

/**
 * Notify about editorial content to publish today
 */
export async function notifyEditorialPublishToday(
    content: EditorialContent,
    assignedUserId: string,
    clientName: string
): Promise<void> {
    await createNotification(assignedUserId, 'editorial_publish_today', {
        topic: content.topic,
        clientName,
        contentId: content.id
    }, {
        link: `/editorial-plan?contentId=${content.id}`,
        resourceId: content.id,
        resourceType: 'editorial'
    });
}

/**
 * Notify about calendar event
 */
export async function notifyCalendarEvent(
    event: CalendarActivity,
    userId: string
): Promise<void> {
    // Supporta sia startTime che start (legacy)
    const eventStart = event.startTime || event.start;
    if (!eventStart) return;

    const date = new Date(eventStart).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    await createNotification(userId, 'calendar_event_assigned', {
        eventTitle: event.title,
        date,
        eventId: event.id
    }, {
        link: `/calendar?date=${eventStart.split('T')[0]}`,
        resourceId: event.id,
        resourceType: 'calendar'
    });
}

/**
 * Notify calendar reminder (15 min before)
 */
export async function notifyCalendarReminder(
    event: CalendarActivity,
    userId: string
): Promise<void> {
    // Supporta sia startTime che start (legacy)
    const eventStart = event.startTime || event.start || '';

    await createNotification(userId, 'calendar_reminder', {
        eventTitle: event.title,
        eventId: event.id
    }, {
        link: `/calendar?date=${eventStart.split('T')[0]}`,
        resourceId: event.id,
        resourceType: 'calendar'
    });
}

export { NOTIFICATION_TEMPLATES, DEFAULT_SETTINGS };
