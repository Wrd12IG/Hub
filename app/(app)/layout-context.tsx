'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { onAuthStateChanged, User as AuthUser, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { getDoc, doc, collection, query, where, orderBy, limit, onSnapshot, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import type { User, Client, Project, Task, ActivityType, Absence, RolePermissions, Conversation, Notification, CalendarActivity, TaskPrioritySettings, CalendarActivityPreset, BriefService, BriefServiceCategory, ServiceContract } from '@/lib/data';
import { getUsers, getClients, getProjects, getTasks, getActivityTypes, getAbsences, getRolePermissions, getTask, getProject, createNotification, addUser, getCalendarActivities, getTaskPrioritySettings, getCalendarActivityPresets, getBriefServices, getBriefServiceCategories, getServiceContracts } from '@/lib/actions';
import { playSound, showBrowserNotification } from '@/lib/sounds';

// Sound settings interface
export interface SoundSettings {
  enabled: boolean;
  volume: number; // 0-1
  notificationSound: boolean;
  messageSound: boolean;
  timerSound: boolean;
}

interface LayoutContextType {
  currentUser: User | null;
  users: User[];
  usersById: Record<string, User>;
  clients: Client[];
  clientsById: Record<string, Client>;
  allProjects: Project[];
  allTasks: Task[];
  tasksById: Record<string, Task>;
  projectsById: Record<string, Project>;
  activityTypes: ActivityType[];
  absences: Absence[];
  calendarActivities: CalendarActivity[];
  calendarActivityPresets: CalendarActivityPreset[];
  briefServices: BriefService[];
  briefServiceCategories: BriefServiceCategory[];
  serviceContracts: ServiceContract[];
  conversations: Conversation[];
  notifications: Notification[];
  permissions: RolePermissions;
  taskPrioritySettings: TaskPrioritySettings | null;
  setTaskPrioritySettings: React.Dispatch<React.SetStateAction<TaskPrioritySettings | null>>;
  isLoadingLayout: boolean;
  refetchData: <T extends 'users' | 'clients' | 'projects' | 'tasks' | 'absences' | 'activityTypes' | 'calendarActivities' | 'calendarActivityPresets' | 'briefServices' | 'briefServiceCategories' | 'serviceContracts' | 'all'>(dataType: T) => Promise<any[] | void>;
  clientDetails: Client | null;
  setClientDetails: React.Dispatch<React.SetStateAction<Client | null>>;
  handleLogin: (email: string, password?: string) => Promise<{ success: boolean; userId?: string; error?: string; }>;
  handleCreateUser: (user: Omit<User, 'id'>, password?: string) => Promise<{ success: boolean; userId?: string; error?: string; }>;
  handleLogout: () => void;
  pomodoroTask: Task | null;
  setPomodoroTask: React.Dispatch<React.SetStateAction<Task | null>>;
  soundSettings: SoundSettings;
  setSoundSettings: React.Dispatch<React.SetStateAction<SoundSettings>>;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const useLayoutData = () => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayoutData must be used within a LayoutDataProvider');
  }
  return context;
};

// Helper function to handle Firestore timestamp conversion
export const convertTimestamps = (data: any): any => {
  if (!data) return data;
  if (Array.isArray(data)) {
    return data.map(item => convertTimestamps(item));
  }
  if (typeof data === 'object' && data !== null) {
    if (data instanceof Timestamp) {
      return data.toDate().toISOString();
    }
    const convertedData: { [key: string]: any } = {};
    for (const key in data) {
      convertedData[key] = convertTimestamps(data[key]);
    }
    return convertedData;
  }
  return data;
};


export const LayoutDataProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<RolePermissions>({});
  const [isLoadingLayout, setIsLoadingLayout] = useState(true);
  const [clientDetails, setClientDetails] = useState<Client | null>(null);
  const [pomodoroTask, setPomodoroTask] = useState<Task | null>(null);

  // App-wide data state
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [calendarActivities, setCalendarActivities] = useState<CalendarActivity[]>([]);
  const [calendarActivityPresets, setCalendarActivityPresets] = useState<CalendarActivityPreset[]>([]);
  const [taskPrioritySettings, setTaskPrioritySettings] = useState<TaskPrioritySettings | null>(null);
  const [briefServices, setBriefServices] = useState<BriefService[]>([]);
  const [briefServiceCategories, setBriefServiceCategories] = useState<BriefServiceCategory[]>([]);
  const [serviceContracts, setServiceContracts] = useState<ServiceContract[]>([]);


  // Real-time data
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Sound settings with localStorage persistence
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hub-sound-settings');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore parse errors
        }
      }
    }
    return {
      enabled: true,
      volume: 0.5,
      notificationSound: true,
      messageSound: true,
      timerSound: true,
    };
  });

  // Ref to track previous notification count for detecting new ones
  const prevNotificationCountRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);


  const usersById = useMemo(() => users.reduce((acc, user) => ({ ...acc, [user.id]: user }), {} as Record<string, User>), [users]);
  const clientsById = useMemo(() => clients.reduce((acc, client) => ({ ...acc, [client.id]: client }), {} as Record<string, Client>), [clients]);
  const tasksById = useMemo(() => allTasks.reduce((acc, task) => ({ ...acc, [task.id]: task }), {} as Record<string, Task>), [allTasks]);
  const projectsById = useMemo(() => allProjects.reduce((acc, project) => ({ ...acc, [project.id]: project }), {} as Record<string, Project>), [allProjects]);


  const refetchData = useCallback(async (dataType: 'users' | 'clients' | 'projects' | 'tasks' | 'absences' | 'activityTypes' | 'calendarActivities' | 'calendarActivityPresets' | 'briefServices' | 'briefServiceCategories' | 'serviceContracts' | 'all') => {
    const fetchMap = {
      users: getUsers,
      clients: getClients,
      projects: getProjects,
      tasks: getTasks,
      absences: getAbsences,
      activityTypes: getActivityTypes,
      calendarActivities: getCalendarActivities,
      calendarActivityPresets: getCalendarActivityPresets,
      briefServices: getBriefServices,
      briefServiceCategories: getBriefServiceCategories,
      serviceContracts: getServiceContracts,
    };

    const updateState = (type: keyof typeof fetchMap, data: any) => {
      switch (type) {
        case 'users': setUsers(data as User[]); break;
        case 'clients': setClients(data as Client[]); break;
        case 'projects': setAllProjects(data as Project[]); break;
        case 'tasks': setAllTasks(data as Task[]); break;
        case 'absences': setAbsences(data as Absence[]); break;
        case 'activityTypes': setActivityTypes(data as ActivityType[]); break;
        case 'calendarActivities': setCalendarActivities(data as CalendarActivity[]); break;
        case 'calendarActivityPresets': setCalendarActivityPresets(data as CalendarActivityPreset[]); break;
        case 'briefServices': setBriefServices(data as BriefService[]); break;
        case 'briefServiceCategories': setBriefServiceCategories(data as BriefServiceCategory[]); break;
        case 'serviceContracts': setServiceContracts(data as ServiceContract[]); break;
      }
    }

    if (dataType === 'all') {
      const allData = await Promise.all(
        Object.entries(fetchMap).map(async ([key, fn]) => {
          try {
            const data = await fn();
            return { key, data };
          } catch (e) {
            console.error(`Failed to fetch ${key}:`, e);
            return { key, data: [] }; // Return empty array on error
          }
        })
      );
      allData.forEach(({ key, data }) => {
        updateState(key as keyof typeof fetchMap, data);
      });
      return;
    }

    const data = await fetchMap[dataType]();
    updateState(dataType, data);
    return data;
  }, []);

  const handleLogin = useCallback(async (email: string, password?: string): Promise<{ success: boolean; userId?: string; error?: string; }> => {
    if (!password) {
      throw new Error('La password è richiesta.');
    }

    const trimmedEmail = email.trim();

    try {
      const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      const authUser = userCredential.user;
      return { success: true, userId: authUser.uid };
    } catch (error: any) {
      if (error.code === 'auth/invalid-credential') {
        return { success: false, error: 'Credenziali non valide. Controlla email e password.' };
      }
      console.error('Firebase Auth login error:', error);
      return { success: false, error: 'Errore di autenticazione. Riprova.' };
    }
  }, []);

  const handleCreateUser = useCallback(async (user: Omit<User, 'id'>, password?: string): Promise<{ success: boolean; userId?: string; error?: string }> => {
    if (!password) {
      return { success: false, error: "La password è obbligatoria per creare un nuovo utente." };
    }

    const trimmedEmail = user.email.trim();
    if (!trimmedEmail) {
      return { success: false, error: "L'indirizzo email è obbligatorio." };
    }

    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      const authUser = userCredential.user;

      // 2. Create user profile in Firestore
      await addUser(authUser.uid, { ...user, email: trimmedEmail });

      await refetchData('users');

      return { success: true, userId: authUser.uid };

    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        return { success: false, error: 'Questa email è già in uso.' };
      }
      if (error.code === 'auth/invalid-email') {
        return { success: false, error: "L'indirizzo email inserito non è valido." };
      }
      if (error.code === 'auth/weak-password') {
        return { success: false, error: 'La password deve essere di almeno 6 caratteri.' };
      }
      console.error('Firebase Auth user creation error:', error);
      return { success: false, error: "Impossibile creare l'utente. Riprova." };
    }
  }, [refetchData]);

  const handleLogout = () => {
    auth.signOut();
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsLoadingLayout(true);
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            setCurrentUser({ id: userDoc.id, ...userDoc.data() } as User);
            const [perms, prioritySettings] = await Promise.all([
              getRolePermissions(),
              getTaskPrioritySettings(),
            ]);
            setPermissions(perms);
            setTaskPrioritySettings(prioritySettings);
          } else {
            console.error(`User profile not found in Firestore for UID: ${user.uid}. Logging out.`);
            handleLogout();
          }

        } catch (error) {
          console.error("Error during auth state change data fetch:", error);
          handleLogout();
        } finally {
          setIsLoadingLayout(false);
        }
      } else {
        setCurrentUser(null);
        setUsers([]);
        setClients([]);
        setAllProjects([]);
        setAllTasks([]);
        setActivityTypes([]);
        setAbsences([]);
        setCalendarActivities([]);
        setCalendarActivityPresets([]);
        setBriefServices([]);
        setBriefServiceCategories([]);
        setServiceContracts([]);
        setConversations([]);
        setNotifications([]);
        setPermissions({});
        setTaskPrioritySettings(null);
        setIsLoadingLayout(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;

    const collectionsToListen: { name: string, setter: (data: any[]) => void }[] = [
      { name: 'users', setter: setUsers },
      { name: 'clients', setter: setClients },
      { name: 'projects', setter: setAllProjects },
      { name: 'tasks', setter: setAllTasks },
      { name: 'absences', setter: setAbsences },
      { name: 'activityTypes', setter: setActivityTypes },
      { name: 'calendarActivities', setter: setCalendarActivities },
      { name: 'calendarActivityPresets', setter: setCalendarActivityPresets },
      { name: 'briefServices', setter: setBriefServices },
      { name: 'briefServiceCategories', setter: setBriefServiceCategories },
      { name: 'serviceContracts', setter: setServiceContracts },
      {
        name: 'rolePermissions', setter: (data: any[]) => {
          const perms: RolePermissions = {};
          data.forEach(d => { perms[d.id] = d.permissions || []; });
          setPermissions(perms);
        }
      },
    ];

    const unsubs = collectionsToListen.map(({ name, setter }) =>
      onSnapshot(collection(db, name), (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...convertTimestamps(d.data()) }));
        setter(data);
      }, (error) => console.error(`Error fetching ${name}:`, error))
    );

    const qConversations = query(
      collection(db, 'conversations'),
      where('memberIds', 'array-contains', currentUser.id)
    );
    const unsubConversations = onSnapshot(qConversations, (snapshot) => {
      const updatedConversations = snapshot.docs.map(d => ({ id: d.id, ...convertTimestamps(d.data()) }) as Conversation);
      updatedConversations.sort((a, b) => {
        const timeA = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
        const timeB = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
        return timeB - timeA;
      });
      setConversations(updatedConversations);
    }, (error) => console.error("Error fetching conversations:", error));

    const qNotifications = query(
      collection(db, 'users', currentUser.id, 'notifications'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    const unsubNotifications = onSnapshot(qNotifications, (snapshot) => {
      const fetchedNotifications = snapshot.docs.map(doc => ({ id: doc.id, ...convertTimestamps(doc.data()) }) as Notification);

      // Play sound and show browser notification for new notifications (not on initial load)
      if (!isInitialLoadRef.current && soundSettings.enabled && soundSettings.notificationSound) {
        const newCount = fetchedNotifications.filter(n => !n.isRead).length;
        const prevUnreadCount = prevNotificationCountRef.current;

        if (newCount > prevUnreadCount) {
          // Find the newest unread notification to determine sound type
          const newestUnread = fetchedNotifications.find(n => !n.isRead);

          if (newestUnread) {
            // Determine which sound to play based on notification type
            let soundType: 'notification' | 'task_rejected' | 'task_approval' | 'task_approval_requested' = 'notification';

            if (newestUnread.type === 'task_rejected') {
              soundType = 'task_rejected';
            } else if (newestUnread.type === 'task_approval_requested') {
              soundType = 'task_approval_requested';
            } else if (newestUnread.type === 'task_approved') {
              soundType = 'task_approval';
            }

            // Play audio notification with appropriate sound
            playSound(soundType, soundSettings.volume);

            // Show browser notification
            showBrowserNotification(newestUnread.title || 'Nuova notifica', {
              body: newestUnread.text,
              tag: `notification-${newestUnread.id}`,
            });
          }
        }
        prevNotificationCountRef.current = newCount;
      } else {
        // Initial load - just set the count without playing sound
        prevNotificationCountRef.current = fetchedNotifications.filter(n => !n.isRead).length;
        isInitialLoadRef.current = false;
      }

      setNotifications(fetchedNotifications);
    }, (error) => console.error("Error fetching notifications:", error));

    return () => {
      unsubs.forEach(unsub => unsub());
      unsubConversations();
      unsubNotifications();
    };
  }, [currentUser?.id, soundSettings.enabled, soundSettings.notificationSound, soundSettings.volume]);

  // Persist sound settings to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hub-sound-settings', JSON.stringify(soundSettings));
    }
  }, [soundSettings]);

  const value: LayoutContextType = {
    currentUser,
    users,
    usersById,
    clients,
    clientsById,
    allProjects,
    allTasks,
    tasksById,
    projectsById,
    activityTypes,
    absences,
    calendarActivities,
    calendarActivityPresets,
    briefServices,
    briefServiceCategories,
    serviceContracts,
    handleLogin,
    handleCreateUser,
    handleLogout,
    refetchData,
    conversations,
    notifications,
    permissions,
    taskPrioritySettings,
    setTaskPrioritySettings,
    isLoadingLayout,
    clientDetails,
    setClientDetails,
    pomodoroTask,
    setPomodoroTask,
    soundSettings,
    setSoundSettings,
  };

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
};
