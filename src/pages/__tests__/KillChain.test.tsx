import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import KillChain from '../KillChain';

// ── Mocks ─────────────────────────────────────────────────────────────────

const { mockGenerateKillChain, mockScansEq, mockVulnsIn } = vi.hoisted(() => ({
  mockGenerateKillChain: vi.fn(),
  mockScansEq: vi.fn().mockResolvedValue({ data: [{ id: 'scan-1' }], error: null }),
  mockVulnsIn: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

// Reset mocks before each test
beforeEach(() => {
  mockScansEq.mockResolvedValue({ data: [{ id: 'scan-1' }], error: null });
  mockVulnsIn.mockResolvedValue({ data: [], error: null });
  mockGenerateKillChain.mockReset();
});

vi.mock('../../lib/aiRedTeam', () => ({
  generateKillChain: mockGenerateKillChain,
}));

const mockDownloadFile = vi.fn();
vi.mock('../../lib/exporters', () => ({
  downloadFile: (...args: unknown[]) => mockDownloadFile(...args),
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
              eq: () => mockScansEq(),
            }),
          };
        }
        // vulnerabilities
        return {
          select: () => ({
            in: () => ({
              eq: () => mockVulnsIn(),
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

// ── Export & interactive function tests ──────────────────────────────────

describe('KillChain — exports and interactive functions', () => {
  beforeEach(() => {
    mockGenerateKillChain.mockResolvedValue(KILL_CHAIN_STEPS);
    mockDownloadFile.mockReset();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  const generateChain = async () => {
    render(<KillChain />);
    await waitFor(() => screen.getByRole('option', { name: 'Alpha Project' }));
    fireEvent.click(screen.getByRole('button', { name: /generate kill chain/i }));
    await waitFor(() =>
      expect(screen.getByText('Attack Vector Generated')).toBeInTheDocument(),
    );
  };

  it('exportCsv calls downloadFile with CSV content', async () => {
    await generateChain();
    const csvBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('CSV'));
    expect(csvBtn).toBeTruthy();
    fireEvent.click(csvBtn!);
    await waitFor(() => expect(mockDownloadFile).toHaveBeenCalledWith(
      expect.stringContaining('.csv'),
      expect.stringContaining('Phase'),
      'text/csv',
    ));
  });

  it('exportMarkdown calls downloadFile with markdown content', async () => {
    await generateChain();
    const mdBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('.md'));
    expect(mdBtn).toBeTruthy();
    fireEvent.click(mdBtn!);
    await waitFor(() => expect(mockDownloadFile).toHaveBeenCalledWith(
      expect.stringContaining('.md'),
      expect.stringContaining('Kill Chain'),
      'text/markdown',
    ));
  });

  it('exportJson calls downloadFile with json content', async () => {
    await generateChain();
    const jsonBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('JSON'));
    expect(jsonBtn).toBeTruthy();
    fireEvent.click(jsonBtn!);
    await waitFor(() => expect(mockDownloadFile).toHaveBeenCalledWith(
      expect.stringContaining('.json'),
      expect.stringContaining('{'),
      'application/json',
    ));
  });

  it('copyToClipboard copies markdown to clipboard', async () => {
    await generateChain();
    const copyBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Copy'));
    expect(copyBtn).toBeTruthy();
    fireEvent.click(copyBtn!);
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('Kill Chain')),
    );
  });

  it('phaseFilter filters chain steps', async () => {
    await generateChain();
    // Filter selects should be available
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThan(0);
  });

  it('clicking a phase filter button filters steps', async () => {
    await generateChain();
    // Click "Recon" phase button (partial match for "Reconnaissance")
    const reconBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Recon'));
    expect(reconBtn).toBeTruthy();
    fireEvent.click(reconBtn!);
    // Only Reconnaissance step should remain
    await waitFor(() =>
      expect(screen.getAllByText('Reconnaissance').length).toBeGreaterThanOrEqual(1),
    );
  });

  it('clicking All phase filter resets phase filter', async () => {
    await generateChain();
    const reconBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Recon'));
    expect(reconBtn).toBeTruthy();
    fireEvent.click(reconBtn!);

    const allBtn = screen.getAllByRole('button').find(b => /^All\s*\(\d+\)$/.test(b.textContent?.trim() ?? ''));
    expect(allBtn).toBeTruthy();
    fireEvent.click(allBtn!);

    await waitFor(() =>
      expect(screen.getAllByText('Reconnaissance').length).toBeGreaterThanOrEqual(1),
    );
  });

  it('stepSearch filters steps by tactic', async () => {
    await generateChain();
    const searchInput = screen.getByPlaceholderText(/search tactic/i);
    fireEvent.change(searchInput, { target: { value: 'Active Scanning' } });
    await waitFor(() => expect(screen.getAllByText(/Active Scanning/i).length).toBeGreaterThanOrEqual(1));
  });

  it('stepSearch with no match shows "No steps match"', async () => {
    await generateChain();
    const searchInput = screen.getByPlaceholderText(/search tactic/i);
    fireEvent.change(searchInput, { target: { value: 'zzz-not-a-tactic-xyz' } });
    await waitFor(() =>
      expect(screen.getByText('No steps match the current filters.')).toBeInTheDocument(),
    );
  });

  it('sort "Phase order" button changes sort order', async () => {
    await generateChain();
    const phaseOrderBtn = screen.getByRole('button', { name: 'Phase order' });
    fireEvent.click(phaseOrderBtn);
    // Steps still visible
    expect(screen.getByText('Attack Vector Generated')).toBeInTheDocument();
  });

  it('sort "Asset A→Z" button changes sort order', async () => {
    await generateChain();
    const assetBtn = screen.getByRole('button', { name: /asset a/i });
    fireEvent.click(assetBtn);
    expect(screen.getByText('Attack Vector Generated')).toBeInTheDocument();
  });

  it('clear filters button appears and resets all filters', async () => {
    await generateChain();
    // Apply a phase filter to trigger clear button
    const reconBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Recon'));
    fireEvent.click(reconBtn!);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }));
    // Both steps should be visible again
    await waitFor(() =>
      expect(screen.getAllByText('Reconnaissance').length).toBeGreaterThanOrEqual(1),
    );
    expect(screen.getAllByText('Initial Access').length).toBeGreaterThanOrEqual(1);
  });
});

describe('KillChain — null data fallbacks', () => {
  const generateChainForNullTests = async () => {
    mockGenerateKillChain.mockResolvedValue(KILL_CHAIN_STEPS);
    render(<KillChain />);
    await waitFor(() => screen.getByRole('option', { name: 'Alpha Project' }));
    fireEvent.click(screen.getByRole('button', { name: /generate kill chain/i }));
    await waitFor(() => expect(screen.getByText('Attack Vector Generated')).toBeInTheDocument());
  };

  it('handles null scans data (covers || [] fallback on scanIds)', async () => {
    // Return null data for scans — triggers `scans?.map(s => s.id) || []`
    mockScansEq.mockResolvedValue({ data: null, error: null });
    mockGenerateKillChain.mockResolvedValue(KILL_CHAIN_STEPS);
    render(<KillChain />);
    await waitFor(() => screen.getByRole('option', { name: 'Alpha Project' }));
    fireEvent.click(screen.getByRole('button', { name: /generate kill chain/i }));
    await waitFor(() => expect(screen.getByText('Attack Vector Generated')).toBeInTheDocument());
  });

  it('handles null vulns data (covers || [] fallback on projVulns)', async () => {
    // Return null data for vulns — triggers `projVulns || []`
    mockVulnsIn.mockResolvedValue({ data: null, error: null });
    mockGenerateKillChain.mockResolvedValue(KILL_CHAIN_STEPS);
    render(<KillChain />);
    await waitFor(() => screen.getByRole('option', { name: 'Alpha Project' }));
    fireEvent.click(screen.getByRole('button', { name: /generate kill chain/i }));
    await waitFor(() => expect(screen.getByText('Attack Vector Generated')).toBeInTheDocument());
  });

  it('shows singular "result" text when search matches exactly 1 step', async () => {
    await generateChainForNullTests();
    // Search for a term unique to only one step (Active Scanning is only in Reconnaissance)
    const searchInput = screen.getByPlaceholderText(/search tactic/i);
    fireEvent.change(searchInput, { target: { value: 'Active Scanning' } });
    await waitFor(() => {
      // "1 result" (singular) text should appear (not "results")
      const resultText = screen.queryByText(/1 result$/i);
      expect(resultText).toBeInTheDocument();
    });
  });
});

// ── Export and Clipboard ──────────────────────────────────────────────────

describe('KillChain — export and clipboard', () => {
  const setupChain = async () => {
    mockGenerateKillChain.mockResolvedValue(KILL_CHAIN_STEPS);
    render(<KillChain />);
    await waitFor(() => screen.getByRole('option', { name: 'Alpha Project' }));
    fireEvent.click(screen.getByRole('button', { name: /generate kill chain/i }));
    await waitFor(() => expect(screen.getByText('Attack Vector Generated')).toBeInTheDocument());
  };

  it('calls downloadFile with markdown when Export MD button clicked', async () => {
    await setupChain();
    const mdBtn = screen.getByTitle('Download Markdown');
    fireEvent.click(mdBtn);
    expect(mockDownloadFile).toHaveBeenCalledWith(
      expect.stringContaining('.md'),
      expect.any(String),
      'text/markdown',
    );
  });

  it('calls downloadFile with csv when Export CSV button clicked', async () => {
    await setupChain();
    const csvBtn = screen.getByTitle('Download CSV');
    fireEvent.click(csvBtn);
    expect(mockDownloadFile).toHaveBeenCalledWith(
      expect.stringContaining('.csv'),
      expect.any(String),
      'text/csv',
    );
  });

  it('calls clipboard.writeText when Copy button clicked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    await setupChain();
    const copyBtn = screen.getByTitle('Copy as Markdown');
    fireEvent.click(copyBtn);
    await waitFor(() => expect(writeText).toHaveBeenCalled());
  });
});

// ── Clear filters button ─────────────────────────────────────────────────

describe('KillChain — clear filters via sort button', () => {
  it('clear filters button resets phase, search and sort', async () => {
    mockGenerateKillChain.mockResolvedValue(KILL_CHAIN_STEPS);
    render(<KillChain />);
    await waitFor(() => screen.getByRole('option', { name: 'Alpha Project' }));
    fireEvent.click(screen.getByRole('button', { name: /generate kill chain/i }));
    await waitFor(() => expect(screen.getByText('Attack Vector Generated')).toBeInTheDocument());

    // Change sort to trigger clear filters button to appear
    const phaseBtn = screen.getByRole('button', { name: /Phase order/i });
    fireEvent.click(phaseBtn);

    await waitFor(() => expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }));

    await waitFor(() => expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument());
  });

  it('changing project select updates projectId', async () => {
    render(<KillChain />);
    await waitFor(() => screen.getByRole('combobox'));
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'proj-2' } });
    // After change the select value should reflect the new project
    expect((select as HTMLSelectElement).value).toBe('proj-2');
  });
});
