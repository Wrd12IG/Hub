'use client';

import { FC, SVGProps } from 'react';

// Mapping delle icone Audi per il menu sidebar
// Usa le icone "s" (small - 24x24) per la sidebar
const AUDI_ICONS_PATH = '/assets/250912_Audi_Icons_4.8/svg/';

export const audiIconMap: Record<string, string> = {
    // Menu principale
    'dashboard': 'dashboard-s.svg',
    'tasks': 'list-s.svg',
    'projects': 'projects-s.svg',
    'calendar': 'calendar-events-s.svg',
    'documents': 'documents-s.svg',
    'chat': 'voice-call-s.svg',
    'settings': 'settings-s.svg',
    'upload': 'upload-s.svg',
    'news': 'news-s.svg',
    'sync': 'sync-s.svg',
    'home': 'home-s.svg',
    'book': 'logbook-s.svg',
    'user': 'user-s.svg',

    // Fallback generico
    'default': 'list-s.svg',
};

interface AudiIconProps extends SVGProps<SVGSVGElement> {
    name: keyof typeof audiIconMap | string;
    className?: string;
}

// Componente che renderizza l'icona Audi come immagine inline
export const AudiIcon: FC<AudiIconProps> = ({ name, className = 'h-5 w-5', ...props }) => {
    const iconFile = audiIconMap[name] || audiIconMap['default'];
    const iconPath = AUDI_ICONS_PATH + iconFile;

    return (
        <img
            src={iconPath}
            alt={name}
            className={className}
            style={{
                filter: 'brightness(0) invert(1)', // Makes icon white for dark sidebar
                width: '20px',
                height: '20px',
            }}
        />
    );
};

// Mappa le icone Lucide ai corrispettivi Audi
export const lucideToAudiMap: Record<string, string> = {
    'Gauge': 'dashboard',
    'ClipboardList': 'tasks',
    'LayoutGrid': 'projects',
    'Calendar': 'calendar',
    'FileText': 'documents',
    'MessageSquare': 'chat',
    'Settings': 'settings',
    'Upload': 'upload',
    'Newspaper': 'news',
    'Repeat': 'sync',
    'Home': 'home',
    'BookOpen': 'book',
    'Library': 'projects',
    'BarChart3': 'dashboard',
    'CalendarX2': 'calendar',
    'Image': 'default',
};
