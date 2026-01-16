'use client';

import { useEffect, useState } from 'react';

/**
 * Componente che mostra un cuore rosso animato al centro dello schermo
 * ogni ora quando il tema LOVE è attivo.
 * Il cuore appare, pulsa e poi si dissolve.
 */
export function LoveHeartAnimation() {
    const [showHeart, setShowHeart] = useState(false);
    const [colorTheme, setColorTheme] = useState<string>('default');

    useEffect(() => {
        // Get initial theme
        const savedTheme = localStorage.getItem('color-theme');
        if (savedTheme) setColorTheme(savedTheme);

        // Listen for theme changes
        const handleThemeChange = (e: Event) => {
            const customEvent = e as CustomEvent;
            setColorTheme(customEvent.detail);
        };

        window.addEventListener('color-theme-change', handleThemeChange);
        return () => window.removeEventListener('color-theme-change', handleThemeChange);
    }, []);

    useEffect(() => {
        if (colorTheme !== 'love') return;

        // Function to show the heart animation
        const showHeartAnimation = () => {
            setShowHeart(true);
            // Hide after 5 seconds
            setTimeout(() => {
                setShowHeart(false);
            }, 5000);
        };

        // Calculate time until next hour
        const now = new Date();
        const msUntilNextHour = (60 - now.getMinutes()) * 60 * 1000 - now.getSeconds() * 1000 - now.getMilliseconds();

        // Show heart at the next hour
        const firstTimeout = setTimeout(() => {
            showHeartAnimation();

            // Then show every hour
            const interval = setInterval(() => {
                showHeartAnimation();
            }, 60 * 60 * 1000); // Every hour

            // Cleanup interval on unmount
            return () => clearInterval(interval);
        }, msUntilNextHour);

        // Show immediately when theme is first activated (for testing/demo)
        // Remove this line in production if you only want hourly hearts
        // showHeartAnimation();

        return () => clearTimeout(firstTimeout);
    }, [colorTheme]);

    if (colorTheme !== 'love' || !showHeart) return null;

    return (
        <div className="love-heart-container">
            <div className="love-heart-inner">
                <span className="love-heart">❤️</span>
            </div>
        </div>
    );
}
