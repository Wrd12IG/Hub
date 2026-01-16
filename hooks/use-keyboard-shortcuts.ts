'use client';

import { useEffect, useCallback } from 'react';

type KeyModifier = 'ctrl' | 'meta' | 'alt' | 'shift';
type KeyCombo = string; // e.g., 'ctrl+k', 'meta+shift+p'

interface ShortcutHandler {
    key: string;
    modifiers?: KeyModifier[];
    handler: (event: KeyboardEvent) => void;
    description?: string;
    enabled?: boolean;
    preventDefault?: boolean;
}

interface UseKeyboardShortcutsOptions {
    enabled?: boolean;
    scope?: string; // For grouping shortcuts
}

// Parse a key combo string like 'ctrl+k' into parts
function parseKeyCombo(combo: string): { key: string; modifiers: KeyModifier[] } {
    const parts = combo.toLowerCase().split('+');
    const key = parts.pop() || '';
    const modifiers = parts.filter((p): p is KeyModifier =>
        ['ctrl', 'meta', 'alt', 'shift'].includes(p)
    );
    return { key, modifiers };
}

// Check if all modifiers match
function modifiersMatch(event: KeyboardEvent, modifiers: KeyModifier[]): boolean {
    const ctrlRequired = modifiers.includes('ctrl');
    const metaRequired = modifiers.includes('meta');
    const altRequired = modifiers.includes('alt');
    const shiftRequired = modifiers.includes('shift');

    // Handle Ctrl/Meta interchangeably for cross-platform support
    const cmdPressed = event.ctrlKey || event.metaKey;
    const cmdRequired = ctrlRequired || metaRequired;

    return (
        cmdPressed === cmdRequired &&
        event.altKey === altRequired &&
        event.shiftKey === shiftRequired
    );
}

// Check if the target is an input element
function isInputElement(target: EventTarget | null): boolean {
    if (!target || !(target instanceof Element)) return false;

    const tagName = target.tagName.toLowerCase();
    if (['input', 'textarea', 'select'].includes(tagName)) return true;
    if (target.getAttribute('contenteditable') === 'true') return true;

    return false;
}

export function useKeyboardShortcuts(
    shortcuts: ShortcutHandler[],
    options: UseKeyboardShortcutsOptions = {}
) {
    const { enabled = true } = options;

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (!enabled) return;

        // Skip if focus is in an input field (unless explicitly handled)
        const isInput = isInputElement(event.target);

        for (const shortcut of shortcuts) {
            if (shortcut.enabled === false) continue;

            const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase() ||
                event.code.toLowerCase() === `key${shortcut.key}`.toLowerCase();

            if (!keyMatch) continue;

            const modifiers = shortcut.modifiers || [];
            if (!modifiersMatch(event, modifiers)) continue;

            // Skip input elements for shortcuts without modifiers
            if (isInput && modifiers.length === 0) continue;

            if (shortcut.preventDefault !== false) {
                event.preventDefault();
            }

            shortcut.handler(event);
            return; // Only trigger first matching shortcut
        }
    }, [enabled, shortcuts]);

    useEffect(() => {
        if (!enabled) return;

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [enabled, handleKeyDown]);
}

// Pre-defined common shortcuts for the Hub app
export function useHubShortcuts(handlers: {
    onNewTask?: () => void;
    onNewProject?: () => void;
    onSearch?: () => void;
    onToggleTheme?: () => void;
    onNavigateTasks?: () => void;
    onNavigateProjects?: () => void;
    onNavigateCalendar?: () => void;
    onNavigateDashboard?: () => void;
    onSave?: () => void;
    onCancel?: () => void;
}) {
    const shortcuts: ShortcutHandler[] = [
        // Global shortcuts
        {
            key: 'k',
            modifiers: ['meta'] as KeyModifier[],
            handler: () => handlers.onSearch?.(),
            description: 'Apri ricerca',
        },
        {
            key: 'n',
            modifiers: ['meta', 'shift'] as KeyModifier[],
            handler: () => handlers.onNewTask?.(),
            description: 'Nuovo task',
        },
        {
            key: 'p',
            modifiers: ['meta', 'shift'] as KeyModifier[],
            handler: () => handlers.onNewProject?.(),
            description: 'Nuovo progetto',
        },
        {
            key: 'd',
            modifiers: ['meta'] as KeyModifier[],
            handler: () => handlers.onToggleTheme?.(),
            description: 'Cambia tema',
        },
        // Navigation shortcuts
        {
            key: '1',
            modifiers: ['meta'] as KeyModifier[],
            handler: () => handlers.onNavigateDashboard?.(),
            description: 'Vai a Dashboard',
        },
        {
            key: '2',
            modifiers: ['meta'] as KeyModifier[],
            handler: () => handlers.onNavigateTasks?.(),
            description: 'Vai a Tasks',
        },
        {
            key: '3',
            modifiers: ['meta'] as KeyModifier[],
            handler: () => handlers.onNavigateProjects?.(),
            description: 'Vai a Progetti',
        },
        {
            key: '4',
            modifiers: ['meta'] as KeyModifier[],
            handler: () => handlers.onNavigateCalendar?.(),
            description: 'Vai a Calendario',
        },
        // Form shortcuts
        {
            key: 's',
            modifiers: ['meta'] as KeyModifier[],
            handler: () => handlers.onSave?.(),
            description: 'Salva',
        },
        {
            key: 'Escape',
            modifiers: [] as KeyModifier[],
            handler: () => handlers.onCancel?.(),
            description: 'Annulla/Chiudi',
            preventDefault: false, // Let dialogs handle escape naturally
        },
    ].filter(s => {
        // Only include shortcuts that have handlers defined
        return Object.values(handlers).some(h => h !== undefined);
    });

    useKeyboardShortcuts(shortcuts);
}

// Hook for showing available shortcuts
export function useShortcutsList(): Array<{ keys: string; description: string }> {
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');
    const cmdKey = isMac ? '⌘' : 'Ctrl';

    return [
        { keys: `${cmdKey} + K`, description: 'Apri ricerca rapida' },
        { keys: `${cmdKey} + Shift + N`, description: 'Nuovo task' },
        { keys: `${cmdKey} + Shift + P`, description: 'Nuovo progetto' },
        { keys: `${cmdKey} + D`, description: 'Cambia tema chiaro/scuro' },
        { keys: `${cmdKey} + 1`, description: 'Vai a Dashboard' },
        { keys: `${cmdKey} + 2`, description: 'Vai a Tasks' },
        { keys: `${cmdKey} + 3`, description: 'Vai a Progetti' },
        { keys: `${cmdKey} + 4`, description: 'Vai a Calendario' },
        { keys: `${cmdKey} + S`, description: 'Salva (nei form)' },
        { keys: 'Esc', description: 'Chiudi dialogo/modale' },
    ];
}
