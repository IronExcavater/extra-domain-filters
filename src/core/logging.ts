export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

export type ErrorHandler = (error: unknown) => void;

const LEVELS: Readonly<Record<LogLevel, number>> = {
    silent: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
};

const isLogLevel = (value: unknown): value is LogLevel =>
    typeof value === 'string' && value in LEVELS;

const resolveDefaultLevel = (): LogLevel => {
    const mode = import.meta.env?.MODE ?? 'production';
    return mode === 'development' ? 'debug' : 'info';
}

const resolveConfiguredLevel = (): LogLevel | undefined => {
    const configured = import.meta.env?.VITE_LOG_LEVEL;
    return isLogLevel(configured) ? configured : undefined;
}

let activeLevel: LogLevel = resolveConfiguredLevel() ?? resolveDefaultLevel();

export function setLogLevel(level: LogLevel): void {
    activeLevel = level;
}

export function getLogLevel(): LogLevel {
    return activeLevel;
}

const shouldLog = (level: LogLevel): boolean =>
    LEVELS[level] > 0 && LEVELS[level] <= LEVELS[activeLevel];

export function normalizeError(error: unknown): Error {
    if (error instanceof Error) return error;

    if (typeof error === 'string') return new Error(error || 'Unknown error');

    try {
        return new Error(JSON.stringify(error));
    } catch {
        return new Error('Unknown error occurred');
    }
}

type LogFn = (message: string, ...args: unknown[]) => void;

export interface Logger {
    scope: string;
    info: LogFn;
    warn: LogFn;
    error: LogFn;
    debug: LogFn;
    child: (childScope: string) => Logger;
}

export const createLogger = (scope: string) => {
    const prefix = `[${scope.toTitleCase()}]`;

    const log = (
        level: LogLevel): LogFn => (
        message: string,
        ...args
    ): void => {
        if (!shouldLog(level)) return;

        const logFn = console[level as keyof typeof console] as (...args: unknown[]) => void;
        logFn(`${prefix} ${message}`, ...args);
    }

    return {
        scope,
        info: log('info'),
        warn: log('warn'),
        error: log('error'),
        debug: log('debug'),
        child: (childScope: string) => createLogger(`${scope}:${childScope}`),
    }
}