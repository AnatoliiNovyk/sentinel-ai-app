import { describe, expect, it } from 'vitest';
import {
  gatewayError,
  isPayloadTooLarge,
  parseGatewayRequest,
} from '../../../supabase/functions/ai-gateway/contract';

describe('ai-gateway contract', () => {
  it('parses valid chat payload', () => {
    const result = parseGatewayRequest({
      messages: [{ role: 'user', content: 'Run a quick audit' }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.action).toBe('chat');
      expect(result.value.messages).toHaveLength(1);
    }
  });

  it('normalizes chat message content', () => {
    const result = parseGatewayRequest({
      messages: [{ role: 'user', content: '  test\u0000 content  ' }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.messages[0].content).toBe('test content');
    }
  });

  it('rejects invalid chat message roles', () => {
    const result = parseGatewayRequest({
      messages: [{ role: 'admin', content: 'oops' }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(400);
      expect(result.error.body.error.code).toBe('INVALID_REQUEST');
    }
  });

  it('parses valid kill-chain payload and builds prompt message', () => {
    const result = parseGatewayRequest({
      action: 'generate_kill_chain',
      project: '  Acme  ',
      vulnerabilities: [{ title: 'Open S3 bucket' }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.action).toBe('generate_kill_chain');
      if (result.value.action === 'generate_kill_chain') {
        expect(result.value.project).toBe('Acme');
      }
      expect(result.value.messages[0].content).toContain('project Acme');
      expect(result.value.messages[0].content).toContain('Open S3 bucket');
    }
  });

  it('rejects kill-chain payload without vulnerabilities array', () => {
    const result = parseGatewayRequest({
      action: 'generate_kill_chain',
      project: 'Acme',
      vulnerabilities: 'bad',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.body.error.code).toBe('INVALID_REQUEST');
      expect(result.error.body.error.message).toContain('vulnerabilities');
    }
  });

  it('builds unified safe error payload', () => {
    const err = gatewayError('INVALID_JSON', 'Invalid JSON body.', 400);

    expect(err.status).toBe(400);
    expect(err.body).toEqual({
      error: {
        code: 'INVALID_JSON',
        message: 'Invalid JSON body.',
      },
    });
  });

  it('detects oversized payloads', () => {
    expect(isPayloadTooLarge('12345', 4)).toBe(true);
    expect(isPayloadTooLarge('12345', 5)).toBe(false);
  });

  it('rejects overly large vulnerabilities prompt source', () => {
    const largeItem = { description: 'a'.repeat(10_000) };
    const result = parseGatewayRequest({
      action: 'generate_kill_chain',
      project: 'Acme',
      vulnerabilities: Array.from({ length: 100 }, () => largeItem),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.body.error.code).toBe('INVALID_REQUEST');
      expect(result.error.body.error.message).toContain('too large');
    }
  });
});
