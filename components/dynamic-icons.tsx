'use client';

import { useEffect } from 'react';
import { useSiteIcons } from '@/hooks/use-site-icons';

/**
 * Component that dynamically updates the favicon and app icons
 * Place this in the root layout to enable dynamic icon updates
 */
export function DynamicIcons() {
    const { settings, getFavicon, getMainIcon } = useSiteIcons();

    useEffect(() => {
        if (typeof document === 'undefined') return;

        // Update favicon
        const favicon = getFavicon();
        if (favicon) {
            const existingFavicons = document.querySelectorAll<HTMLLinkElement>(
                'link[rel="icon"], link[rel="shortcut icon"]'
            );

            if (existingFavicons.length > 0) {
                existingFavicons.forEach(link => {
                    link.href = favicon;
                });
            } else {
                const link = document.createElement('link');
                link.rel = 'icon';
                link.type = 'image/png';
                link.href = favicon;
                document.head.appendChild(link);
            }
        }

        // Update apple-touch-icon
        const mainIcon = getMainIcon();
        if (mainIcon) {
            let appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
            if (appleIcon) {
                appleIcon.href = mainIcon;
            } else {
                appleIcon = document.createElement('link');
                appleIcon.rel = 'apple-touch-icon';
                appleIcon.href = mainIcon;
                document.head.appendChild(appleIcon);
            }
        }

    }, [settings, getFavicon, getMainIcon]);

    // This component doesn't render anything visible
    return null;
}

export default DynamicIcons;
