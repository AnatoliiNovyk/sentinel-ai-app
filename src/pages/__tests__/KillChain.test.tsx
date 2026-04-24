import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import KillChain from '../KillChain';

// ── Mocks ─────────────────────────────────────────────────────────────────

const { mockGenerateKillChain } = vi.hoisted(() => ({
  mockGenerateKillChain: vi.fn(),
}));

vi.mock('../../lib/aiRedTeam', () => ({
  generateKillChain: mockGenerateKillChain,
}));

vi.mock('../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase')>();
  return {
    ...actual,
    supabase: {
      from: (table: string) => {
        if (table === 'projects') {
          return {
            select: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    { id: 'proj-1', name: 'Alpha Project', user_id: 'u-1', org_id: 'o-1', description: '', target: 'example.com', environment: 'external', created_at: '2026-01-01T00:00:00Z', tags: [], risk_score: 0 },
                    { id: 'proj-2', name: 'Beta Project', user_id: 'u-1', org_id: 'o-1', description: '', target: 'beta.com', environment: 'cloud', created_at: '2026-02-01T00:00:00Z', tags: [], risk_score: 0 },
                  ],
                  error: null,
                }),
            }),
          };
        }
        if (table === 'scans') {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: [{ id: 'scan-1' }], error: null }),
            }),
          };
        }
        // vulnerabilities
        return {
          select: () => ({
            in: () => ({
              eq: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      },
    },
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────

const KILL_CHAIN_STEPS = [
  {
    phase: 'Reconnaissance',
    tactic: 'Active Scanning',
    description: 'Attacker scans exposed services.',
    exploited_vuln: 'CVE-2023-1234',
    asset: 'api.example.com',
  },
  {
    phase: 'Initial Access',
    tactic: 'Exploit Public App',
    description: 'Attacker exploits a web vulnerability.',
    exploited_vuln: 'CVE-2023-5678',
    asset: 'web.example.com',
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────

describe('KillChain — layout', () => {
  it('renders "AI Red Team Simulation" heading', async () => {
    render(<KillChain />);
    expect(screen.getByText('AI Red Team Simulation')).toBeInTheDocument();
  });

  it('renders "Target Project" label', async () => {
    render(<KillChain />);
    expect(screen.getByText('Target Project')).toBeInTheDocument();
  });

  it('renders "Generate Kill Chain" button', async () => {
    render(<KillChain />);
    expect(
      screen.getByRole('button', { name: /generate kill chain/i }),
    ).toBeInTheDocument();
  });

  it('renders project options after load', async () => {
    render(<KillChain />);
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Alpha Project' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('option', { name: 'Beta Project' })).toBeInTheDocument();
  });
});

describe('KillChain — simulation', () => {
  it('button is disabled while loading', async () => {
    mockGenerateKillChain.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(KILL_CHAIN_STEPS), 200)),
    );
    render(<KillChain />);
    await waitFor(() => screen.getByRole('option', { name: 'Alpha Project' }));
    fireEvent.click(screen.getByRole('button', { name: /generate kill chain/i }));
    expect(screen.getByRole('button', { name: /simulating attack/i })).toBeDisabled();
  });

  it('renders kill chain steps after generation', async () => {
    mockGenerateKillChain.mockResolvedValue(KILL_CHAIN_STEPS);
    render(<KillChain />);
    await waitFor(() => screen.getByRole('option', { name: 'Alpha Project' }));
    fireEvent.click(screen.getByRole('button', { name: /generate kill chain/i }));
    await waitFor(() =>
      expect(screen.getByText('Attack Vector Generated')).toBeInTheDocument(),
    );
  });

  it('renders each phase name', async () => {
    mockGenerateKillChain.mockResolvedValue(KILL_CHAIN_STEPS);
    render(<KillChain />);
    await waitFor(() => screen.getByRole('option', { name: 'Alpha Project' }));
    fireEvent.click(screen.getByRole('button', { name: /generate kill chain/i }));
    await waitFor(() =>
      expect(screen.getAllByText('Reconnaissance').length).toBeGreaterThanOrEqual(1),
    );
    expect(screen.getAllByText('Initial Access').length).toBeGreaterThanOrEqual(1);
  });

  it('renders tactic names', async () => {
    mockGenerateKillChain.mockResolvedValue(KILL_CHAIN_STEPS);
    render(<KillChain />);
    await waitFor(() => screen.getByRole('option', { name: 'Alpha Project' }));
    fireEvent.click(screen.getByRole('button', { name: /generate kill chain/i }));
    await waitFor(() =>
      expect(screen.getAllByText(/Active Scanning/i).length).toBeGreaterThanOrEqual(1),
    );
    expect(screen.getAllByText(/Exploit Public App/i).length).toBeGreaterThanOrEqual(1);
  });

  it('calls generateKillChain with project name and vulns', async () => {
    mockGenerateKillChain.mockResolvedValue(KILL_CHAIN_STEPS);
    render(<KillChain />);
    await waitFor(() => screen.getByRole('option', { name: 'Alpha Project' }));
    fireEvent.click(screen.getByRole('button', { name: /generate kill chain/i }));
    await waitFor(() =>
      expect(mockGenerateKillChain).toHaveBeenCalledWith('Alpha Project', expect.any(Array)),
    );
  });
});
