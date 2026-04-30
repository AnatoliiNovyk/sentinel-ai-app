import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AttackSurfaceMap from '../AttackSurfaceMap';

const { mockEq, mockVulnsEq, mockDownloadFile } = vi.hoisted(() => ({
  mockEq: vi.fn().mockResolvedValue({ data: [], error: null }),
  mockVulnsEq: vi.fn().mockResolvedValue({ data: [], error: null }),
  mockDownloadFile: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'projects') {
        return { select: () => ({ eq: mockEq }) };
      }
      return { select: () => ({ eq: mockVulnsEq }) };
    },
  },
  riskBand: vi.fn().mockReturnValue('low'),
}));

vi.mock('../../lib/exporters', () => ({
  downloadFile: (...args: unknown[]) => mockDownloadFile(...args),
}));

vi.mock('../../context/useAuth', () => {
  const _user = { id: 'user-1' };
  return { useAuth: () => ({ user: _user }) };
});

vi.mock('../../lib/riskScore', () => ({
  riskBand: vi.fn().mockReturnValue('low'),
}));

// Prevent requestAnimationFrame loop from running indefinitely in tests
const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 0);
vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});

describe('AttackSurfaceMap', () => {
  beforeEach(() => {
    mockEq.mockResolvedValue({ data: [], error: null });
    mockVulnsEq.mockResolvedValue({ data: [], error: null });
    rafSpy.mockImplementation(() => 0);
  });

  it('renders "Attack Surface Map" heading', async () => {
    render(<AttackSurfaceMap />);
    await waitFor(() => expect(screen.getByText('Attack Surface Map')).toBeInTheDocument());
  });

  it('renders description text', async () => {
    render(<AttackSurfaceMap />);
    await waitFor(() =>
      expect(screen.getByText(/Interactive visualization of your infrastructure/i)).toBeInTheDocument(),
    );
  });

  it('renders "Re-layout" button', async () => {
    render(<AttackSurfaceMap />);
    await waitFor(() => expect(screen.getByRole('button', { name: /re-layout/i })).toBeInTheDocument());
  });

  it('renders stat card "Projects"', async () => {
    render(<AttackSurfaceMap />);
    await waitFor(() => {
      expect(screen.getAllByText('Projects').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders stat card "Open Findings"', async () => {
    render(<AttackSurfaceMap />);
    await waitFor(() => expect(screen.getByText('Open Findings')).toBeInTheDocument());
  });

  it('renders stat card "Critical"', async () => {
    render(<AttackSurfaceMap />);
    await waitFor(() => expect(screen.getByText('Critical')).toBeInTheDocument());
  });

  it('renders stat card "High"', async () => {
    render(<AttackSurfaceMap />);
    await waitFor(() => expect(screen.getByText('High')).toBeInTheDocument());
  });

  it('renders zero value for all stats when no data', async () => {
    render(<AttackSurfaceMap />);
    await waitFor(() => {
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThanOrEqual(4);
    });
  });

  it('renders project nodes when projects are loaded', async () => {
    mockEq.mockResolvedValue({
      data: [{ id: 'p-1', name: 'Alpha', risk_score: 50 }],
      error: null,
    });
    render(<AttackSurfaceMap />);
    await waitFor(() =>
      expect(screen.getAllByText('Alpha').length).toBeGreaterThanOrEqual(1),
    );
  });

  it('clicking "Re-layout" does not throw', async () => {
    render(<AttackSurfaceMap />);
    await waitFor(() => screen.getByRole('button', { name: /re-layout/i }));
    fireEvent.click(screen.getByRole('button', { name: /re-layout/i }));
    expect(screen.getByText('Attack Surface Map')).toBeInTheDocument();
  });
});

/** Wait until the loading spinner disappears */
const waitForLoaded = () =>
  waitFor(() => expect(screen.queryByText(/Building attack surface map/i)).not.toBeInTheDocument());

describe('AttackSurfaceMap — stats with data', () => {
  beforeEach(() => {
    mockEq.mockResolvedValue({
      data: [
        { id: 'p-1', name: 'Alpha', risk_score: 80 },
        { id: 'p-2', name: 'Beta',  risk_score: 30 },
      ],
      error: null,
    });
    mockVulnsEq.mockResolvedValue({
      data: [
        { id: 'v-1', title: 'SQLi',     severity: 'critical', status: 'open',     asset: 'api.example.com',     scan_id: 's-1', user_id: 'user-1' },
        { id: 'v-2', title: 'XSS',      severity: 'high',     status: 'open',     asset: 'web.example.com',     scan_id: 's-1', user_id: 'user-1' },
        { id: 'v-3', title: 'SSRF',     severity: 'medium',   status: 'open',     asset: 'api.example.com',     scan_id: 's-2', user_id: 'user-1' },
        { id: 'v-4', title: 'Old CVE',  severity: 'critical', status: 'resolved', asset: 'legacy.example.com',  scan_id: 's-2', user_id: 'user-1' },
      ],
      error: null,
    });
    rafSpy.mockImplementation(() => 0);
  });

  it('shows correct critical count (excludes resolved)', async () => {
    render(<AttackSurfaceMap />);
    await waitForLoaded();
    // 1 critical open (v-1); v-4 resolved so excluded
    expect(screen.getByText('Critical').nextElementSibling?.textContent).toBe('1');
  });

  it('shows correct high count', async () => {
    render(<AttackSurfaceMap />);
    await waitForLoaded();
    expect(screen.getByText('High').nextElementSibling?.textContent).toBe('1');
  });

  it('shows correct Medium count stat', async () => {
    render(<AttackSurfaceMap />);
    await waitForLoaded();
    expect(screen.getByText('Medium').nextElementSibling?.textContent).toBe('1');
  });

  it('shows correct Exposed Assets count (unique non-resolved assets)', async () => {
    render(<AttackSurfaceMap />);
    await waitForLoaded();
    // open assets: api.example.com (v-1, v-3), web.example.com (v-2) = 2 unique
    expect(screen.getByText('Exposed Assets').nextElementSibling?.textContent).toBe('2');
  });
});

describe('AttackSurfaceMap — search filter', () => {
  beforeEach(() => {
    mockEq.mockResolvedValue({
      data: [{ id: 'p-1', name: 'AlphaProject', risk_score: 50 }],
      error: null,
    });
    mockVulnsEq.mockResolvedValue({ data: [], error: null });
    rafSpy.mockImplementation(() => 0);
  });

  it('search input is present', async () => {
    render(<AttackSurfaceMap />);
    await waitForLoaded();
    expect(screen.getByPlaceholderText('Search nodes...')).toBeInTheDocument();
  });

  it('typing in search shows visible badge', async () => {
    render(<AttackSurfaceMap />);
    await waitForLoaded();
    fireEvent.change(screen.getByPlaceholderText('Search nodes...'), { target: { value: 'xyz-not-found' } });
    await waitFor(() => expect(screen.getByText(/visible/i)).toBeInTheDocument());
  });
});

describe('AttackSurfaceMap — node filter buttons', () => {
  beforeEach(() => {
    mockEq.mockResolvedValue({
      data: [{ id: 'p-1', name: 'BetaProject', risk_score: 20 }],
      error: null,
    });
    mockVulnsEq.mockResolvedValue({ data: [], error: null });
    rafSpy.mockImplementation(() => 0);
  });

  it('renders "All nodes" and "Findings" filter buttons', async () => {
    render(<AttackSurfaceMap />);
    await waitForLoaded();
    expect(screen.getByText(/All nodes/i)).toBeInTheDocument();
    const filterBtns = screen.getAllByRole('button');
    expect(filterBtns.some(b => b.textContent?.includes('Findings'))).toBe(true);
  });

  it('clicking "Projects" filter does not throw', async () => {
    render(<AttackSurfaceMap />);
    await waitForLoaded();
    const projectsFilterBtn = screen.getAllByRole('button').find(b => /^Projects/.test(b.textContent ?? ''));
    expect(projectsFilterBtn).toBeDefined();
    fireEvent.click(projectsFilterBtn!);
    expect(screen.getByText('Attack Surface Map')).toBeInTheDocument();
  });

  it('clicking "Findings" filter shows visible badge (no vuln nodes)', async () => {
    render(<AttackSurfaceMap />);
    await waitForLoaded();
    const findingsBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Findings'));
    fireEvent.click(findingsBtn!);
    await waitFor(() => expect(screen.getByText(/visible/i)).toBeInTheDocument());
  });
});

describe('AttackSurfaceMap — export buttons', () => {
  beforeEach(() => {
    mockEq.mockResolvedValue({
      data: [{ id: 'p-1', name: 'GammaProject', risk_score: 60 }],
      error: null,
    });
    mockVulnsEq.mockResolvedValue({ data: [], error: null });
    rafSpy.mockImplementation(() => 0);
    mockDownloadFile.mockClear();
  });

  it('shows CSV and JSON export buttons when nodes > 1', async () => {
    render(<AttackSurfaceMap />);
    await waitForLoaded();
    expect(screen.getByRole('button', { name: /csv/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /json/i })).toBeInTheDocument();
  });

  it('clicking CSV calls downloadFile with .csv extension', async () => {
    render(<AttackSurfaceMap />);
    await waitForLoaded();
    fireEvent.click(screen.getByRole('button', { name: /csv/i }));
    expect(mockDownloadFile).toHaveBeenCalledWith(
      expect.stringMatching(/\.csv$/),
      expect.any(String),
      'text/csv',
    );
  });

  it('clicking JSON calls downloadFile with .json extension', async () => {
    render(<AttackSurfaceMap />);
    await waitForLoaded();
    fireEvent.click(screen.getByRole('button', { name: /json/i }));
    expect(mockDownloadFile).toHaveBeenCalledWith(
      expect.stringMatching(/\.json$/),
      expect.any(String),
      'application/json',
    );
  });
});

describe('AttackSurfaceMap — severity filter', () => {
  beforeEach(() => {
    mockEq.mockResolvedValue({
      data: [{ id: 'p-1', name: 'DeltaProj', risk_score: 55 }],
      error: null,
    });
    mockVulnsEq.mockResolvedValue({
      data: [
        { id: 'v-1', title: 'SQLi', severity: 'critical', status: 'open', asset: 'host.example.com', scan_id: 's-1', user_id: 'user-1' },
      ],
      error: null,
    });
    rafSpy.mockImplementation(() => 0);
  });

  it('renders severity filter buttons', async () => {
    render(<AttackSurfaceMap />);
    await waitForLoaded();
    const allSevBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('All sev'));
    expect(allSevBtn).toBeDefined();
  });

  it('clicking severity "critical" filter does not throw', async () => {
    render(<AttackSurfaceMap />);
    await waitForLoaded();
    const critBtn = screen.getAllByRole('button').find(b => b.textContent === 'critical');
    if (critBtn) fireEvent.click(critBtn);
    expect(screen.getByText('Attack Surface Map')).toBeInTheDocument();
  });
});
