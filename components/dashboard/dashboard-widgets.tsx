'use client';

import { ReactNode } from 'react';
import { UpcomingBirthdaysWidget } from '@/components/birthday-celebration';
import { DeadlineCountdownWidget } from '@/components/dashboard/deadline-countdown';
import { WeatherWidget } from '@/components/dashboard/weather-widget';
import { User, Task } from '@/lib/data';

interface DashboardWidgetsProps {
    users: User[];
    tasks: Task[];
    currentUser: User;
    onTaskClick?: (taskId: string) => void;
    weatherApiKey?: string;
    weatherCity?: string;
}

/**
 * Container per tutti i widget della dashboard
 * Organizza i widget in un layout responsive
 */
export function DashboardWidgets({
    users,
    tasks,
    currentUser,
    onTaskClick,
    weatherApiKey,
    weatherCity
}: DashboardWidgetsProps) {

    // Filtra task dell'utente corrente o tutti se admin
    const userTasks = currentUser.role === 'Amministratore' || currentUser.role === 'Project Manager'
        ? tasks
        : tasks.filter(t => t.assignedUserId === currentUser.id);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Widget Scadenze Imminenti */}
            <DeadlineCountdownWidget
                tasks={userTasks}
                onTaskClick={onTaskClick}
            />

            {/* Widget Prossimi Compleanni */}
            <UpcomingBirthdaysWidget users={users} />

            {/* Widget Meteo */}
            <WeatherWidget
                apiKey={weatherApiKey}
                city={weatherCity}
            />
        </div>
    );
}

/**
 * Versione compatta per sidebar o header
 */
export function DashboardWidgetsCompact({
    users,
    tasks,
    currentUser
}: Omit<DashboardWidgetsProps, 'onTaskClick' | 'weatherApiKey' | 'weatherCity'>) {

    const userTasks = currentUser.role === 'Amministratore' || currentUser.role === 'Project Manager'
        ? tasks
        : tasks.filter(t => t.assignedUserId === currentUser.id);

    return (
        <div className="space-y-2">
            <DeadlineCountdownWidget
                tasks={userTasks}
            />

            <UpcomingBirthdaysWidget users={users} />

            <WeatherWidget compact />
        </div>
    );
}

/**
 * Widget Grid personalizzabile
 * Permette di scegliere quali widget mostrare
 */
interface CustomWidgetGridProps extends DashboardWidgetsProps {
    widgets: {
        deadlines?: boolean;
        birthdays?: boolean;
        weather?: boolean;
    };
}

export function CustomWidgetGrid({
    users,
    tasks,
    currentUser,
    onTaskClick,
    weatherApiKey,
    weatherCity,
    widgets = { deadlines: true, birthdays: true, weather: true }
}: CustomWidgetGridProps) {

    const userTasks = currentUser.role === 'Amministratore' || currentUser.role === 'Project Manager'
        ? tasks
        : tasks.filter(t => t.assignedUserId === currentUser.id);

    const enabledWidgets = Object.values(widgets).filter(Boolean).length;

    if (enabledWidgets === 0) {
        return null;
    }

    return (
        <div className={`grid grid-cols-1 ${enabledWidgets === 1 ? 'lg:grid-cols-1' :
                enabledWidgets === 2 ? 'lg:grid-cols-2' :
                    'lg:grid-cols-2 xl:grid-cols-3'
            } gap-4`}>
            {widgets.deadlines && (
                <DeadlineCountdownWidget
                    tasks={userTasks}
                    onTaskClick={onTaskClick}
                />
            )}

            {widgets.birthdays && (
                <UpcomingBirthdaysWidget users={users} />
            )}

            {widgets.weather && (
                <WeatherWidget
                    apiKey={weatherApiKey}
                    city={weatherCity}
                />
            )}
        </div>
    );
}

/**
 * Widget Wrapper generico
 * Per creare nuovi widget custom
 */
interface WidgetWrapperProps {
    title: string;
    icon?: ReactNode;
    children: ReactNode;
    className?: string;
    gradient?: string;
}

export function WidgetWrapper({
    title,
    icon,
    children,
    className = '',
    gradient = 'from-gray-50 to-slate-50 dark:from-gray-950/20 dark:to-slate-950/20'
}: WidgetWrapperProps) {
    return (
        <div className={`bg-gradient-to-br ${gradient} p-4 rounded-lg border border-gray-200 dark:border-gray-800 ${className}`}>
            <div className="flex items-center gap-2 mb-3">
                {icon}
                <h3 className="font-semibold">{title}</h3>
            </div>
            {children}
        </div>
    );
}
