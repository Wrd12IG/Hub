/**
 * Centralized logging service
 * Provides structured logging with severity levels and optional external reporting
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    context?: string;
    data?: Record<string, any>;
    userId?: string;
    error?: Error;
}

interface LoggerOptions {
    enableConsole?: boolean;
    minLevel?: LogLevel;
    context?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

class Logger {
    private options: LoggerOptions;
    private context?: string;

    constructor(options: LoggerOptions = {}) {
        this.options = {
            enableConsole: true,
            minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
            ...options,
        };
        this.context = options.context;
    }

    private shouldLog(level: LogLevel): boolean {
        const minLevel = this.options.minLevel || 'debug';
        return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
    }

    private formatMessage(entry: LogEntry): string {
        const parts = [
            `[${entry.timestamp}]`,
            `[${entry.level.toUpperCase()}]`,
        ];

        if (entry.context) {
            parts.push(`[${entry.context}]`);
        }

        parts.push(entry.message);

        return parts.join(' ');
    }

    private createEntry(
        level: LogLevel,
        message: string,
        data?: Record<string, any>,
        error?: Error
    ): LogEntry {
        return {
            level,
            message,
            timestamp: new Date().toISOString(),
            context: this.context,
            data,
            error,
        };
    }

    private log(entry: LogEntry): void {
        if (!this.shouldLog(entry.level)) return;

        const formattedMessage = this.formatMessage(entry);

        if (this.options.enableConsole) {
            switch (entry.level) {
                case 'debug':
                    console.debug(formattedMessage, entry.data || '');
                    break;
                case 'info':
                    console.info(formattedMessage, entry.data || '');
                    break;
                case 'warn':
                    console.warn(formattedMessage, entry.data || '');
                    break;
                case 'error':
                    console.error(formattedMessage, entry.error || entry.data || '');
                    break;
            }
        }

        // Here you could add external logging service integration
        // e.g., Sentry, LogRocket, etc.
        if (entry.level === 'error' && entry.error) {
            this.reportError(entry);
        }
    }

    private reportError(entry: LogEntry): void {
        // TODO: Integrate with external error tracking service
        // Example with Sentry:
        // if (typeof window !== 'undefined' && window.Sentry) {
        //   window.Sentry.captureException(entry.error, {
        //     extra: entry.data,
        //     tags: { context: entry.context },
        //   });
        // }
    }

    debug(message: string, data?: Record<string, any>): void {
        this.log(this.createEntry('debug', message, data));
    }

    info(message: string, data?: Record<string, any>): void {
        this.log(this.createEntry('info', message, data));
    }

    warn(message: string, data?: Record<string, any>): void {
        this.log(this.createEntry('warn', message, data));
    }

    error(message: string, error?: Error | unknown, data?: Record<string, any>): void {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        this.log(this.createEntry('error', message, data, errorObj));
    }

    // Create a child logger with a specific context
    child(context: string): Logger {
        return new Logger({
            ...this.options,
            context: this.context ? `${this.context}:${context}` : context,
        });
    }
}

// Singleton logger instance
export const logger = new Logger();

// Pre-configured loggers for different modules
export const taskLogger = logger.child('tasks');
export const projectLogger = logger.child('projects');
export const authLogger = logger.child('auth');
export const notificationLogger = logger.child('notifications');
export const firebaseLogger = logger.child('firebase');
export const apiLogger = logger.child('api');

// Helper for measuring performance
export function measureTime<T>(
    label: string,
    fn: () => T | Promise<T>,
    loggerInstance: Logger = logger
): T | Promise<T> {
    const start = performance.now();
    const result = fn();

    if (result instanceof Promise) {
        return result.finally(() => {
            const duration = performance.now() - start;
            loggerInstance.debug(`${label} completed`, { durationMs: duration.toFixed(2) });
        });
    }

    const duration = performance.now() - start;
    loggerInstance.debug(`${label} completed`, { durationMs: duration.toFixed(2) });
    return result;
}

// Helper for logging API calls
export function logApiCall(
    method: string,
    endpoint: string,
    status: number,
    durationMs: number,
    data?: Record<string, any>
): void {
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    apiLogger[level](`${method} ${endpoint} - ${status}`, {
        method,
        endpoint,
        status,
        durationMs,
        ...data,
    });
}

export default logger;
