// Firebase actions for CRUD operations
import { db } from './firebase';
import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    Timestamp,
    setDoc,
    query,
    where,
    limit,
    deleteField
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type {
    User, Client, Project, Task, ActivityType, Absence,
    RolePermissions, CalendarActivity, TaskPrioritySettings,
    CalendarActivityPreset, BriefService, BriefServiceCategory,
    ServiceContract, Notification, EditorialContent, EditorialFormat,
    EditorialColumn, EditorialStatus, RecurringTask, RecurringProject,
    Message, Attachment, Department, Team, EditorialPillar, Brief,
    CompanyCosts
} from './data';
import {
    notifyTaskAssigned,
    notifyTaskComment,
    notifyTaskApprovalRequested,
    notifyTaskApproved,
    notifyTaskRejected,
    notifyAbsenceRequest,
    notifyAbsenceApproved,
    notifyAbsenceRejected,
    notifyChatMessage,
    notifyBriefAssigned,
    notifyBriefApproved,
    notifyCalendarEvent,
    notifyEditorialDueSoon,
    notifyEditorialPublishToday
} from './notifications';

// Helper to convert Firestore timestamps
const convertTimestamps = (data: any): any => {
    if (!data) return data;
    if (data instanceof Timestamp) {
        return data.toDate().toISOString();
    }
    if (Array.isArray(data)) {
        return data.map(item => convertTimestamps(item));
    }
    if (typeof data === 'object' && data !== null) {
        const converted: any = {};
        for (const key in data) {
            converted[key] = convertTimestamps(data[key]);
        }
        return converted;
    }
    return data;
};

async function fetchCollection<T>(collectionName: string): Promise<T[]> {
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...convertTimestamps(doc.data())
    })) as T[];
}

// Helper to remove undefined values (Firestores doesn't like them)
const cleanData = (data: any): any => {
    const cleaned: any = {};
    Object.keys(data).forEach(key => {
        if (data[key] !== undefined) {
            cleaned[key] = data[key];
        }
    });
    return cleaned;
};

// Users
export async function getUsers(): Promise<User[]> {
    return fetchCollection<User>('users');
}

export async function getUser(userId: string): Promise<User | null> {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...convertTimestamps(docSnap.data()) } as User;
    }
    return null;
}

export async function addUser(userId: string, userData: Omit<User, 'id'>): Promise<void> {
    await setDoc(doc(db, 'users', userId), {
        ...cleanData(userData),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
}

export async function updateUser(userId: string, data: Partial<User>): Promise<void> {
    await updateDoc(doc(db, 'users', userId), {
        ...cleanData(data),
        updatedAt: Timestamp.now(),
    });
}

// Clients
export async function getClients(): Promise<Client[]> {
    return fetchCollection<Client>('clients');
}

export async function addClient(data: Omit<Client, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'clients'), {
        ...cleanData(data),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
    return docRef.id;
}

export async function updateClient(clientId: string, data: Partial<Client>): Promise<void> {
    await updateDoc(doc(db, 'clients', clientId), {
        ...cleanData(data),
        updatedAt: Timestamp.now(),
    });
}

export async function deleteClient(clientId: string): Promise<void> {
    await deleteDoc(doc(db, 'clients', clientId));
}

// Projects
export async function getProjects(): Promise<Project[]> {
    return fetchCollection<Project>('projects');
}

export async function getProject(projectId: string): Promise<Project | null> {
    const docRef = doc(db, 'projects', projectId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...convertTimestamps(docSnap.data()) } as Project;
    }
    return null;
}

export async function addProject(data: Omit<Project, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'projects'), {
        ...cleanData(data),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
    return docRef.id;
}

export async function updateProject(projectId: string, data: Partial<Project>): Promise<void> {
    await updateDoc(doc(db, 'projects', projectId), {
        ...cleanData(data),
        updatedAt: Timestamp.now(),
    });
}

// Client Public Link Actions
export async function generateClientPublicLink(clientId: string) {
    const token = crypto.randomUUID();
    await updateDoc(doc(db, 'clients', clientId), {
        publicToken: token,
        publicTokenCreatedAt: Timestamp.now().toDate().toISOString(),
        updatedAt: Timestamp.now(),
    });
    return token;
}

export async function revokeClientPublicLink(clientId: string) {
    await updateDoc(doc(db, 'clients', clientId), {
        publicToken: null, // o deleteField() in firestore puro, ma qui updateDoc merge. null va bene se handled
        publicTokenCreatedAt: null,
        updatedAt: Timestamp.now(),
    });
}

export async function deleteProject(projectId: string): Promise<void> {
    await deleteDoc(doc(db, 'projects', projectId));
}

// Tasks
export async function getTasks(): Promise<Task[]> {
    return fetchCollection<Task>('tasks');
}

export async function getTask(taskId: string): Promise<Task | null> {
    const docRef = doc(db, 'tasks', taskId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...convertTimestamps(docSnap.data()) } as Task;
    }
    return null;
}

export async function addTask(data: Omit<Task, 'id'>, createdBy: string): Promise<{ taskId: string }> {
    const cleanedData = cleanData(data);
    const docRef = await addDoc(collection(db, 'tasks'), {
        ...cleanedData,
        createdBy,
        status: 'Da Fare',
        timeSpent: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });

    // Send notification if task is assigned to someone
    if (data.assignedUserId && data.assignedUserId !== createdBy) {
        try {
            const creatorUser = await getUser(createdBy);
            const task = { ...data, id: docRef.id } as Task;
            await notifyTaskAssigned(task, data.assignedUserId, creatorUser?.name || 'Un collega');
        } catch (error) {
            console.error('Error sending task assignment notification:', error);
        }
    }

    return { taskId: docRef.id };
}

export async function updateTask(
    taskId: string,
    data: Partial<Task>,
    userId: string,
    canApprove: boolean = false,
    sendEmail: boolean = false
): Promise<void> {
    // Get current task for comparison
    const currentTask = await getTask(taskId);

    // Validazione lato server: verifica allegati prima di passare a "In Approvazione"
    if (data.status === 'In Approvazione' && currentTask?.status !== 'In Approvazione') {
        const skipAttachment = data.skipAttachmentOnApproval ?? currentTask?.skipAttachmentOnApproval ?? false;

        if (!skipAttachment) {
            const attachments = data.attachments ?? currentTask?.attachments ?? [];

            if (attachments.length === 0) {
                throw new Error('È necessario aggiungere almeno un link o una grafica prima di inviare il task in approvazione.');
            }
        }
    }

    const updateData: any = cleanData({
        ...data,
        updatedAt: Timestamp.now(),
    });

    if (data.status === 'Approvato' && canApprove) {
        const approvals = currentTask?.approvals || [];
        approvals.push({
            userId,
            timestamp: new Date().toISOString(),
        });
        updateData.approvals = approvals;
    }

    // Salva la data di annullamento quando il task viene annullato
    if (data.status === 'Annullato' && currentTask?.status !== 'Annullato') {
        updateData.cancelledAt = new Date().toISOString();
    }

    await updateDoc(doc(db, 'tasks', taskId), updateData);

    // Get user name for notifications
    const actionUser = await getUser(userId);
    const actionUserName = actionUser?.name || 'Un collega';
    const updatedTask = { ...currentTask, ...data, id: taskId } as Task;

    try {
        // Notify on task approval
        if (data.status === 'Approvato' && currentTask?.status !== 'Approvato') {
            await notifyTaskApproved(updatedTask, actionUserName);
        }

        // Notify on task rejection (sent back for revision)
        if (data.status === 'Da Fare' && currentTask?.status === 'In Approvazione') {
            await notifyTaskRejected(updatedTask, actionUserName, data.rejectionReason);
        }

        // Notify on task assigned to new user
        if (data.assignedUserId &&
            data.assignedUserId !== currentTask?.assignedUserId &&
            data.assignedUserId !== userId) {
            await notifyTaskAssigned(updatedTask, data.assignedUserId, actionUserName);
        }

        // Notify approvers when task is sent for approval
        if (data.status === 'In Approvazione' && currentTask?.status !== 'In Approvazione') {
            // Get users for approval notification
            const users = await getUsers();
            const approverIds: string[] = [];

            // 1. Add all Administrators (except the requester)
            users
                .filter(u => u.role === 'Amministratore' && u.id !== userId)
                .forEach(u => approverIds.push(u.id));

            // 2. Add the task creator if they are a Project Manager (and not the requester)
            const taskCreatorId = updatedTask.createdBy;
            if (taskCreatorId && taskCreatorId !== userId) {
                const creator = users.find(u => u.id === taskCreatorId);
                // Only notify the creator if they are a PM and not already in the list
                if (creator && creator.role === 'Project Manager' && !approverIds.includes(taskCreatorId)) {
                    approverIds.push(taskCreatorId);
                }
            }

            if (approverIds.length > 0) {
                await notifyTaskApprovalRequested(updatedTask, approverIds, actionUserName);
            }
        }
    } catch (error) {
        console.error('Error sending task notifications:', error);
    }

    // Auto-complete project if all tasks are done
    if (data.status === 'Approvato') {
        if (updatedTask?.projectId) {
            await checkAndCompleteProject(updatedTask.projectId);
        }
    }
}

// Start timer on a task
export async function startTaskTimer(taskId: string, userId: string): Promise<void> {
    await updateDoc(doc(db, 'tasks', taskId), {
        timerStartedAt: new Date().toISOString(),
        timerUserId: userId,
        updatedAt: Timestamp.now()
    });
}

// Stop timer on a task and save elapsed time
export async function stopTaskTimer(taskId: string, additionalTimeSpent: number): Promise<void> {
    const taskDoc = await getDoc(doc(db, 'tasks', taskId));
    const currentTimeSpent = taskDoc.data()?.timeSpent || 0;

    await updateDoc(doc(db, 'tasks', taskId), {
        timeSpent: currentTimeSpent + additionalTimeSpent,
        timerStartedAt: deleteField(),
        timerUserId: deleteField(),
        updatedAt: Timestamp.now()
    });
}

// Check if all tasks of a project are completed and update project status
export async function checkAndCompleteProject(projectId: string): Promise<boolean> {
    const allTasks = await getTasks();
    const projectTasks = allTasks.filter(t => t.projectId === projectId);

    // No tasks = don't auto-complete
    if (projectTasks.length === 0) return false;

    // Check if all non-cancelled tasks are approved
    const activeTasks = projectTasks.filter(t => t.status !== 'Annullato');
    if (activeTasks.length === 0) return false;

    const allCompleted = activeTasks.every(t => t.status === 'Approvato');

    if (allCompleted) {
        const project = await getProject(projectId);
        // Only update if not already completed
        if (project && project.status !== 'Completato') {
            await updateProject(projectId, { status: 'Completato' });
            return true;
        }
    }

    return false;
}

// Batch function to complete all projects that should be completed
export async function autoCompleteAllProjects(): Promise<{ updated: string[], count: number }> {
    const allProjects = await getProjects();
    const allTasks = await getTasks();
    const updated: string[] = [];

    for (const project of allProjects) {
        // Skip already completed or cancelled projects
        if (project.status === 'Completato' || project.status === 'Annullato') continue;

        const projectTasks = allTasks.filter(t => t.projectId === project.id);

        // Skip projects with no tasks
        if (projectTasks.length === 0) continue;

        // Check if all non-cancelled tasks are approved
        const activeTasks = projectTasks.filter(t => t.status !== 'Annullato');
        if (activeTasks.length === 0) continue;

        const allCompleted = activeTasks.every(t => t.status === 'Approvato');

        if (allCompleted) {
            await updateProject(project.id, { status: 'Completato' });
            updated.push(project.name);
        }
    }

    return { updated, count: updated.length };
}

export async function deleteTask(taskId: string, userId: string): Promise<void> {
    await deleteDoc(doc(db, 'tasks', taskId));
}

// Activity Types
export async function getActivityTypes(): Promise<ActivityType[]> {
    return fetchCollection<ActivityType>('activityTypes');
}

export async function addActivityType(data: Omit<ActivityType, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'activityTypes'), data);
    return docRef.id;
}

export async function updateActivityType(id: string, data: Partial<ActivityType>): Promise<void> {
    await updateDoc(doc(db, 'activityTypes', id), data);
}

export async function deleteActivityType(id: string): Promise<void> {
    await deleteDoc(doc(db, 'activityTypes', id));
}

// Absences
export async function getAbsences(): Promise<Absence[]> {
    return fetchCollection<Absence>('absences');
}

export async function addAbsence(data: Omit<Absence, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'absences'), {
        ...data,
        createdAt: Timestamp.now(),
    });

    // Notify managers about the absence request
    try {
        const users = await getUsers();
        const requestUser = users.find(u => u.id === data.userId);
        const managerIds = users
            .filter(u => u.role === 'Amministratore' || u.role === 'Project Manager')
            .filter(u => u.id !== data.userId)
            .map(u => u.id);

        if (managerIds.length > 0) {
            const absence = { ...data, id: docRef.id } as Absence;
            await notifyAbsenceRequest(absence, requestUser?.name || 'Un collega', managerIds);
        }
    } catch (error) {
        console.error('Error sending absence notification:', error);
    }

    return docRef.id;
}

export async function updateAbsence(id: string, data: Partial<Absence>): Promise<void> {
    // Get current absence for comparison
    const absenceRef = doc(db, 'absences', id);
    const absenceSnap = await getDoc(absenceRef);
    const currentAbsence = absenceSnap.exists() ? { id, ...absenceSnap.data() } as Absence : null;

    await updateDoc(absenceRef, data);

    // Send notification if status changed
    if (currentAbsence && data.status && data.status !== currentAbsence.status) {
        try {
            const updatedAbsence = { ...currentAbsence, ...data } as Absence;
            if (data.status === 'Approvato') {
                await notifyAbsenceApproved(updatedAbsence);
            } else if (data.status === 'Rifiutato') {
                await notifyAbsenceRejected(updatedAbsence);
            }
        } catch (error) {
            console.error('Error sending absence status notification:', error);
        }
    }
}

export async function deleteAbsence(id: string): Promise<void> {
    await deleteDoc(doc(db, 'absences', id));
}

// Role Permissions
export async function getRolePermissions(): Promise<RolePermissions> {
    const snapshot = await getDocs(collection(db, 'rolePermissions'));
    const permissions: RolePermissions = {};
    snapshot.docs.forEach(doc => {
        permissions[doc.id] = doc.data().permissions || [];
    });
    return permissions;
}

// Calendar Activities
export async function getCalendarActivities(): Promise<CalendarActivity[]> {
    return fetchCollection<CalendarActivity>('calendarActivities');
}

export async function addCalendarActivity(data: Omit<CalendarActivity, 'id'>, createdBy?: string): Promise<string> {
    const docRef = await addDoc(collection(db, 'calendarActivities'), {
        ...data,
        createdAt: Timestamp.now(),
    });

    // Send notification if activity is assigned to a user AND it's not the creator
    if (data.userId && data.userId !== createdBy) {
        try {
            const activity = { ...data, id: docRef.id } as CalendarActivity;
            await notifyCalendarEvent(activity, data.userId);
        } catch (error) {
            console.error('Error sending calendar notification:', error);
        }
    }

    return docRef.id;
}

export async function updateCalendarActivity(id: string, data: Partial<CalendarActivity>): Promise<void> {
    await updateDoc(doc(db, 'calendarActivities', id), data);
}

export async function deleteCalendarActivity(id: string): Promise<void> {
    await deleteDoc(doc(db, 'calendarActivities', id));
}

// Calendar Activity Presets
export async function getCalendarActivityPresets(): Promise<CalendarActivityPreset[]> {
    return fetchCollection<CalendarActivityPreset>('calendarActivityPresets');
}

export async function addCalendarActivityPreset(data: Omit<CalendarActivityPreset, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'calendarActivityPresets'), data);
    return docRef.id;
}

export async function updateCalendarActivityPreset(id: string, data: Partial<CalendarActivityPreset>): Promise<void> {
    await updateDoc(doc(db, 'calendarActivityPresets', id), data);
}

export async function deleteCalendarActivityPreset(id: string): Promise<void> {
    await deleteDoc(doc(db, 'calendarActivityPresets', id));
}

// Task Priority Settings
export async function getTaskPrioritySettings(): Promise<TaskPrioritySettings | null> {
    const docRef = doc(db, 'settings', 'taskPriority');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as TaskPrioritySettings;
    }
    return null;
}

export async function updateTaskPrioritySettings(data: Partial<TaskPrioritySettings>): Promise<void> {
    await setDoc(doc(db, 'settings', 'taskPriority'), data, { merge: true });
}

// Brief Services
export async function getBriefServices(): Promise<BriefService[]> {
    return fetchCollection<BriefService>('briefServices');
}

export async function addBriefService(data: Omit<BriefService, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'briefServices'), data);
    return docRef.id;
}

export async function updateBriefService(id: string, data: Partial<BriefService>): Promise<void> {
    await updateDoc(doc(db, 'briefServices', id), data);
}

export async function deleteBriefService(id: string): Promise<void> {
    await deleteDoc(doc(db, 'briefServices', id));
}

export async function getBriefServiceCategories(): Promise<BriefServiceCategory[]> {
    return fetchCollection<BriefServiceCategory>('briefServiceCategories');
}

export async function addBriefServiceCategory(data: Omit<BriefServiceCategory, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'briefServiceCategories'), data);
    return docRef.id;
}

export async function deleteBriefServiceCategory(id: string): Promise<void> {
    await deleteDoc(doc(db, 'briefServiceCategories', id));
}

// Service Contracts
export async function getServiceContracts(): Promise<ServiceContract[]> {
    return fetchCollection<ServiceContract>('serviceContracts');
}

// Notifications
export async function createNotification(
    userId: string,
    notification: Omit<Notification, 'id' | 'userId' | 'isRead' | 'timestamp'>
): Promise<void> {
    await addDoc(collection(db, 'users', userId, 'notifications'), {
        ...notification,
        isRead: false,
        timestamp: Timestamp.now(),
    });
}

export async function markNotificationAsRead(userId: string, notificationId: string): Promise<void> {
    await updateDoc(doc(db, 'users', userId, 'notifications', notificationId), {
        isRead: true,
    });
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
    const notificationsRef = collection(db, 'users', userId, 'notifications');
    const q = query(notificationsRef, where('isRead', '==', false));
    const snapshot = await getDocs(q);
    await Promise.all(snapshot.docs.map(docSnap =>
        updateDoc(doc(db, 'users', userId, 'notifications', docSnap.id), { isRead: true })
    ));
}

export async function deleteNotification(userId: string, notificationId: string): Promise<void> {
    await deleteDoc(doc(db, 'users', userId, 'notifications', notificationId));
}


// Editorial Content
export async function getEditorialContents(): Promise<EditorialContent[]> {
    return fetchCollection<EditorialContent>('editorialContents');
}

export async function addEditorialContent(data: Omit<EditorialContent, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'editorialContents'), {
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
    return docRef.id;
}

export async function updateEditorialContent(contentId: string, data: Partial<Omit<EditorialContent, 'id'>>): Promise<void> {
    await updateDoc(doc(db, 'editorialContents', contentId), {
        ...data,
        updatedAt: Timestamp.now(),
    });
}

export async function deleteEditorialContent(contentIds: string | string[]): Promise<void> {
    const ids = Array.isArray(contentIds) ? contentIds : [contentIds];
    await Promise.all(ids.map(id => deleteDoc(doc(db, 'editorialContents', id))));
}

// Editorial Formats
export async function getEditorialFormats(): Promise<EditorialFormat[]> {
    return fetchCollection<EditorialFormat>('editorialFormats');
}

// Editorial Statuses
export async function getEditorialStatuses(): Promise<EditorialStatus[]> {
    return fetchCollection<EditorialStatus>('editorialStatuses');
}

// Editorial Columns
export async function getEditorialColumns(): Promise<EditorialColumn[]> {
    return fetchCollection<EditorialColumn>('editorialColumns');
}

// Import Editorial Contents (batch import from CSV)
export async function importEditorialContents(contents: Omit<EditorialContent, 'id'>[]): Promise<{ count: number }> {
    let count = 0;
    for (const content of contents) {
        await addDoc(collection(db, 'editorialContents'), {
            ...content,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });
        count++;
    }
    return { count };
}

// Recurring Tasks
export async function getRecurringTasks(): Promise<RecurringTask[]> {
    return fetchCollection<RecurringTask>('recurringTasks');
}

export async function addRecurringTask(data: Omit<RecurringTask, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'recurringTasks'), {
        ...data,
        createdAt: Timestamp.now(),
    });
    return docRef.id;
}

export async function updateRecurringTask(id: string, data: Partial<RecurringTask>): Promise<void> {
    await updateDoc(doc(db, 'recurringTasks', id), data);
}

export async function deleteRecurringTask(id: string): Promise<void> {
    await deleteDoc(doc(db, 'recurringTasks', id));
}

// Recurring Projects
export async function getRecurringProjects(): Promise<RecurringProject[]> {
    return fetchCollection<RecurringProject>('recurringProjects');
}

export async function addRecurringProject(data: Omit<RecurringProject, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'recurringProjects'), {
        ...data,
        createdAt: Timestamp.now(),
    });
    return docRef.id;
}

export async function updateRecurringProject(id: string, data: Partial<RecurringProject>): Promise<void> {
    await updateDoc(doc(db, 'recurringProjects', id), data);
}

export async function deleteRecurringProject(id: string): Promise<void> {
    await deleteDoc(doc(db, 'recurringProjects', id));
}

// Messages
// Messages
export async function sendMessage(
    conversationId: string,
    text: string,
    senderId: string,
    attachments: Attachment[] = [],
    replyTo?: { id: string; text: string; senderId: string; username?: string }
): Promise<string> {
    const messageData = {
        text,
        senderId,
        userId: senderId, // Alias for compatibility
        attachments,
        timestamp: Timestamp.now(),
        replyCount: 0,
        reactions: {},
        replyTo: replyTo || null
    };

    const docRef = await addDoc(collection(db, 'conversations', conversationId, 'messages'), messageData);

    // Update conversation's lastMessage and updatedAt
    await updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: {
            ...messageData,
            id: docRef.id,
            timestamp: new Date().toISOString() // Store as string for data model compatibility if needed, or rely on converter
        },
        updatedAt: Timestamp.now()
    });

    // Send notifications to other conversation members
    try {
        const convRef = doc(db, 'conversations', conversationId);
        const convSnap = await getDoc(convRef);
        if (convSnap.exists()) {
            const convData = convSnap.data();
            const memberIds = (convData.memberIds || []) as string[];
            const sender = await getUser(senderId);
            const senderName = sender?.name || 'Un collega';

            // Notify all members except sender
            for (const memberId of memberIds) {
                if (memberId !== senderId) {
                    await notifyChatMessage(memberId, senderName, text, conversationId);
                }
            }
        }
    } catch (error) {
        console.error('Error sending chat notifications:', error);
    }

    return docRef.id;
}

export async function toggleMessageReaction(
    conversationId: string,
    messageId: string,
    emoji: string,
    userId: string
): Promise<void> {
    const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    const messageSnap = await getDoc(messageRef);

    if (messageSnap.exists()) {
        const data = messageSnap.data();
        const reactions = data.reactions || {};

        // If user already reacted with this emoji, remove it (toggle)
        // This is a naive implementation; a proper one would handle array of users per emoji
        // Let's assume structure: { [emoji]: [userId1, userId2] }

        const currentUsers = reactions[emoji] || [];
        let newUsers: string[];

        if (currentUsers.includes(userId)) {
            newUsers = currentUsers.filter((id: string) => id !== userId);
        } else {
            newUsers = [...currentUsers, userId];
        }

        if (newUsers.length === 0) {
            delete reactions[emoji];
        } else {
            reactions[emoji] = newUsers;
        }

        await updateDoc(messageRef, { reactions });
    }
}

export async function deleteMessage(conversationId: string, messageId: string, userId: string): Promise<void> {
    const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    await updateDoc(messageRef, {
        deleted: true,
        text: '🚫 Messaggio eliminato',
        deletedAt: new Date().toISOString(),
        // Clear attachments if necessary, or keep them? Usually delete removes content.
        attachments: []
    });
}

export async function editMessage(conversationId: string, messageId: string, newText: string, userId: string): Promise<void> {
    const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    await updateDoc(messageRef, {
        text: newText,
        isEdited: true
    });
}

export async function createOrGetDirectConversation(
    userId1: string,
    userId2: string
): Promise<string> {
    // Check if conversation exists
    const convRef = collection(db, 'conversations');
    const q = query(
        convRef,
        where('type', '==', 'direct'),
        where('memberIds', 'array-contains-any', [userId1, userId2]),
        limit(1)
    );
    const existing = await getDocs(q);

    if (!existing.empty) {
        return existing.docs[0].id;
    }

    const docRef = await addDoc(convRef, {
        memberIds: [userId1, userId2],
        type: 'direct',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    });
    return docRef.id;
}

// Create a group conversation with multiple members
export async function createGroupConversation(
    name: string,
    memberIds: string[],
    creatorId: string
): Promise<string> {
    const convRef = collection(db, 'conversations');
    const docRef = await addDoc(convRef, {
        name,
        memberIds: Array.from(new Set([...memberIds, creatorId])), // Ensure creator is included and no duplicates
        type: 'group_channel',
        createdBy: creatorId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    });
    return docRef.id;
}

// Create a client channel for a specific client
export async function createClientChannel(
    clientId: string,
    clientName: string,
    memberIds: string[],
    creatorId: string
): Promise<string> {
    // Check if a channel for this client already exists
    const convRef = collection(db, 'conversations');
    const q = query(
        convRef,
        where('type', '==', 'client_channel'),
        where('clientId', '==', clientId),
        limit(1)
    );
    const existing = await getDocs(q);

    if (!existing.empty) {
        // Update members if channel exists
        const docId = existing.docs[0].id;
        await updateDoc(doc(db, 'conversations', docId), {
            memberIds: Array.from(new Set([...memberIds, creatorId])),
            updatedAt: Timestamp.now()
        });
        return docId;
    }

    const docRef = await addDoc(convRef, {
        name: `📋 ${clientName}`,
        clientId,
        memberIds: Array.from(new Set([...memberIds, creatorId])),
        type: 'client_channel',
        createdBy: creatorId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    });
    return docRef.id;
}

// Departments
export async function getDepartments(): Promise<Department[]> { return fetchCollection<Department>('departments'); }
export async function addDepartment(data: Omit<Department, 'id'>): Promise<string> { const docRef = await addDoc(collection(db, 'departments'), data); return docRef.id; }
export async function updateDepartment(id: string, data: Partial<Department>): Promise<void> { await updateDoc(doc(db, 'departments', id), data); }
export async function deleteDepartment(id: string): Promise<void> { await deleteDoc(doc(db, 'departments', id)); }

// Teams
export async function getTeams(): Promise<Team[]> { return fetchCollection<Team>('teams'); }
export async function addTeam(data: Omit<Team, 'id'>): Promise<string> { const docRef = await addDoc(collection(db, 'teams'), data); return docRef.id; }
export async function updateTeam(id: string, data: Partial<Team>): Promise<void> { await updateDoc(doc(db, 'teams', id), data); }
export async function deleteTeam(id: string): Promise<void> { await deleteDoc(doc(db, 'teams', id)); }

// Users extra
export async function deleteUser(id: string): Promise<void> { await deleteDoc(doc(db, 'users', id)); }

// Role Permissions extra
export async function updateRolePermissions(roleId: string, permissions: string[]): Promise<void> { await setDoc(doc(db, 'rolePermissions', roleId), { permissions }, { merge: true }); }

// Editorial Pillars
export async function getEditorialPillars(): Promise<EditorialPillar[]> { return fetchCollection<EditorialPillar>('editorialPillars'); }
export async function addEditorialPillar(data: Omit<EditorialPillar, 'id'>): Promise<string> { const docRef = await addDoc(collection(db, 'editorialPillars'), data); return docRef.id; }
export async function deleteEditorialPillar(id: string): Promise<void> { await deleteDoc(doc(db, 'editorialPillars', id)); }

// Editorial Formats extra
export async function addEditorialFormat(data: Omit<EditorialFormat, 'id'>): Promise<string> { const docRef = await addDoc(collection(db, 'editorialFormats'), data); return docRef.id; }
export async function deleteEditorialFormat(id: string): Promise<void> { await deleteDoc(doc(db, 'editorialFormats', id)); }

// Editorial Statuses extra
export async function addEditorialStatus(data: Omit<EditorialStatus, 'id'>): Promise<string> { const docRef = await addDoc(collection(db, 'editorialStatuses'), data); return docRef.id; }
export async function deleteEditorialStatus(id: string): Promise<void> { await deleteDoc(doc(db, 'editorialStatuses', id)); }

// Editorial Columns extra 
export async function addEditorialColumn(data: Omit<EditorialColumn, 'id'>): Promise<string> { const docRef = await addDoc(collection(db, 'editorialColumns'), data); return docRef.id; }
export async function deleteEditorialColumn(id: string): Promise<void> { await deleteDoc(doc(db, 'editorialColumns', id)); }

export async function markNotificationsAsRead(userId: string, notificationIds: string[]): Promise<void> {
    await Promise.all(notificationIds.map(id =>
        updateDoc(doc(db, 'users', userId, 'notifications', id), { isRead: true })
    ));
}

// Attachments
export async function deleteAttachment(taskId: string, attachmentUrl: string): Promise<void> {
    const taskRef = doc(db, 'tasks', taskId);
    const taskSnap = await getDoc(taskRef);
    // ... (existing deleteAttachment)
    if (taskSnap.exists()) {
        const task = taskSnap.data() as Task;
        const attachments = (task.attachments || []).filter(a => a.url !== attachmentUrl);
        await updateDoc(taskRef, { attachments });
    }
}

export async function deleteReadNotifications(userId: string): Promise<void> {
    const notificationsRef = collection(db, 'users', userId, 'notifications');
    const q = query(notificationsRef, where('isRead', '==', true));
    const snapshot = await getDocs(q);
    await Promise.all(snapshot.docs.map(doc => deleteDoc(doc.ref)));
}

export async function addTaskComment(taskId: string, comment: { text: string; userId: string }): Promise<void> {
    const taskRef = doc(db, 'tasks', taskId);
    const taskSnap = await getDoc(taskRef);
    if (taskSnap.exists()) {
        const currentComments = taskSnap.data().comments || [];
        const newComment = {
            id: Math.random().toString(36).substr(2, 9),
            ...comment,
            timestamp: new Date().toISOString()
        };
        await updateDoc(taskRef, {
            comments: [...currentComments, newComment]
        });

        // Send notification to task assignee
        try {
            const task = { id: taskId, ...taskSnap.data() } as Task;
            const commenter = await getUser(comment.userId);
            await notifyTaskComment(task, comment.userId, commenter?.name || 'Un collega');
        } catch (error) {
            console.error('Error sending comment notification:', error);
        }
    }
}

export async function uploadFilesAndGetAttachments(files: File[], pathPrefix: string, userId: string): Promise<Attachment[]> {
    const storage = getStorage();
    const attachments: Attachment[] = [];

    for (const file of files) {
        const path = `${pathPrefix}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, path);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);

        attachments.push({
            url,
            filename: file.name,
            type: file.type,
            size: file.size,
            date: new Date().toISOString(),
            userId,
            version: 1,
            documentType: 'Altro',
            description: ''
        });
    }

    return attachments;
}

// Briefs
export async function getBriefs(): Promise<Brief[]> {
    return fetchCollection<Brief>('briefs');
}

export async function addBrief(data: Omit<Brief, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'briefs'), {
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });

    // Notify if brief has a client (contact person could be notified)
    // For now we log - could be extended to notify specific users
    console.log(`[BRIEF] New brief created: ${data.title || data.projectName}`);

    return docRef.id;
}

export async function updateBrief(id: string, data: Partial<Brief>): Promise<void> {
    // Get current brief for comparison
    const briefRef = doc(db, 'briefs', id);
    const briefSnap = await getDoc(briefRef);
    const currentBrief = briefSnap.exists() ? { id, ...briefSnap.data() } as Brief : null;

    const updateData = {
        ...data,
        updatedAt: Timestamp.now()
    };
    await updateDoc(briefRef, updateData);

    // Send notification if status changed to approved
    if (currentBrief && data.status === 'Approvato' && currentBrief.status !== 'Approvato') {
        try {
            const updatedBrief = { ...currentBrief, ...data } as Brief;
            if (updatedBrief.createdBy) {
                await notifyBriefApproved(updatedBrief, updatedBrief.createdBy);
            }
        } catch (error) {
            console.error('Error sending brief notification:', error);
        }
    }
}

export async function deleteBrief(id: string): Promise<void> {
    await deleteDoc(doc(db, 'briefs', id));
}

export async function deleteConversation(conversationId: string): Promise<void> {
    await deleteDoc(doc(db, 'conversations', conversationId));
}

// =============== EMAIL TEMPLATES ===============

import type { EmailTemplate, NotificationType } from './data';

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
    return fetchCollection<EmailTemplate>('emailTemplates');
}

export async function getEmailTemplate(id: string): Promise<EmailTemplate | null> {
    const docRef = doc(db, 'emailTemplates', id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as EmailTemplate : null;
}

export async function getEmailTemplateByType(type: NotificationType): Promise<EmailTemplate | null> {
    const q = query(
        collection(db, 'emailTemplates'),
        where('type', '==', type),
        where('isActive', '==', true),
        limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as EmailTemplate;
}

export async function addEmailTemplate(template: Omit<EmailTemplate, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'emailTemplates'), {
        ...template,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
    return docRef.id;
}

export async function updateEmailTemplate(id: string, data: Partial<EmailTemplate>): Promise<void> {
    await updateDoc(doc(db, 'emailTemplates', id), {
        ...data,
        updatedAt: Timestamp.now(),
    });
}

export async function deleteEmailTemplate(id: string): Promise<void> {
    await deleteDoc(doc(db, 'emailTemplates', id));
}

// =============== TASK TEMPLATE BUNDLES ===============

import type { TaskTemplateBundle } from './data';

export async function getTaskTemplateBundles(): Promise<TaskTemplateBundle[]> {
    return fetchCollection<TaskTemplateBundle>('taskTemplateBundles');
}

export async function getTaskTemplateBundle(id: string): Promise<TaskTemplateBundle | null> {
    const docRef = doc(db, 'taskTemplateBundles', id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as TaskTemplateBundle : null;
}

export async function addTaskTemplateBundle(data: Omit<TaskTemplateBundle, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'taskTemplateBundles'), {
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
    return docRef.id;
}

export async function updateTaskTemplateBundle(id: string, data: Partial<TaskTemplateBundle>): Promise<void> {
    await updateDoc(doc(db, 'taskTemplateBundles', id), {
        ...data,
        updatedAt: Timestamp.now(),
    });
}

export async function deleteTaskTemplateBundle(id: string): Promise<void> {
    await deleteDoc(doc(db, 'taskTemplateBundles', id));
}

// Apply a template bundle to create multiple tasks
export async function applyTaskTemplateBundle(
    bundleId: string,
    clientId: string,
    projectId: string | undefined,
    assignedUserId: string | undefined,
    createdBy: string,
    baseDate?: Date
): Promise<{ taskIds: string[], count: number }> {
    const bundle = await getTaskTemplateBundle(bundleId);
    if (!bundle) throw new Error('Template bundle not found');

    const taskIds: string[] = [];
    const startDate = baseDate || new Date();

    for (const template of bundle.tasks) {
        const dueDate = new Date(startDate);
        dueDate.setDate(dueDate.getDate() + (template.offsetDays || 0));

        const taskData = {
            title: template.title,
            description: template.description || '',
            priority: template.priority,
            status: 'Da Fare' as const,
            estimatedDuration: template.estimatedDuration,
            timeSpent: 0,
            clientId,
            projectId,
            assignedUserId: template.assignedUserId || assignedUserId,
            activityType: template.activityType,
            dueDate: dueDate.toISOString(),
            dependencies: [],
            attachments: [],
        };

        const result = await addTask(taskData, createdBy);
        taskIds.push(result.taskId);
    }

    return { taskIds, count: taskIds.length };
}

// Create a template bundle from an existing task
export async function createTemplateBundleFromTask(
    taskId: string,
    name: string,
    description: string,
    category: TaskTemplateBundle['category'],
    isPublic: boolean,
    createdBy: string
): Promise<string> {
    const task = await getTask(taskId);
    if (!task) throw new Error('Task not found');

    const template = {
        title: task.title,
        description: task.description,
        priority: task.priority,
        estimatedDuration: task.estimatedDuration,
        offsetDays: 0,
        activityType: task.activityType,
    };

    return addTaskTemplateBundle({
        name,
        description,
        category,
        tasks: [template],
        createdBy,
        isPublic,
    });
}

// Company Costs (Costi Aziendali)
export async function getCompanyCosts(): Promise<CompanyCosts | null> {
    const docRef = doc(db, 'settings', 'companyCosts');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...convertTimestamps(docSnap.data()) } as CompanyCosts;
    }
    // Return default values if not set
    return {
        dirigenza: 0,
        struttura: 0,
        varie: 0
    };
}

export async function updateCompanyCosts(data: Partial<CompanyCosts>): Promise<void> {
    await setDoc(doc(db, 'settings', 'companyCosts'), {
        ...data,
        updatedAt: Timestamp.now()
    }, { merge: true });
}

// Calculate effective hourly rate including company overhead
export async function calculateEffectiveHourlyRate(
    baseHourlyRate: number,
    activeEmployeesCount: number,
    monthlyWorkHoursPerEmployee: number = 160 // Default ~160 ore/mese (8h x 20gg)
): Promise<{ effectiveRate: number; overhead: number }> {
    const costs = await getCompanyCosts();
    if (!costs || activeEmployeesCount === 0) {
        return { effectiveRate: baseHourlyRate, overhead: 0 };
    }

    const totalMonthlyCost = costs.dirigenza + costs.struttura + costs.varie;
    const costPerEmployee = totalMonthlyCost / activeEmployeesCount;
    const hourlyOverhead = costPerEmployee / monthlyWorkHoursPerEmployee;

    return {
        effectiveRate: baseHourlyRate + hourlyOverhead,
        overhead: hourlyOverhead
    };
}
