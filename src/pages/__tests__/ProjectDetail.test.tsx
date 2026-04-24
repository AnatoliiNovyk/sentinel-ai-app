import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProjectDetail from '../ProjectDetail';
import type { Project } from '../../lib/supabase';

const { mockNotifsLimit, mockVulnsIn } = vi.hoisted(() => ({
  mockNotifsLimit: vi.fn().mockResolvedValue({ data: [], error: null }),
  mockVulnsIn: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'scans') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === 'reports') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === 'notifications') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: mockNotifsLimit,
              }),
            }),
          }),
        };
      }
      if (table === 'vulnerabilities') {
        return {
          select: () => ({
            in: () => mockVulnsIn(),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      };
    },
  },
}));

vi.mock('../../context/useAuth', () => {
  const _user = { id: 'user-1' };
  return { useAuth: () => ({ user: _user }) };
});

vi.mock('../../lib/scanDispatch', () => ({
  dispatchScan: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('../../lib/reportBuilder', () => ({
  buildReport: vi.fn().mockReturnValue('# Report content'),
}));

vi.mock('../../lib/exporters', () => ({
  toJsonExport: vi.fn().mockReturnValue('{}'),
  downloadFile: vi.fn(),
}));

vi.mock('../../components/FindingsTab', () => ({
  default: () => <div>FindingsTab</div>,
}));

vi.mock('../../components/AssetGraph', () => ({
  default: () => <div>AssetGraph</div>,
}));

vi.mock('../../components/ReportViewer', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div>
      ReportViewer
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../../components/ScanDiff', () => ({
  default: () => <div>ScanDiff</div>,
}));

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    user_id: 'user-1',
    org_id: 'org-1',
    name: 'Beta Project',
    description: 'Test project description',
    target: 'example.com',
    environment: 'external',
    created_at: '2026-01-01T00:00:00Z',
    tags: [],
    risk_score: 0,
    ...overrides,
  };
}

describe('ProjectDetail', () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    mockOnBack.mockReset();
  });

  it('renders project name as heading', async () => {
    render(<ProjectDetail project={makeProject()} onBack={mockOnBack} />);
    await waitFor(() => expect(screen.getByText('Beta Project')).toBeInTheDocument());
  });

  it('renders "Back to projects" button', () => {
    render(<ProjectDetail project={makeProject()} onBack={mockOnBack} />);
    expect(screen.getByText(/Back to projects/i)).toBeInTheDocument();
  });

  it('calls onBack when "Back to projects" is clicked', () => {
    render(<ProjectDetail project={makeProject()} onBack={mockOnBack} />);
    fireEvent.click(screen.getByText(/Back to projects/i));
    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it('renders environment badge "External"', async () => {
    render(<ProjectDetail project={makeProject({ environment: 'external' })} onBack={mockOnBack} />);
    await waitFor(() => expect(screen.getByText('External')).toBeInTheDocument());
  });

  it('renders "Cloud" environment badge for cloud project', async () => {
    render(<ProjectDetail project={makeProject({ environment: 'cloud' })} onBack={mockOnBack} />);
    await waitFor(() => expect(screen.getByText('Cloud')).toBeInTheDocument());
  });

  it('renders "Run scan" button', async () => {
    render(<ProjectDetail project={makeProject()} onBack={mockOnBack} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Run scan/i })).toBeInTheDocument(),
    );
  });

  it('renders tab navigation: overview, topology, findings, scans, reports, activity', async () => {
    render(<ProjectDetail project={makeProject()} onBack={mockOnBack} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'overview' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'findings' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'scans' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'reports' })).toBeInTheDocument();
    });
  });

  it('switches to findings tab when "findings" clicked', async () => {
    render(<ProjectDetail project={makeProject()} onBack={mockOnBack} />);
    await waitFor(() => screen.getByRole('button', { name: 'findings' }));
    fireEvent.click(screen.getByRole('button', { name: 'findings' }));
    expect(screen.getByText('FindingsTab')).toBeInTheDocument();
  });

  it('renders project description', async () => {
    render(<ProjectDetail project={makeProject()} onBack={mockOnBack} />);
    await waitFor(() =>
      expect(screen.getByText('Test project description')).toBeInTheDocument(),
    );
  });
});
