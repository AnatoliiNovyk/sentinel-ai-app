/**
 * Logger unit tests — covers createLogger(), emit() routing, and error serialization.
 * Vitest runs with import.meta.env.DEV=true, so logger emits human-readable output.
 * Tests verify: correct console function per level, module/message in output, no throws.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger, logger } from '../../lib/logger';

const logSpy   = vi.spyOn(console, 'log').mockImplementation(() => {});
const warnSpy  = vi.spyOn(console, 'warn').mockImplementation(() => {});
const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

describe('createLogger()', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it('returns an object with all four log methods', () => {
    const log = createLogger('Test');
    expect(typeof log.debug).toBe('function');
    expect(typeof log.info).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.error).toBe('function');
  });

  it('info() calls console.log', () => {
    createLogger('ModuleA').info('hello');
    expect(logSpy).toHaveBeenCalled();
  });

  it('warn() calls console.warn', () => {
    createLogger('ModuleA').warn('careful');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('error() calls console.error', () => {
    createLogger('ModuleA').error('boom');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('debug() calls console.debug', () => {
    createLogger('ModuleA').debug('trace detail');
    expect(debugSpy).toHaveBeenCalled();
  });

  it('output includes the module name', () => {
    createLogger('MyService').info('test message');
    const allArgs = logSpy.mock.calls[0].join(' ');
    expect(allArgs).toContain('MyService');
  });

  it('output includes the message text', () => {
    createLogger('Svc').info('dispatch complete');
    const allArgs = logSpy.mock.calls[0].join(' ');
    expect(allArgs).toContain('dispatch complete');
  });

  it('output contains extra data when provided', () => {
    createLogger('ScanService').info('dispatched', { scanId: 'abc' });
    // In dev mode the data object is passed as a second argument to console.log
    const call = logSpy.mock.calls[0] as unknown[];
    const hasAbc = call.some((arg) =>
      typeof arg === 'string' ? arg.includes('abc') : JSON.stringify(arg).includes('abc')
    );
    expect(hasAbc).toBe(true);
  });

  it('error() includes error message in output', () => {
    const err = new Error('DB connection refused');
    createLogger('ErrorCase').error('Insert failed', err);
    const allArgs = errorSpy.mock.calls[0].map(String).join(' ');
    expect(allArgs).toContain('DB connection refused');
  });

  it('error() handles non-Error objects without throwing', () => {
    expect(() =>
      createLogger('ErrorCase').error('Unexpected', { code: 500, msg: 'Internal' })
    ).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('does not throw when data is undefined', () => {
    const log = createLogger('Safe');
    expect(() => log.debug('no data')).not.toThrow();
    expect(() => log.info('no data')).not.toThrow();
    expect(() => log.warn('no data')).not.toThrow();
    expect(() => log.error('no data')).not.toThrow();
  });

  it('multiple loggers produce output with their respective module names', () => {
    createLogger('Alpha').info('from A');
    createLogger('Beta').info('from B');
    expect(logSpy.mock.calls[0].join(' ')).toContain('Alpha');
    expect(logSpy.mock.calls[1].join(' ')).toContain('Beta');
  });

  it('same logger called twice produces two console calls', () => {
    const log = createLogger('Repeat');
    log.info('first');
    log.info('second');
    expect(logSpy).toHaveBeenCalledTimes(2);
  });
});

describe('root logger singleton', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is a usable logger with module "App"', () => {
    logger.info('sentinel up');
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy.mock.calls[0].join(' ')).toContain('App');
  });

  it('error level uses console.error', () => {
    logger.error('fatal error');
    expect(errorSpy).toHaveBeenCalled();
  });
});
