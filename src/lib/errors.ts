export enum ErrorCode {
  AI_RPC_FAILED = 'AI_RPC_FAILED',
  AI_POLLING_FAILED = 'AI_POLLING_FAILED',
  AI_PROCESSING_TIMEOUT = 'AI_PROCESSING_TIMEOUT',
  SCAN_DB_INSERT_FAILED = 'SCAN_DB_INSERT_FAILED',
  SCAN_EDGE_FN_ERROR = 'SCAN_EDGE_FN_ERROR',
  SCAN_MOCK_FAILED = 'SCAN_MOCK_FAILED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  cause?: unknown;
  context?: Record<string, unknown>;
  timestamp: string;
}

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export function success<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function failure(
  code: ErrorCode,
  message: string,
  cause?: unknown,
  context?: Record<string, unknown>,
): Result<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      cause,
      context,
      timestamp: new Date().toISOString(),
    },
  };
}

export function errorToUserMessage(err: ApiError): string {
  switch (err.code) {
    case ErrorCode.AI_RPC_FAILED:
      return 'AI task dispatch failed. Please retry in a moment.';
    case ErrorCode.AI_POLLING_FAILED:
      return 'AI polling failed due to a service error. Please retry shortly.';
    case ErrorCode.AI_PROCESSING_TIMEOUT:
      return 'AI processing timed out. Please try again.';
    case ErrorCode.SCAN_DB_INSERT_FAILED:
      return 'Failed to create scan record.';
    case ErrorCode.SCAN_EDGE_FN_ERROR:
      return 'Scan service unavailable. Real scanner agent is unreachable.';
    case ErrorCode.SCAN_MOCK_FAILED:
      return 'Mock scan failed to execute.';
    default:
      return err.message || 'Unexpected error occurred.';
  }
}
