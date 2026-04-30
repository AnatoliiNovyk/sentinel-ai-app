import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScansService } from '../scans.service';

// ── Mock Supabase client ───────────────────────────────────────────────────
// vi.hoisted() ensures these are available when vi.mock factory runs (before module init)

const { mockSingle, mockSelect, mockInsert, mockEq, mockOrder, mockInvoke, mockGetUser, mockUpdate } = vi.hoisted(() => ({
  mockSingle: vi.fn(),
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockEq: vi.fn(),
  mockOrder: vi.fn(),
  mockInvoke: vi.fn(),
  mockGetUser: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('../client', () => ({
  supabase: {
    auth: {
      getUser: mockGetUser,
    },
    from: () => ({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    }),
    functions: {
      invoke: mockInvoke,
    },
  },
}));

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  // Default: authenticated user
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  // Default: update().eq() resolves ok
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockEq.mockResolvedValue({ data: null, error: null });
});

// ── getProjects ────────────────────────────────────────────────────────────

describe('ScansService.getProjects', () => {
  it('returns projects array on success', async () => {
    const mockProjects = [
      { id: 'p1', name: 'Project Alpha', environment: 'external' },
      { id: 'p2', name: 'Project Beta', environment: 'cloud' },
    ];
    mockSelect.mockReturnValue({
      order: mockOrder,
    });
    mockOrder.mockResolvedValue({ data: mockProjects, error: null });

    const result = await ScansService.getProjects();
    expect(result).toEqual(mockProjects);
    expect(mockSelect).toHaveBeenCalledWith('*');
  });

  it('returns empty array when data is null', async () => {
    mockSelect.mockReturnValue({ order: mockOrder });
    mockOrder.mockResolvedValue({ data: null, error: null });

    const result = await ScansService.getProjects();
    expect(result).toEqual([]);
  });

  it('throws when Supabase returns an error', async () => {
    mockSelect.mockReturnValue({ order: mockOrder });
    mockOrder.mockResolvedValue({ data: null, error: new Error('DB connection failed') });

    await expect(ScansService.getProjects()).rejects.toThrow('DB connection failed');
  });
});

// ── getProjectScans ────────────────────────────────────────────────────────

describe('ScansService.getProjectScans', () => {
  it('returns scans for given projectId', async () => {
    const mockScans = [{ id: 's1', scanner: 'nmap', status: 'completed' }];
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ order: mockOrder });
    mockOrder.mockResolvedValue({ data: mockScans, error: null });

    const result = await ScansService.getProjectScans('proj-123');
    expect(result).toEqual(mockScans);
    expect(mockEq).toHaveBeenCalledWith('project_id', 'proj-123');
  });

  it('returns empty array when no scans found', async () => {
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ order: mockOrder });
    mockOrder.mockResolvedValue({ data: null, error: null });

    const result = await ScansService.getProjectScans('proj-empty');
    expect(result).toEqual([]);
  });

  it('throws on Supabase error', async () => {
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ order: mockOrder });
    mockOrder.mockResolvedValue({ data: null, error: new Error('Not found') });

    await expect(ScansService.getProjectScans('bad-id')).rejects.toThrow('Not found');
  });
});

// ── getScanVulnerabilities ────────────────────────────────────────────────

describe('ScansService.getScanVulnerabilities', () => {
  it('returns vulnerabilities ordered by severity', async () => {
    const mockVulns = [
      { id: 'v1', severity: 'critical', title: 'RCE' },
      { id: 'v2', severity: 'high', title: 'SQLi' },
    ];
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ order: mockOrder });
    mockOrder.mockResolvedValue({ data: mockVulns, error: null });

    const result = await ScansService.getScanVulnerabilities('scan-abc');
    expect(result).toEqual(mockVulns);
    expect(mockEq).toHaveBeenCalledWith('scan_id', 'scan-abc');
  });

  it('returns empty array when no vulnerabilities', async () => {
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ order: mockOrder });
    mockOrder.mockResolvedValue({ data: null, error: null });

    const result = await ScansService.getScanVulnerabilities('clean-scan');
    expect(result).toEqual([]);
  });

  it('throws on Supabase error', async () => {
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ order: mockOrder });
    mockOrder.mockResolvedValue({ data: null, error: new Error('Scan not found') });

    await expect(ScansService.getScanVulnerabilities('missing')).rejects.toThrow('Scan not found');
  });
});

// ── dispatchScan ──────────────────────────────────────────────────────────

describe('ScansService.dispatchScan', () => {
  it('creates scan record and dispatches via edge function', async () => {
    const mockScan = { id: 'scan-new', scanner: 'nmap', status: 'running' };
    mockInsert.mockReturnValue({
      select: () => ({ single: mockSingle }),
    });
    mockSingle.mockResolvedValue({ data: mockScan, error: null });
    mockInvoke.mockResolvedValue({ data: { jobId: 'j1' }, error: null });

    const result = await ScansService.dispatchScan('proj-1', 'nmap', 'target.com', 'org-1');
    expect(result.scan).toEqual(mockScan);
    expect(result.dispatchResult).toEqual({ jobId: 'j1' });
    expect(mockInvoke).toHaveBeenCalledWith('scan-dispatch', expect.objectContaining({
      body: expect.objectContaining({ scanner: 'nmap', project_id: 'proj-1' }),
    }));
  });

  it('throws when scan insert fails', async () => {
    mockInsert.mockReturnValue({
      select: () => ({ single: mockSingle }),
    });
    mockSingle.mockResolvedValue({ data: null, error: new Error('Insert failed') });

    await expect(
      ScansService.dispatchScan('proj-1', 'nmap', 'target.com', 'org-1'),
    ).rejects.toThrow('Insert failed');
  });

  it('throws when edge function returns error', async () => {
    const mockScan = { id: 'scan-x', scanner: 'prowler', status: 'running' };
    mockInsert.mockReturnValue({
      select: () => ({ single: mockSingle }),
    });
    mockSingle.mockResolvedValue({ data: mockScan, error: null });
    mockInvoke.mockResolvedValue({ data: null, error: new Error('Edge function error') });

    await expect(
      ScansService.dispatchScan('proj-2', 'prowler', 'aws-account', 'org-2'),
    ).rejects.toThrow('Edge function error');
  });

  it('throws authentication error when getUser fails', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('Not authenticated') });

    await expect(
      ScansService.dispatchScan('proj-1', 'nmap', 'target.com', 'org-1'),
    ).rejects.toThrow('Authentication required');
  });

  it('throws authentication error when user is null', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    await expect(
      ScansService.dispatchScan('proj-1', 'nmap', 'target.com', 'org-1'),
    ).rejects.toThrow('Authentication required');
  });

  it('throws with error details when insert error has message field (record error)', async () => {
    mockInsert.mockReturnValue({
      select: () => ({ single: mockSingle }),
    });
    // Pass a plain object with message field (not Error instance)
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Constraint violation' } });

    await expect(
      ScansService.dispatchScan('proj-1', 'nmap', 'target.com', 'org-1'),
    ).rejects.toThrow('Constraint violation');
  });

  it('returns generic error message when insert error has no readable fields', async () => {
    mockInsert.mockReturnValue({
      select: () => ({ single: vi.fn() }),
    });
    mockInsert.mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: null, error: {} }) }),
    });

    await expect(
      ScansService.dispatchScan('proj-1', 'nmap', 'target.com', 'org-1'),
    ).rejects.toThrow();
  });

  it('extracts error field from context.json when scanErr has context', async () => {
    const err = Object.assign(new Error('context-json'), {
      context: { json: async () => ({ error: 'payload error from context.json' }) },
    });
    mockInsert.mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: null, error: err }) }),
    });

    await expect(
      ScansService.dispatchScan('proj-1', 'nmap', 'target.com', 'org-1'),
    ).rejects.toThrow('payload error from context.json');
  });

  it('extracts message field from context.json when error field absent', async () => {
    const err = Object.assign(new Error('context-json-msg'), {
      context: { json: async () => ({ message: 'message from context.json' }) },
    });
    mockInsert.mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: null, error: err }) }),
    });

    await expect(
      ScansService.dispatchScan('proj-1', 'nmap', 'target.com', 'org-1'),
    ).rejects.toThrow('message from context.json');
  });

  it('falls back to context.text when context.json is not available', async () => {
    const err = Object.assign(new Error('context-text'), {
      context: { text: async () => 'text body from context' },
    });
    mockInsert.mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: null, error: err }) }),
    });

    await expect(
      ScansService.dispatchScan('proj-1', 'nmap', 'target.com', 'org-1'),
    ).rejects.toThrow('text body from context');
  });

  it('falls back to error.message when context.json() throws', async () => {
    const err = Object.assign(new Error('fallback message'), {
      context: { json: async () => { throw new Error('bad json'); } },
    });
    mockInsert.mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: null, error: err }) }),
    });

    await expect(
      ScansService.dispatchScan('proj-1', 'nmap', 'target.com', 'org-1'),
    ).rejects.toThrow('fallback message');
  });

  it('falls back to error.message when context.text() throws', async () => {
    const err = Object.assign(new Error('text fallback message'), {
      context: { text: async () => { throw new Error('bad text'); } },
    });
    mockInsert.mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: null, error: err }) }),
    });

    await expect(
      ScansService.dispatchScan('proj-1', 'nmap', 'target.com', 'org-1'),
    ).rejects.toThrow('text fallback message');
  });
});
