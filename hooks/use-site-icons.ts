'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface IconSettings {
    favicon?: string;
    mainIcon?: string;
    customIcons: Record<string, string>;
    updatedAt?: string;
}

const DEFAULT_ICON_SETTINGS: IconSettings = {
    customIcons: {},
};

// Cache for icon settings
let cachedSettings: IconSettings | null = null;

/**
 * Hook to get and use site icons from Firestore
 */
export function useSiteIcons() {
    const [settings, setSettings] = useState<IconSettings>(cachedSettings || DEFAULT_ICON_SETTINGS);
    const [isLoading, setIsLoading] = useState(!cachedSettings);

    useEffect(() => {
        const docRef = doc(db, 'settings', 'site_icons');

        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as IconSettings;
                const newSettings = {
                    ...DEFAULT_ICON_SETTINGS,
                    ...data,
                };
                cachedSettings = newSettings;
                setSettings(newSettings);
            }
            setIsLoading(false);
        }, (error) => {
            console.error('Error loading site icons:', error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Update favicon dynamically
    useEffect(() => {
        if (settings.favicon) {
            updateFavicon(settings.favicon);
        }
    }, [settings.favicon]);

    /**
     * Get the URL for a specific icon size
     */
    const getIconUrl = (size: number): string => {
        // Check for custom icon first
        const customIcon = settings.customIcons[`${size}x${size}`];
        if (customIcon) return customIcon;

        // Fall back to main icon
        if (settings.mainIcon) return settings.mainIcon;

        // Default to static icons
        return `/icons/Icon_${size}x${size}px.png`;
    };

    /**
     * Get the main app icon (largest available)
     */
    const getMainIcon = (): string => {
        if (settings.mainIcon) return settings.mainIcon;
        if (settings.customIcons['512x512']) return settings.customIcons['512x512'];
        if (settings.customIcons['192x192']) return settings.customIcons['192x192'];
        return '/icon.png';
    };

    /**
     * Get the favicon URL
     */
    const getFavicon = (): string => {
        if (settings.favicon) return settings.favicon;
        return '/icon.png';
    };

    return {
        settings,
        isLoading,
        getIconUrl,
        getMainIcon,
        getFavicon,
    };
}

/**
 * Update the favicon in the document head
 */
function updateFavicon(url: string) {
    if (typeof document === 'undefined') return;

    // Find existing favicon links
    const existingLinks = document.querySelectorAll<HTMLLinkElement>(
        'link[rel="icon"], link[rel="shortcut icon"]'
    );

    // Update or create favicon link
    if (existingLinks.length > 0) {
        existingLinks.forEach(link => {
            link.href = url;
        });
    } else {
        const link = document.createElement('link');
        link.rel = 'icon';
        link.href = url;
        document.head.appendChild(link);
    }

    // Also update apple-touch-icon if present
    const appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (appleIcon) {
        appleIcon.href = url;
    }
}

/**
 * Preload site icons (call on app init)
 */
export async function preloadSiteIcons(): Promise<IconSettings> {
    if (cachedSettings) return cachedSettings;

    try {
        const { getDoc } = await import('firebase/firestore');
        const docRef = doc(db, 'settings', 'site_icons');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data() as IconSettings;
            cachedSettings = {
                ...DEFAULT_ICON_SETTINGS,
                ...data,
            };
            return cachedSettings;
        }
    } catch (error) {
        console.error('Error preloading site icons:', error);
    }

    return DEFAULT_ICON_SETTINGS;
}
