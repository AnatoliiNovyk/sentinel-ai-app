/**
 * Centralized structured logger for Sentinel AI.
 *
 * - In development (import.meta.env.DEV or NODE_ENV=development): human-readable output
 * - In production: structured JSON lines for log aggregators
 *
 * Usage:
 *   import { createLogger } from '../lib/logger';
 *   const logger = createLogger('AuditService');
 *   logger.info('Scan dispatched', { scanId, projectId });
 *   logger.error('DB insert failed', error, { action });
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  timestamp: string;
  data?: unknown;
  error?: unknown;
}

// Safe way to detect dev/prod that works in both Vite (browser) and Node
function isDevMode(): boolean {
  try {
    // Vite
    return (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;
  } catch {
    /* v8 ignore next 2 */
    // Node.js fallback (import.meta throws in some environments)
    return process.env['NODE_ENV'] === 'development';
  }
}

/* v8 ignore start */
function serializeError(err: unknown): unknown {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return err;
}
/* v8 ignore stop */

function emit(entry: LogEntry): void {
  const devMode = isDevMode();
  const consoleFn = entry.level === 'error'
    ? console.error
    : entry.level === 'warn'
    ? console.warn
    : entry.level === 'debug'
    ? console.debug
    : console.log;

  if (devMode) {
    // Human-readable multi-line output for local development
    const prefix = `[${entry.timestamp.slice(11, 23)}] [${entry.level.toUpperCase().padEnd(5)}] [${entry.module}]`;
    if (entry.error !== undefined) {
      consoleFn(prefix, entry.message, entry.data ?? '', '\n→ error:', entry.error);
    } else if (entry.data !== undefined) {
      consoleFn(prefix, entry.message, entry.data);
    } else {
      consoleFn(prefix, entry.message);
    }
  } else {
    /* v8 ignore start */
    // JSON line — drop undefined fields for cleanliness
    const payload: Record<string, unknown> = {
      level: entry.level,
      module: entry.module,
      message: entry.message,
      timestamp: entry.timestamp,
    };
    if (entry.data !== undefined) payload['data'] = entry.data;
    if (entry.error !== undefined) payload['error'] = serializeError(entry.error);
    consoleFn(JSON.stringify(payload));
    /* v8 ignore stop */
  }
}

export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, err?: unknown, data?: unknown): void;
}

/**
 * Create a module-scoped logger.
 * @param module - Module name shown in every log line, e.g. 'AuditService'
 */
export function createLogger(module: string): Logger {
  return {
    debug(message, data) {
      emit({ level: 'debug', module, message, timestamp: new Date().toISOString(), data });
    },
    info(message, data) {
      emit({ level: 'info', module, message, timestamp: new Date().toISOString(), data });
    },
    warn(message, data) {
      emit({ level: 'warn', module, message, timestamp: new Date().toISOString(), data });
    },
    error(message, err, data) {
      emit({ level: 'error', module, message, timestamp: new Date().toISOString(), data, error: err });
    },
  };
}

/** Singleton root logger for top-level use. */
export const logger = createLogger('App');
