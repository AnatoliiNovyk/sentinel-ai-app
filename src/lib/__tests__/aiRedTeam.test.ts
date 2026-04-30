import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateKillChain } from '../aiRedTeam';

const { mockGetUser, mockInsertJob, mockPollJob, mockGetVuln } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockInsertJob: vi.fn(),
  mockPollJob: vi.fn(),
  mockGetVuln: vi.fn(),
}));

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getUser: mockGetUser,
    },
    from: (table: string) => {
      if (table === 'scan_jobs') {
        return {
          insert: () => ({
            select: () => ({
              single: mockInsertJob,
            }),
          }),
          select: () => ({
            eq: () => ({
              single: mockPollJob,
            }),
          }),
        };
      }
      if (table === 'vulnerabilities') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  single: mockGetVuln,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    },
  },
}));

describe('generateKillChain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when vulns list is empty', async () => {
    const result = await generateKillChain('TestProject', []);
    expect(result).toEqual([]);
  });

  it('returns empty array when no authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const result = await generateKillChain('TestProject', [
      { title: 'SQL Injection', severity: 'critical', asset: 'api.example.com' },
    ]);
    expect(result).toEqual([]);
  });

  it('returns empty array when job insert fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockInsertJob.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });
    const result = await generateKillChain('TestProject', [
      { title: 'RCE', severity: 'critical', asset: 'server.example.com' },
    ]);
    expect(result).toEqual([]);
  });

  it('returns empty array after polling timeout (status never "completed")', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockInsertJob.mockResolvedValue({ data: { id: 'job-1' }, error: null });
    // Always return 'pending' status
    mockPollJob.mockResolvedValue({ data: { status: 'pending' }, error: null });

    // Override setTimeout to not actually wait
    vi.useFakeTimers();
    const promise = generateKillChain('TestProject', [
      { title: 'XSS', severity: 'medium', asset: 'app.example.com' },
    ]);
    // Advance all timers (30 * 2000ms polls)
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toEqual([]);
    vi.useRealTimers();
  }, 30000);

  it('returns parsed JSON when job completes and vuln description is valid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockInsertJob.mockResolvedValue({ data: { id: 'job-1' }, error: null });
    mockPollJob.mockResolvedValue({ data: { status: 'completed' }, error: null });
    const killChainData = [
      { phase: 'Recon', tactic: 'TA0043', description: 'Scan open ports', exploited_vuln: 'XSS', asset: 'app' },
    ];
    mockGetVuln.mockResolvedValue({ data: { description: JSON.stringify(killChainData) }, error: null });

    vi.useFakeTimers();
    const promise = generateKillChain('TestProject', [
      { title: 'XSS', severity: 'medium', asset: 'app.example.com' },
    ]);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toEqual(killChainData);
    vi.useRealTimers();
  }, 30000);

  it('returns empty array when vuln description is invalid JSON', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockInsertJob.mockResolvedValue({ data: { id: 'job-1' }, error: null });
    mockPollJob.mockResolvedValue({ data: { status: 'completed' }, error: null });
    mockGetVuln.mockResolvedValue({ data: { description: '{not valid json!!!' }, error: null });

    vi.useFakeTimers();
    const promise = generateKillChain('TestProject', [
      { title: 'RCE', severity: 'critical', asset: 'server.example.com' },
    ]);
    await vi.runAllTimersAsync();
    const result = await promise;
    // JSON.parse throws → catch block → returns [] fallback
    expect(result).toEqual([]);
    vi.useRealTimers();
  }, 30000);
});
