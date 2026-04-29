import { describe, expect, it } from 'vitest';
import { errorToUserMessage, ErrorCode, success, failure } from '../errors';

describe('errorToUserMessage', () => {
  it('maps known scan edge error', () => {
    const msg = errorToUserMessage({
      code: ErrorCode.SCAN_EDGE_FN_ERROR,
      message: 'edge failed',
      timestamp: new Date().toISOString(),
    });

    expect(msg).toContain('Scan service unavailable');
  });

  it('returns fallback message for unknown errors', () => {
    const msg = errorToUserMessage({
      code: ErrorCode.UNKNOWN_ERROR,
      message: 'custom unknown',
      timestamp: new Date().toISOString(),
    });

    expect(msg).toBe('custom unknown');
  });

  it('maps AI_RPC_FAILED', () => {
    const msg = errorToUserMessage({ code: ErrorCode.AI_RPC_FAILED, message: '', timestamp: '' });
    expect(msg).toMatch(/AI task dispatch failed/i);
  });

  it('maps AI_POLLING_FAILED', () => {
    const msg = errorToUserMessage({ code: ErrorCode.AI_POLLING_FAILED, message: '', timestamp: '' });
    expect(msg).toMatch(/AI polling failed/i);
  });

  it('maps AI_PROCESSING_TIMEOUT', () => {
    const msg = errorToUserMessage({ code: ErrorCode.AI_PROCESSING_TIMEOUT, message: '', timestamp: '' });
    expect(msg).toMatch(/timed out/i);
  });

  it('maps SCAN_DB_INSERT_FAILED', () => {
    const msg = errorToUserMessage({ code: ErrorCode.SCAN_DB_INSERT_FAILED, message: '', timestamp: '' });
    expect(msg).toMatch(/Failed to create scan record/i);
  });

  it('maps SCAN_MOCK_FAILED', () => {
    const msg = errorToUserMessage({ code: ErrorCode.SCAN_MOCK_FAILED, message: '', timestamp: '' });
    expect(msg).toMatch(/Mock scan failed/i);
  });

  it('UNKNOWN_ERROR returns raw message when present', () => {
    const msg = errorToUserMessage({ code: ErrorCode.UNKNOWN_ERROR, message: '', timestamp: '' });
    expect(msg).toBe('Unexpected error occurred.');
  });
});

describe('success / failure helpers', () => {
  it('success wraps data', () => {
    const r = success(42);
    expect(r).toEqual({ ok: true, data: 42 });
  });

  it('failure wraps an ApiError', () => {
    const r = failure(ErrorCode.SCAN_MOCK_FAILED, 'mock failed');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe(ErrorCode.SCAN_MOCK_FAILED);
      expect(r.error.message).toBe('mock failed');
      expect(r.error.timestamp).toBeTruthy();
    }
  });

  it('failure preserves cause and context', () => {
    const cause = new Error('db error');
    const r = failure(ErrorCode.SCAN_DB_INSERT_FAILED, 'insert failed', cause, { table: 'scans' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.cause).toBe(cause);
      expect(r.error.context).toEqual({ table: 'scans' });
    }
  });
});
