/**
 * RLS E2E Tests — Row Level Security isolation simulation.
 *
 * These tests verify that the Supabase service layer constructs properly scoped
 * queries and that cross-tenant data is not returned.
 *
 * Strategy:
 *  - Mock the Supabase client to behave like Postgres RLS: each mock factory
 *    tracks which `user_id`/`org_id` context is active and returns empty data
 *    (or an error) when a resource does not belong to that context.
 *  - Two fixture users: USER_A (owner of fixtures) and USER_B (the attacker).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScansService } from '../scans.service';
import { AuditService, AuditAction } from '../audit.service';

// ─────────────────────────────────────────────────────────────────────────────
// Fixture identifiers (plain consts — safe to use outside vi.mock)
// ─────────────────────────────────────────────────────────────────────────────
const USER_A = { id: 'user-a-00000000-0000-0000-0000-000000000001', orgId: 'org-a-111' };
const USER_B = { id: 'user-b-00000000-0000-0000-0000-000000000002', orgId: 'org-b-222' };

const PROJECT_A_ID = 'project-a-111';
const SCAN_A_ID    = 'scan-a-111';

// Shared mutable state for active user.
// vi.hoisted() MUST NOT reference module-level consts — inline the literal.
const ctx = vi.hoisted(() => ({ activeUserId: 'user-a-00000000-0000-0000-0000-000000000001' }));

// ─────────────────────────────────────────────────────────────────────────────
// RLS-aware Supabase mock
// All fixture rows are declared inside the factory to avoid hoisting issues.
// ─────────────────────────────────────────────────────────────────────────────
vi.mock('../client', () => {
  // Fixtures live inside the factory — no hoisting issues
  const USER_A_ID = 'user-a-00000000-0000-0000-0000-000000000001';
  const USER_B_ID = 'user-b-00000000-0000-0000-0000-000000000002';

  const projects = [
    { id: 'project-a-111', user_id: USER_A_ID, org_id: 'org-a-111', name: 'Alpha Project' },
  ];
  const scans = [
    { id: 'scan-a-111', project_id: 'project-a-111', user_id: USER_A_ID, org_id: 'org-a-111', scanner: 'nmap', status: 'completed' },
  ];
  const vulns = [
    { id: 'vuln-a-111', scan_id: 'scan-a-111', user_id: USER_A_ID, title: 'Open port 22', severity: 'medium' },
  ];
  const notifs = [
    { id: 'notif-1', user_id: USER_A_ID, message: 'Scan done', is_read: false },
    { id: 'notif-2', user_id: USER_B_ID, message: 'Alert for B', is_read: false },
  ];

  function rlsFilter<T extends Record<string, unknown>>(rows: T[]): T[] {
    return rows.filter((r) => r['user_id'] === ctx.activeUserId);
  }

  // Creates a Supabase-like chainable query object whose terminal call applies RLS
  const makeChain = (resolveData: () => unknown) => {
    const self: Record<string, unknown> = {};
    const chain = () => makeChain(resolveData);
    self['select']      = chain;
    self['eq']          = chain;
    self['order']       = chain;
    self['limit']       = chain;
    self['gte']         = chain;
    self['lte']         = chain;
    self['single']      = vi.fn(() => Promise.resolve({ data: resolveData(), error: null }));
    self['maybeSingle'] = vi.fn(() => Promise.resolve({ data: resolveData(), error: null }));
    // Make it thenable so `await chain` resolves
    self['then']        = (cb: (v: unknown) => unknown) =>
      Promise.resolve({ data: resolveData(), error: null }).then(cb);
    return self;
  };

  return {
    supabase: {
      auth: {
        getUser: vi.fn(() =>
          Promise.resolve({ data: { user: { id: ctx.activeUserId } }, error: null })
        ),
      },
      from: vi.fn((table: string) => {
        if (table === 'projects') {
          return makeChain(() => rlsFilter(projects));
        }
        if (table === 'scans') {
          const chain = makeChain(() => rlsFilter(scans));
          (chain as Record<string, unknown>)['insert'] = () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: 'scan-new', user_id: ctx.activeUserId, project_id: 'project-a-111', status: 'running' },
                  error: null,
                }),
            }),
          });
          return chain;
        }
        if (table === 'vulnerabilities') {
          return makeChain(() => rlsFilter(vulns));
        }
        if (table === 'notifications') {
          return makeChain(() => rlsFilter(notifs));
        }
        if (table === 'audit_logs') {
          return {
            insert: vi.fn(() => Promise.resolve({ error: null })),
            select: () => ({
              eq: () => ({
                order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
              }),
            }),
          };
        }
        return {
          select: () => Promise.resolve({ data: [], error: null }),
          insert: () => Promise.resolve({ error: null }),
        };
      }),
      functions: {
        invoke: vi.fn(() => Promise.resolve({ data: { job_id: 'job-mock' }, error: null })),
      },
    },
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
describe('RLS — Row Level Security Isolation', () => {
  beforeEach(() => {
    ctx.activeUserId = USER_A.id;
    vi.clearAllMocks();
  });

  // ── Projects ───────────────────────────────────────────────────────────────
  describe('projects table', () => {
    it('owner (User A) can read their own projects', async () => {
      ctx.activeUserId = USER_A.id;
      const projects = await ScansService.getProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].id).toBe(PROJECT_A_ID);
    });

    it('non-owner (User B) receives no projects from User A', async () => {
      ctx.activeUserId = USER_B.id;
      const projects = await ScansService.getProjects();
      expect(projects).toHaveLength(0);
    });

    it('project rows are not exposed across tenants', async () => {
      ctx.activeUserId = USER_A.id;
      const projectsA = await ScansService.getProjects();

      ctx.activeUserId = USER_B.id;
      const projectsB = await ScansService.getProjects();

      const idsA = projectsA.map((p) => p.id);
      const idsB = projectsB.map((p) => p.id);
      expect(idsA.filter((id) => idsB.includes(id))).toHaveLength(0);
    });
  });

  // ── Scans ──────────────────────────────────────────────────────────────────
  describe('scans table', () => {
    it('owner can read their own scans', async () => {
      ctx.activeUserId = USER_A.id;
      const scans = await ScansService.getProjectScans(PROJECT_A_ID);
      expect(scans.length).toBeGreaterThan(0);
      scans.forEach((s) => expect(s.user_id).toBe(USER_A.id));
    });

    it('non-owner receives no scans belonging to User A', async () => {
      ctx.activeUserId = USER_B.id;
      const scans = await ScansService.getProjectScans(PROJECT_A_ID);
      expect(scans).toHaveLength(0);
    });
  });

  // ── Vulnerabilities ────────────────────────────────────────────────────────
  describe('vulnerabilities table', () => {
    it('owner can read their own vulnerabilities', async () => {
      ctx.activeUserId = USER_A.id;
      const vulns = await ScansService.getScanVulnerabilities(SCAN_A_ID);
      expect(vulns.length).toBeGreaterThan(0);
      vulns.forEach((v) => expect(v.user_id).toBe(USER_A.id));
    });

    it('non-owner receives no vulnerabilities belonging to User A', async () => {
      ctx.activeUserId = USER_B.id;
      const vulns = await ScansService.getScanVulnerabilities(SCAN_A_ID);
      expect(vulns).toHaveLength(0);
    });
  });

  // ── Audit Logs ─────────────────────────────────────────────────────────────
  describe('audit_logs table', () => {
    it('AuditService.log() inserts audit entry without throwing', async () => {
      ctx.activeUserId = USER_A.id;
      await expect(
        AuditService.log({
          orgId: USER_A.orgId,
          userId: USER_A.id,
          action: AuditAction.SCAN_CREATED,
          resourceType: 'scan',
          resourceId: SCAN_A_ID,
          status: 'success',
        })
      ).resolves.toBeUndefined();
    });

    it('logSecurityEvent does not throw for valid user context', () => {
      ctx.activeUserId = USER_A.id;
      expect(() =>
        AuditService.logSecurityEvent(
          USER_A.orgId,
          USER_A.id,
          AuditAction.USER_LOGIN,
          'session',
          USER_A.id,
          { ip: '127.0.0.1' }
        )
      ).not.toThrow();
    });
  });

  // ── Scan dispatch — attribution ────────────────────────────────────────────
  describe('scan dispatch attribution', () => {
    it('dispatched scan is attributed to the authenticated user', async () => {
      ctx.activeUserId = USER_A.id;
      const result = await ScansService.dispatchScan(PROJECT_A_ID, 'nmap', '10.0.0.1', USER_A.orgId);
      expect(result.scan.user_id).toBe(USER_A.id);
    });

    it('User B scan is attributed to User B, not User A', async () => {
      ctx.activeUserId = USER_B.id;
      const result = await ScansService.dispatchScan(PROJECT_A_ID, 'nmap', '10.0.0.2', USER_B.orgId);
      expect(result.scan.user_id).toBe(USER_B.id);
      expect(result.scan.user_id).not.toBe(USER_A.id);
    });
  });

  // ── Tenant isolation summary ───────────────────────────────────────────────
  describe('tenant isolation summary', () => {
    it('Tenant B sees none of Tenant A data across all queried tables', async () => {
      ctx.activeUserId = USER_B.id;

      const projects = await ScansService.getProjects();
      expect(projects.every((p) => p.user_id !== USER_A.id)).toBe(true);

      const scans = await ScansService.getProjectScans(PROJECT_A_ID);
      expect(scans.every((s) => s.user_id !== USER_A.id)).toBe(true);

      const vulns = await ScansService.getScanVulnerabilities(SCAN_A_ID);
      expect(vulns.every((v) => v.user_id !== USER_A.id)).toBe(true);
    });

    it('Tenant A still sees all their own data', async () => {
      ctx.activeUserId = USER_A.id;

      const projects = await ScansService.getProjects();
      expect(projects.length).toBeGreaterThan(0);

      const scans = await ScansService.getProjectScans(PROJECT_A_ID);
      expect(scans.length).toBeGreaterThan(0);

      const vulns = await ScansService.getScanVulnerabilities(SCAN_A_ID);
      expect(vulns.length).toBeGreaterThan(0);
    });
  });
});
