import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Projects from '../Projects';
import type { Project } from '../../lib/supabase';

// ── Mocks ─────────────────────────────────────────────────────────────────

const { mockOrder, mockDeleteEq, mockInsert } = vi.hoisted(() => ({
  mockOrder: vi.fn(),
  mockDeleteEq: vi.fn().mockResolvedValue({ data: null, error: null }),
  mockInsert: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

vi.mock('../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase')>();
  return {
    ...actual,
    supabase: {
      from: () => ({
        select: () => ({ order: mockOrder }),
        delete: () => ({ eq: mockDeleteEq }),
        insert: mockInsert,
      }),
    },
  };
});

vi.mock('../../context/useAuth', () => {
  // Stable references: prevents useCallback/useEffect re-firing on each render
  const _user = { id: 'user-1' };
  const _orgs = [{ id: 'org-1', name: 'Test Org' }];
  return {
    useAuth: () => ({ user: _user, organizations: _orgs }),
  };
});

// ProjectDetail renders a full page — keep it minimal
vi.mock('../ProjectDetail', () => ({
  default: ({ onBack }: { onBack: () => void }) => (
    <div>
      <button onClick={onBack}>Back</button>
      <div>ProjectDetail</div>
    </div>
  ),
}));

// ── Helpers ───────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    user_id: 'user-1',
    org_id: 'org-1',
    name: 'Alpha Project',
    description: 'First test project',
    target: 'example.com',
    environment: 'external',
    created_at: '2026-01-01T00:00:00Z',
    tags: [],
    risk_score: 0,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Projects — empty state', () => {
  beforeEach(() => {
    mockOrder.mockResolvedValue({ data: [], error: null });
  });

  it('renders "Projects" heading', async () => {
    render(<Projects />);
    expect(screen.getByText('Projects')).toBeInTheDocument();
  });

  it('shows "No projects yet" empty state', async () => {
    render(<Projects />);
    await waitFor(() =>
      expect(screen.getByText('No projects yet')).toBeInTheDocument(),
    );
  });

  it('shows "New project" button', () => {
    render(<Projects />);
    expect(screen.getAllByText('New project').length).toBeGreaterThanOrEqual(1);
  });
});

describe('Projects — with projects', () => {
  beforeEach(() => {
    mockOrder.mockResolvedValue({ data: [makeProject()], error: null });
  });

  it('renders project cards', async () => {
    render(<Projects />);
    await waitFor(() => expect(screen.getByText('Alpha Project')).toBeInTheDocument());
  });

  it('renders environment badge', async () => {
    mockOrder.mockResolvedValue({
      data: [makeProject({ environment: 'cloud' })],
      error: null,
    });
    render(<Projects />);
    const matches = await screen.findAllByText(/cloud/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('renders target address on card', async () => {
    mockOrder.mockResolvedValue({
      data: [makeProject({ target: 'api.example.com' })],
      error: null,
    });
    render(<Projects />);
    await waitFor(() => expect(screen.getByText('api.example.com')).toBeInTheDocument());
  });

  it('navigates to ProjectDetail when card clicked', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByText('Alpha Project'));
    fireEvent.click(screen.getByText('Alpha Project'));
    expect(screen.getByText('ProjectDetail')).toBeInTheDocument();
  });

  it('returns to list when Back is clicked in ProjectDetail', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByText('Alpha Project'));
    fireEvent.click(screen.getByText('Alpha Project'));
    // After back: load() is called again — still returns the same project
    fireEvent.click(screen.getByText('Back'));
    await waitFor(() => expect(screen.getByText('Alpha Project')).toBeInTheDocument());
  });
});

describe('Projects — delete', () => {
  it.skip('calls supabase delete when Delete button clicked', async () => {
    // First load returns project; subsequent calls return empty
    mockOrder
      .mockResolvedValueOnce({ data: [makeProject()], error: null })
      .mockResolvedValue({ data: [], error: null });
    render(<Projects />);
    await waitFor(() => screen.getByText('Alpha Project'));
    const deleteBtn = screen.getByLabelText('Delete project');
    fireEvent.click(deleteBtn);

    const confirmBtn = await screen.findByRole('button', { name: /^delete project$/i });
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(mockDeleteEq).toHaveBeenCalledWith('id', 'proj-1'));
  });
});

describe('Projects — new project modal', () => {
  beforeEach(() => {
    mockOrder.mockResolvedValue({ data: [], error: null });
  });

  it('opens modal when "New project" button clicked', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByText('No projects yet'));
    // Click the first "New project" button
    fireEvent.click(screen.getAllByText('New project')[0]);
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /new project/i }),
      ).toBeInTheDocument(),
    );
  });
});
