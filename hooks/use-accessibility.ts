'use client';

import { useEffect, useRef } from 'react';

interface UseFocusTrapOptions {
    enabled?: boolean;
    autoFocus?: boolean;
    returnFocus?: boolean;
}

/**
 * Hook to trap focus within a container (useful for modals/dialogs)
 * Improves accessibility by keeping focus within interactive elements
 */
export function useFocusTrap<T extends HTMLElement>(
    options: UseFocusTrapOptions = {}
) {
    const { enabled = true, autoFocus = true, returnFocus = true } = options;
    const containerRef = useRef<T>(null);
    const previousActiveElement = useRef<Element | null>(null);

    useEffect(() => {
        if (!enabled || !containerRef.current) return;

        // Store the previously focused element
        previousActiveElement.current = document.activeElement;

        const container = containerRef.current;

        // Get all focusable elements
        const getFocusableElements = (): HTMLElement[] => {
            const selector = [
                'button:not([disabled])',
                'a[href]',
                'input:not([disabled])',
                'select:not([disabled])',
                'textarea:not([disabled])',
                '[tabindex]:not([tabindex="-1"])',
                '[contenteditable="true"]',
            ].join(', ');

            return Array.from(container.querySelectorAll<HTMLElement>(selector))
                .filter(el => el.offsetParent !== null); // Only visible elements
        };

        // Focus the first focusable element
        if (autoFocus) {
            const focusable = getFocusableElements();
            if (focusable.length > 0) {
                // Prefer elements with autofocus attribute
                const autoFocusEl = focusable.find(el => el.hasAttribute('autofocus'));
                (autoFocusEl || focusable[0]).focus();
            }
        }

        // Handle tab key to trap focus
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Tab') return;

            const focusable = getFocusableElements();
            if (focusable.length === 0) return;

            const firstElement = focusable[0];
            const lastElement = focusable[focusable.length - 1];

            if (event.shiftKey) {
                // Shift + Tab: go backwards
                if (document.activeElement === firstElement) {
                    event.preventDefault();
                    lastElement.focus();
                }
            } else {
                // Tab: go forwards
                if (document.activeElement === lastElement) {
                    event.preventDefault();
                    firstElement.focus();
                }
            }
        };

        container.addEventListener('keydown', handleKeyDown);

        // Cleanup: return focus to previous element
        return () => {
            container.removeEventListener('keydown', handleKeyDown);

            if (returnFocus && previousActiveElement.current instanceof HTMLElement) {
                previousActiveElement.current.focus();
            }
        };
    }, [enabled, autoFocus, returnFocus]);

    return containerRef;
}

/**
 * Hook to announce messages to screen readers
 */
export function useAnnounce() {
    const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
        // Create or get the announcement region
        let region = document.getElementById('sr-announcer');

        if (!region) {
            region = document.createElement('div');
            region.id = 'sr-announcer';
            region.setAttribute('aria-live', priority);
            region.setAttribute('aria-atomic', 'true');
            region.className = 'sr-only';
            region.style.cssText =
                'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;';
            document.body.appendChild(region);
        }

        // Clear and set new message
        region.textContent = '';
        // Small delay to ensure screen readers pick up the change
        setTimeout(() => {
            region!.textContent = message;
        }, 100);
    };

    return { announce };
}

/**
 * Hook to manage focus visible styling
 */
export function useFocusVisible() {
    useEffect(() => {
        let hadKeyboardEvent = false;
        let isInitialized = false;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Tab' || e.key === 'Escape' || e.key === 'Enter') {
                hadKeyboardEvent = true;
            }
        };

        const onPointerDown = () => {
            hadKeyboardEvent = false;
        };

        const onFocus = (e: FocusEvent) => {
            if (!isInitialized) {
                isInitialized = true;
                return;
            }

            const target = e.target as HTMLElement;
            if (hadKeyboardEvent) {
                target.setAttribute('data-focus-visible', '');
            }
        };

        const onBlur = (e: FocusEvent) => {
            const target = e.target as HTMLElement;
            target.removeAttribute('data-focus-visible');
        };

        document.addEventListener('keydown', onKeyDown, true);
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('focus', onFocus, true);
        document.addEventListener('blur', onBlur, true);

        return () => {
            document.removeEventListener('keydown', onKeyDown, true);
            document.removeEventListener('pointerdown', onPointerDown, true);
            document.removeEventListener('focus', onFocus, true);
            document.removeEventListener('blur', onBlur, true);
        };
    }, []);
}

/**
 * Generate unique IDs for accessibility attributes
 */
let idCounter = 0;
export function useId(prefix = 'hub'): string {
    const idRef = useRef<string | null>(null);

    if (idRef.current === null) {
        idRef.current = `${prefix}-${++idCounter}`;
    }

    return idRef.current;
}

/**
 * Hook to detect reduced motion preference
 */
export function useReducedMotion(): boolean {
    const mediaQuery = typeof window !== 'undefined'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    return mediaQuery?.matches ?? false;
}
