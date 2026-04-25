import { describe, it, expect } from 'vitest';
import { nucleiSeverityMap, parseNucleiOutput } from '../nucleiParser';

// ─── nucleiSeverityMap ────────────────────────────────────────────────────────

describe('nucleiSeverityMap', () => {
  it.each([
    ['critical', 'critical'],
    ['CRITICAL', 'critical'],
    ['high',     'high'],
    ['HIGH',     'high'],
    ['medium',   'medium'],
    ['MEDIUM',   'medium'],
    ['low',      'low'],
    ['LOW',      'low'],
    ['info',     'info'],
    ['INFO',     'info'],
    ['unknown',  'info'],
    ['',         'info'],
  ])('maps "%s" → "%s"', (input, expected) => {
    expect(nucleiSeverityMap(input)).toBe(expected);
  });
});

// ─── parseNucleiOutput ────────────────────────────────────────────────────────

const TARGET = 'example.com';

const makeEntry = (overrides: object = {}) =>
  JSON.stringify({
    'template-id': 'test-template',
    info: {
      name: 'Test Finding',
      severity: 'high',
      description: 'A test vulnerability',
      reference: ['https://example.com/ref'],
    },
    'matched-at': `${TARGET}:443`,
    ...overrides,
  });

describe('parseNucleiOutput', () => {
  it('returns placeholder finding for empty output', () => {
    const findings = parseNucleiOutput('', TARGET);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('info');
    expect(findings[0].title).toMatch(/No vulnerabilities/);
    expect(findings[0].asset).toBe(TARGET);
  });

  it('returns placeholder for whitespace-only output', () => {
    const findings = parseNucleiOutput('   \n\n  ', TARGET);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('info');
  });

  it('skips non-JSON lines', () => {
    const output = [
      '[INF] Loading templates...',
      '[INF] Targets loaded',
      makeEntry(),
    ].join('\n');
    const findings = parseNucleiOutput(output, TARGET);
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Test Finding');
  });

  it('skips malformed JSON lines', () => {
    const output = [
      '{invalid json}',
      '{"broken":',
      makeEntry(),
    ].join('\n');
    const findings = parseNucleiOutput(output, TARGET);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('high');
  });

  it('parses severity correctly from info.severity', () => {
    const output = makeEntry({ info: { name: 'SSH', severity: 'critical', description: 'desc' } });
    const findings = parseNucleiOutput(output, TARGET);
    expect(findings[0].severity).toBe('critical');
  });

  it('falls back to info severity when severity is missing', () => {
    const output = JSON.stringify({ 'template-id': 'tpl', info: { name: 'X' } });
    const findings = parseNucleiOutput(output, TARGET);
    expect(findings[0].severity).toBe('info');
  });

  it('uses template-id as title when info.name is missing', () => {
    const output = JSON.stringify({ 'template-id': 'my-template-id', info: {} });
    const findings = parseNucleiOutput(output, TARGET);
    expect(findings[0].title).toBe('my-template-id');
  });

  it('falls back to "Unknown finding" when template-id and name are both missing', () => {
    const output = JSON.stringify({ info: {} });
    const findings = parseNucleiOutput(output, TARGET);
    expect(findings[0].title).toBe('Unknown finding');
  });

  it('sets asset to target', () => {
    const findings = parseNucleiOutput(makeEntry(), TARGET);
    expect(findings[0].asset).toBe(TARGET);
  });

  it('includes matched-at in description', () => {
    const findings = parseNucleiOutput(makeEntry(), TARGET);
    expect(findings[0].description).toContain(`${TARGET}:443`);
  });

  it('uses first reference as remediation link', () => {
    const findings = parseNucleiOutput(makeEntry(), TARGET);
    expect(findings[0].remediation).toContain('https://example.com/ref');
  });

  it('uses generic remediation when no reference', () => {
    const output = JSON.stringify({ 'template-id': 'tpl', info: { severity: 'low' }, 'matched-at': TARGET });
    const findings = parseNucleiOutput(output, TARGET);
    expect(findings[0].remediation).toContain('patch');
  });

  it('parses multiple findings from multi-line JSONL', () => {
    const lines = [
      makeEntry({ info: { name: 'Finding 1', severity: 'high',   description: 'd1' } }),
      makeEntry({ info: { name: 'Finding 2', severity: 'medium', description: 'd2' } }),
      makeEntry({ info: { name: 'Finding 3', severity: 'low',    description: 'd3' } }),
    ].join('\n');
    const findings = parseNucleiOutput(lines, TARGET);
    expect(findings).toHaveLength(3);
    expect(findings.map(f => f.severity)).toEqual(['high', 'medium', 'low']);
  });

  it('all findings have status open and remediation_type patch', () => {
    const findings = parseNucleiOutput(makeEntry(), TARGET);
    expect(findings[0].status).toBe('open');
    expect(findings[0].remediation_type).toBe('patch');
  });
});
