'use client';

/**
 * Real-time Presence System
 * Tracks which users are currently active and what they're viewing
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc, onSnapshot, deleteDoc, collection, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { useLayoutData } from '@/app/(app)/layout-context';

export interface UserPresence {
    id: string;
    odUserId: string;
    userName: string;
    userColor?: string;
    currentPage: string;
    resourceType?: 'task' | 'project' | 'brief' | 'document' | 'chat';
    resourceId?: string;
    isTyping?: boolean;
    lastSeen: string;
    status: 'online' | 'idle' | 'away';
}

interface PresenceOptions {
    currentPage: string;
    resourceType?: 'task' | 'project' | 'brief' | 'document' | 'chat';
    resourceId?: string;
}

// Time thresholds
const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const AWAY_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const HEARTBEAT_INTERVAL = 30 * 1000; // 30 seconds
const CLEANUP_THRESHOLD = 10 * 60 * 1000; // 10 minutes - remove stale entries

/**
 * Hook to manage current user's presence
 */
export function usePresence(options: PresenceOptions) {
    const { currentUser } = useLayoutData();
    const lastActivityRef = useRef<number>(Date.now());
    const presenceDocIdRef = useRef<string | null>(null);

    const updatePresence = useCallback(async (status: 'online' | 'idle' | 'away' = 'online') => {
        if (!currentUser?.id) return;

        const presenceData: Omit<UserPresence, 'id'> = {
            odUserId: currentUser.id,
            userName: currentUser.name,
            userColor: currentUser.color,
            currentPage: options.currentPage,
            resourceType: options.resourceType,
            resourceId: options.resourceId,
            lastSeen: new Date().toISOString(),
            status,
        };

        try {
            const presenceId = `presence_${currentUser.id}`;
            presenceDocIdRef.current = presenceId;
            await setDoc(doc(db, 'presence', presenceId), presenceData, { merge: true });
        } catch (error) {
            console.error('Error updating presence:', error);
        }
    }, [currentUser, options]);

    const removePresence = useCallback(async () => {
        if (presenceDocIdRef.current) {
            try {
                await deleteDoc(doc(db, 'presence', presenceDocIdRef.current));
            } catch (error) {
                console.error('Error removing presence:', error);
            }
        }
    }, []);

    // Track user activity
    const handleActivity = useCallback(() => {
        lastActivityRef.current = Date.now();
        updatePresence('online');
    }, [updatePresence]);

    useEffect(() => {
        if (!currentUser?.id) return;

        // Initial presence update
        updatePresence('online');

        // Set up activity listeners
        const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
        activityEvents.forEach(event => {
            window.addEventListener(event, handleActivity, { passive: true });
        });

        // Heartbeat interval to maintain presence and check idle status
        const heartbeatInterval = setInterval(() => {
            const timeSinceActivity = Date.now() - lastActivityRef.current;

            if (timeSinceActivity > AWAY_TIMEOUT) {
                updatePresence('away');
            } else if (timeSinceActivity > IDLE_TIMEOUT) {
                updatePresence('idle');
            } else {
                updatePresence('online');
            }
        }, HEARTBEAT_INTERVAL);

        // Cleanup on unmount
        return () => {
            activityEvents.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
            clearInterval(heartbeatInterval);
            removePresence();
        };
    }, [currentUser?.id, updatePresence, removePresence, handleActivity]);

    // Update when options change (page navigation)
    useEffect(() => {
        if (currentUser?.id) {
            updatePresence('online');
        }
    }, [options.currentPage, options.resourceType, options.resourceId, currentUser?.id, updatePresence]);

    // Handle page unload
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (presenceDocIdRef.current && currentUser?.id) {
                // Use sendBeacon for reliable cleanup on page unload
                // Note: This is a best-effort cleanup
                navigator.sendBeacon?.(`/api/presence/cleanup?userId=${currentUser.id}`);
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [currentUser?.id]);

    return { updatePresence, removePresence };
}

/**
 * Hook to watch presence of other users
 */
export function usePresenceList() {
    const { currentUser, usersById } = useLayoutData();
    const [presenceList, setPresenceList] = useState<UserPresence[]>([]);

    useEffect(() => {
        if (!currentUser?.id) return;

        const unsubscribe = onSnapshot(
            collection(db, 'presence'),
            (snapshot) => {
                const now = Date.now();
                const presenceData: UserPresence[] = [];

                snapshot.docs.forEach((doc) => {
                    const data = doc.data() as Omit<UserPresence, 'id'>;
                    const lastSeenTime = new Date(data.lastSeen).getTime();

                    // Filter out stale entries and current user
                    if (now - lastSeenTime < CLEANUP_THRESHOLD && data.odUserId !== currentUser.id) {
                        presenceData.push({
                            id: doc.id,
                            ...data,
                        });
                    }
                });

                setPresenceList(presenceData);
            },
            (error) => {
                console.error('Error watching presence:', error);
            }
        );

        return () => unsubscribe();
    }, [currentUser?.id]);

    return presenceList;
}

/**
 * Hook to get users watching a specific resource
 */
export function useResourceViewers(resourceType: string, resourceId: string) {
    const presenceList = usePresenceList();

    return presenceList.filter(
        p => p.resourceType === resourceType && p.resourceId === resourceId
    );
}

/**
 * Hook to manage typing indicator for a resource
 */
export function useTypingIndicator(resourceType: string, resourceId: string) {
    const { currentUser } = useLayoutData();
    const [isTyping, setIsTyping] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const setTyping = useCallback(async (typing: boolean) => {
        if (!currentUser?.id) return;

        setIsTyping(typing);

        try {
            const presenceId = `presence_${currentUser.id}`;
            await setDoc(doc(db, 'presence', presenceId), {
                isTyping: typing,
                lastSeen: new Date().toISOString(),
            }, { merge: true });

            // Auto-clear typing after 5 seconds
            if (typing) {
                if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                }
                typingTimeoutRef.current = setTimeout(() => {
                    setTyping(false);
                }, 5000);
            }
        } catch (error) {
            console.error('Error updating typing status:', error);
        }
    }, [currentUser?.id]);

    // Get other users who are typing
    const presenceList = usePresenceList();
    const typingUsers = presenceList.filter(
        p => p.resourceType === resourceType &&
            p.resourceId === resourceId &&
            p.isTyping === true
    );

    return { isTyping, setTyping, typingUsers };
}
