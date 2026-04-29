import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import Vulnerabilities from '../Vulnerabilities';

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../context/useAuth', () => {
  const _user = { id: 'user-1' };
  return { useAuth: () => ({ user: _user }) };
});

vi.mock('../../lib/exporters', () => ({
  downloadFile: vi.fn(),
}));

const { mockVulnsOrder, mockProjectsEq, mockScansEq, mockChannel, mockRemoveChannel } = vi.hoisted(() => ({
  mockVulnsOrder:    vi.fn().mockResolvedValue({ data: [], error: null }),
  mockProjectsEq:    vi.fn().mockResolvedValue({ data: [], error: null }),
  mockScansEq:       vi.fn().mockResolvedValue({ data: [], error: null }),
  mockChannel:       vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
  mockRemoveChannel: vi.fn(),
}));

vi.mock('../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase')>();
  return {
    ...actual,
    supabase: {
      from: (table: string) => {
        if (table === 'projects') return { select: () => ({ eq: mockProjectsEq }) };
        if (table === 'scans')    return { select: () => ({ eq: mockScansEq }) };
        // vulnerabilities: fetch + update/delete
        return {
          select: () => ({
            eq: () => ({
              order: mockVulnsOrder,
            }),
          }),
          update: () => ({
            in: vi.fn().mockResolvedValue({ data: null, error: null }),
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
          delete: () => ({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      },
      channel: mockChannel,
      removeChannel: mockRemoveChannel,
    },
  };
});

// ── Fixtures ──────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();

const MOCK_PROJECTS = [
  { id: 'proj-1', user_id: 'user-1', org_id: 'org-1', name: 'Alpha Project',
    description: '', target: 'example.com', environment: 'external',
    created_at: NOW, tags: [], risk_score: 0 },
];

const MOCK_VULNS = [
  {
    id: 'v-1', user_id: 'user-1', project_id: 'proj-1', scan_id: 'scan-1',
    title: 'SQL Injection', severity: 'critical', status: 'open',
    cve_id: 'CVE-2023-1234', cvss: 9.8, asset: 'api.example.com',
    description: 'SQL injection in login form',
    recommendation: 'Use parameterized queries',
    sla_breached_at: null, sla_warned_at: null, created_at: NOW,
  },
  {
    id: 'v-2', user_id: 'user-1', project_id: 'proj-1', scan_id: 'scan-1',
    title: 'XSS Reflected', severity: 'high', status: 'open',
    cve_id: null, cvss: 7.2, asset: 'web.example.com',
    description: 'Reflected XSS in search field',
    recommendation: 'Sanitize inputs',
    sla_breached_at: NOW, sla_warned_at: null, created_at: NOW,
  },
];

function setupMocks(vulns = MOCK_VULNS) {
  mockVulnsOrder.mockResolvedValue({ data: vulns, error: null });
  mockProjectsEq.mockResolvedValue({ data: MOCK_PROJECTS, error: null });
  mockScansEq.mockResolvedValue({ data: [], error: null });
}

beforeEach(() => {
  setupMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Vulnerabilities — layout', () => {
  it('renders "Vulnerabilities" heading', async () => {
    render(<Vulnerabilities />);
    expect(await screen.findByText('Vulnerabilities')).toBeInTheDocument();
  });

  it('renders stat cards Total, Critical, High, Medium, Open, SLA breached', async () => {
    render(<Vulnerabilities />);
    expect(await screen.findByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getAllByText('Open').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('SLA breached').length).toBeGreaterThanOrEqual(1);
  });
});

describe('Vulnerabilities — entries', () => {
  it('renders vulnerability titles from supabase', async () => {
    render(<Vulnerabilities />);
    expect(await screen.findByText('SQL Injection')).toBeInTheDocument();
    expect(screen.getByText('XSS Reflected')).toBeInTheDocument();
  });

  it('displays stat counts matching loaded data', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    // 1 critical + 1 high, total 2, 2 open
    const totalCard = screen.getByText('Total').closest('button')!;
    expect(totalCard).toHaveTextContent('2');
  });

  it('shows empty state "No vulnerabilities found" when no data', async () => {
    mockVulnsOrder.mockResolvedValue({ data: [], error: null });
    render(<Vulnerabilities />);
    expect(await screen.findByText('No vulnerabilities found')).toBeInTheDocument();
  });
});

describe('Vulnerabilities — filters', () => {
  it('clicking Critical stat card filters to critical vulns only', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    // Click Critical filter button
    fireEvent.click(screen.getByText('Critical').closest('button')!);
    // XSS (high) should be hidden; SQL Injection (critical) should remain
    expect(screen.queryByText('XSS Reflected')).not.toBeInTheDocument();
    expect(screen.getByText('SQL Injection')).toBeInTheDocument();
  });

  it('shows "No vulnerabilities match the filters" when filter yields no results', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    // Click Medium stat card — no medium vulns in mock
    fireEvent.click(screen.getByText('Medium').closest('button')!);
    expect(await screen.findByText('No vulnerabilities match the filters')).toBeInTheDocument();
  });
});

describe('Vulnerabilities — bulk actions', () => {
  it('shows BulkBar Resolve/Accept risk/False positive when an item is selected', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    // Click the select checkbox of first vuln row (CheckSquare icon button)
    const checkboxes = screen.getAllByRole('button', { name: 'Select' });
    fireEvent.click(checkboxes[0]);
    expect(await screen.findByText('Resolve')).toBeInTheDocument();
    expect(screen.getByText('Accept risk')).toBeInTheDocument();
    expect(screen.getByText('False positive')).toBeInTheDocument();
  });
});
