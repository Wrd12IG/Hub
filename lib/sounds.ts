// Sound notification utility
// Supports both default sounds from /public/sounds/ and custom uploaded sounds from Firebase

import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export type SoundType =
    | 'notification'
    | 'message'
    | 'timer'
    | 'success'
    | 'error'
    | 'task_rejected'
    | 'task_approval'
    | 'task_approval_requested'
    | 'task_completed'
    | 'task_assigned'
    | 'deadline_warning'
    | 'new_comment'
    | 'achievement'
    | 'level_up'
    | 'konami_activated';

// Map sound types to default file paths
const defaultSoundFiles: Record<SoundType, string> = {
    notification: '/sounds/notification.mp3',
    message: '/sounds/message.mp3',
    timer: '/sounds/timer.mp3',
    success: '/sounds/success.mp3',
    error: '/sounds/error.mp3',
    task_rejected: '/sounds/task_rejected.mp3',
    task_approval: '/sounds/task_approval.mp3',
    task_approval_requested: '/sounds/ding.mp3',
    task_completed: '/sounds/task-complete.mp3',
    task_assigned: '/sounds/task-assigned.mp3',
    deadline_warning: '/sounds/deadline-warning.mp3',
    new_comment: '/sounds/new-comment.mp3',
    achievement: '/sounds/achievement.mp3',
    level_up: '/sounds/level-up.mp3',
    konami_activated: '/sounds/konami-activated.mp3',
};

// Cache for sound settings to avoid fetching on every play
let cachedSoundSettings: GlobalSoundSettings | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // 1 minute cache

interface SoundConfig {
    id: string;
    customUrl?: string;
    useCustom: boolean;
    volume: number;
}

interface GlobalSoundSettings {
    sounds: Record<string, SoundConfig>;
    browserNotificationsEnabled: boolean;
}

/**
 * Get cached sound settings or fetch from Firestore
 */
async function getSoundSettings(): Promise<GlobalSoundSettings | null> {
    if (typeof window === 'undefined') return null;

    const now = Date.now();
    if (cachedSoundSettings && (now - lastFetchTime) < CACHE_DURATION) {
        return cachedSoundSettings;
    }

    try {
        const docRef = doc(db, 'settings', 'sounds');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            cachedSoundSettings = docSnap.data() as GlobalSoundSettings;
            lastFetchTime = now;
            return cachedSoundSettings;
        }
    } catch (error) {
        console.error('Error fetching sound settings:', error);
    }

    return null;
}

/**
 * Clear the sound settings cache (call when settings are updated)
 */
export function clearSoundSettingsCache(): void {
    cachedSoundSettings = null;
    lastFetchTime = 0;
}

/**
 * Get the URL for a sound (custom or default)
 */
async function getSoundUrl(type: SoundType): Promise<{ url: string; volume: number }> {
    const settings = await getSoundSettings();

    if (settings?.sounds?.[type]) {
        const soundConfig = settings.sounds[type];
        if (soundConfig.useCustom && soundConfig.customUrl) {
            return {
                url: soundConfig.customUrl,
                volume: soundConfig.volume ?? 0.5,
            };
        }
        return {
            url: defaultSoundFiles[type],
            volume: soundConfig.volume ?? 0.5,
        };
    }

    return {
        url: defaultSoundFiles[type],
        volume: 0.5,
    };
}

/**
 * Play a sound notification
 * @param type - The type of sound to play
 * @param volumeOverride - Optional volume override (0-1), if not provided uses saved settings
 */
export function playSound(type: SoundType, volumeOverride?: number): void {
    if (typeof window === 'undefined') return;

    // Use async IIFE to handle the async getSoundUrl
    (async () => {
        try {
            const { url, volume: savedVolume } = await getSoundUrl(type);
            const finalVolume = volumeOverride ?? savedVolume;

            const audio = new Audio(url);
            audio.volume = Math.max(0, Math.min(1, finalVolume));

            await audio.play().catch(err => {
                console.warn('Could not play sound:', err.message);
            });
        } catch (error) {
            console.error('Error playing sound:', error);

            // Fallback to default sound
            try {
                const audio = new Audio(defaultSoundFiles[type]);
                audio.volume = volumeOverride ?? 0.5;
                audio.play().catch(() => { });
            } catch {
                // Silent fail
            }
        }
    })();
}

/**
 * Play a sound synchronously using only default sounds (for immediate playback)
 * Use this when you need guaranteed immediate playback without waiting for settings
 */
export function playSoundSync(type: SoundType, volume: number = 0.5): void {
    if (typeof window === 'undefined') return;

    try {
        const audio = new Audio(defaultSoundFiles[type]);
        audio.volume = Math.max(0, Math.min(1, volume));
        audio.play().catch(err => {
            console.warn('Could not play sound:', err.message);
        });
    } catch (error) {
        console.error('Error playing sound:', error);
    }
}

/**
 * Check if sound file exists (for default sounds)
 */
export async function checkSoundExists(type: SoundType): Promise<boolean> {
    try {
        const response = await fetch(defaultSoundFiles[type], { method: 'HEAD' });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Get available sound types
 */
export function getSoundTypes(): SoundType[] {
    return Object.keys(defaultSoundFiles) as SoundType[];
}

/**
 * Show browser notification (with permission check)
 */
export async function showBrowserNotification(
    title: string,
    options?: NotificationOptions
): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return false;
    }

    if (Notification.permission !== 'granted') {
        return false;
    }

    // Check if browser notifications are enabled in settings
    const settings = await getSoundSettings();
    if (settings && !settings.browserNotificationsEnabled) {
        return false;
    }

    try {
        new Notification(title, {
            icon: '/favicon.ico',
            ...options,
        });
        return true;
    } catch (error) {
        console.error('Error showing notification:', error);
        return false;
    }
}

/**
 * Request browser notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return 'denied';
    }

    if (Notification.permission === 'granted') {
        return 'granted';
    }

    try {
        const permission = await Notification.requestPermission();
        return permission;
    } catch (error) {
        console.error('Error requesting notification permission:', error);
        return 'denied';
    }
}

/**
 * Check if browser notifications are supported
 */
export function areBrowserNotificationsSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
}
