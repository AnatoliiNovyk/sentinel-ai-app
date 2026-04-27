import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Reports from '../Reports';
import type { Project, Report } from '../../lib/supabase';

// ── Mocks ─────────────────────────────────────────────────────────────────

const { mockReportsOrder, mockProjectsEq, mockUpdateEq } = vi.hoisted(() => ({
  mockReportsOrder: vi.fn().mockResolvedValue({ data: [], error: null }),
  mockProjectsEq: vi.fn().mockResolvedValue({ data: [], error: null }),
  mockUpdateEq: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

vi.mock('../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase')>();
  return {
    ...actual,
    supabase: {
      from: (table: string) => {
        if (table === 'reports') {
          return {
            select: () => ({ eq: () => ({ order: mockReportsOrder }) }),
            update: () => ({ eq: mockUpdateEq }),
          };
        }
        // projects
        return {
          select: () => ({ eq: mockProjectsEq }),
        };
      },
    },
  };
});

vi.mock('../../context/useAuth', () => {
  // Stable reference: prevents useCallback/useEffect re-firing on each render
  const _user = { id: 'user-1' };
  return {
    useAuth: () => ({ user: _user }),
  };
});

vi.mock('../../lib/reportBuilder', () => ({
  buildReport: vi.fn().mockResolvedValue('# Report\n\nContent here.'),
}));

// ── Helpers ───────────────────────────────────────────────────────────────

function makeProject(id = 'proj-1', name = 'Test Project'): Project {
  return {
    id,
    user_id: 'user-1',
    org_id: 'org-1',
    name,
    description: 'desc',
    target: 'example.com',
    environment: 'external',
    created_at: '2026-01-01T00:00:00Z',
    tags: [],
    risk_score: 0,
  };
}

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: 'report-1',
    project_id: 'proj-1',
    user_id: 'user-1',
    title: 'Q1 Security Report',
    kind: 'executive',
    content: '# Report\n\nContent.',
    created_at: '2026-04-01T00:00:00Z',
    share_token: null,
    is_public: false,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Reports — empty state', () => {
  beforeEach(() => {
    mockReportsOrder.mockResolvedValue({ data: [], error: null });
    mockProjectsEq.mockResolvedValue({ data: [], error: null });
  });

  it('renders "Reports" heading', () => {
    render(<Reports />);
    expect(screen.getByText('Reports')).toBeInTheDocument();
  });

  it('shows empty state when no reports', async () => {
    render(<Reports />);
    await waitFor(() =>
      expect(screen.getByText('No reports yet')).toBeInTheDocument(),
    );
  });

  it('"Generate report" button is disabled when no projects', async () => {
    render(<Reports />);
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /generate report/i });
      expect(btn).toBeDisabled();
    });
  });
});

describe('Reports — with reports', () => {
  beforeEach(() => {
    mockReportsOrder.mockResolvedValue({
      data: [makeReport({ title: 'Q1 Security Report', kind: 'executive' })],
      error: null,
    });
    mockProjectsEq.mockResolvedValue({ data: [makeProject()], error: null });
  });

  it('renders report title', async () => {
    render(<Reports />);
    await waitFor(() =>
      expect(screen.getByText('Q1 Security Report')).toBeInTheDocument(),
    );
  });

  it('shows kind badge (Executive)', async () => {
    render(<Reports />);
    await waitFor(() =>
      expect(screen.getByText('Executive')).toBeInTheDocument(),
    );
  });

  it('shows project name alongside report', async () => {
    render(<Reports />);
    await waitFor(() =>
      expect(screen.getByText('Test Project')).toBeInTheDocument(),
    );
  });
});

describe('Reports — "Generate report" enabled with projects', () => {
  beforeEach(() => {
    mockReportsOrder.mockResolvedValue({ data: [], error: null });
    mockProjectsEq.mockResolvedValue({ data: [makeProject()], error: null });
  });

  it('"Generate report" is enabled when projects exist', async () => {
    render(<Reports />);
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /generate report/i });
      expect(btn).not.toBeDisabled();
    });
  });

  it('opens generate modal when button clicked', async () => {
    render(<Reports />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /generate report/i })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: /generate report/i }));
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /generate.*report|new.*report/i }),
      ).toBeInTheDocument(),
    );
  });
});
