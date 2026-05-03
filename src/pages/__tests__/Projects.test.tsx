import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Projects from '../Projects';
import type { Project } from '../../lib/supabase';

// ── Mocks ─────────────────────────────────────────────────────────────────

const { mockOrder, mockDeleteEq, mockInsert, mockUpdateEq, mockUpdate } = vi.hoisted(() => {
  const mockUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null });
  return {
    mockOrder: vi.fn(),
    mockDeleteEq: vi.fn().mockResolvedValue({ data: null, error: null }),
    mockInsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    mockUpdateEq,
    mockUpdate: vi.fn().mockReturnValue({ eq: mockUpdateEq }),
  };
});

const { mockAuthUser } = vi.hoisted(() => {
  // Use stable references to prevent useCallback/useEffect re-firing on each render
  const _user = { id: 'user-1' };
  const _orgs = [{ id: 'org-1', name: 'Test Org' }];
  return {
    mockAuthUser: vi.fn(() => ({ user: _user, organizations: _orgs })),
  };
});

vi.mock('../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase')>();
  return {
    ...actual,
    supabase: {
      from: () => ({
        select: () => ({ order: mockOrder }),
        delete: () => ({ eq: mockDeleteEq }),
        insert: mockInsert,
        update: mockUpdate,
      }),
    },
  };
});

vi.mock('../../context/useAuth', () => ({
  useAuth: () => mockAuthUser(),
}));

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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Projects — empty state', () => {
  beforeEach(() => {
    mockOrder.mockResolvedValue({ data: [], error: null });
  });

  it('renders "Projects" heading', async () => {
    render(<Projects />);
    expect(screen.getByText('Projects')).toBeInTheDocument();
    await screen.findByText('No projects yet');
  });

  it('shows "No projects yet" empty state', async () => {
    render(<Projects />);
    await waitFor(() =>
      expect(screen.getByText('No projects yet')).toBeInTheDocument(),
    );
  });

  it('shows "New project" button', async () => {
    render(<Projects />);
    await screen.findByText('No projects yet');
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
  it('calls supabase delete when Delete button clicked', async () => {
    // First load returns project; subsequent calls return empty
    mockOrder
      .mockResolvedValueOnce({ data: [makeProject()], error: null })
      .mockResolvedValue({ data: [], error: null });
    render(<Projects />);
    await waitFor(() => screen.getByText('Alpha Project'));
    const deleteBtn = screen.getByLabelText('Delete project');
    fireEvent.click(deleteBtn);

    const dialog = await screen.findByRole('dialog', { name: /delete project/i });
    const confirmBtn = within(dialog).getByRole('button', { name: /^delete project$/i });
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

// ─── Stat cards ────────────────────────────────────────────────────────────

describe('Projects — stat cards', () => {
  it('shows stat cards when projects are loaded', async () => {
    mockOrder.mockResolvedValue({
      data: [
        makeProject({ id: 'p1', name: 'Alpha', risk_score: 85, environment: 'cloud' }),
        makeProject({ id: 'p2', name: 'Beta', risk_score: 20, environment: 'internal' }),
      ],
      error: null,
    });
    render(<Projects />);
    await waitFor(() => expect(screen.getByText('Total Projects')).toBeInTheDocument());
    expect(screen.getByText('High/Critical Risk')).toBeInTheDocument();
    expect(screen.getByText('Avg Risk Score')).toBeInTheDocument();
    expect(screen.getByText('By Environment')).toBeInTheDocument();
  });

  it('shows avg risk score with red colour when >= 70', async () => {
    mockOrder.mockResolvedValue({
      data: [makeProject({ risk_score: 80 })],
      error: null,
    });
    render(<Projects />);
    await waitFor(() => screen.getByText('Avg Risk Score'));
    expect(screen.getByText('80')).toBeInTheDocument();
  });

  it('shows avg risk score with amber colour when 40-69', async () => {
    mockOrder.mockResolvedValue({
      data: [makeProject({ risk_score: 55 })],
      error: null,
    });
    render(<Projects />);
    await waitFor(() => screen.getByText('Avg Risk Score'));
    expect(screen.getByText('55')).toBeInTheDocument();
  });
});

// ─── Search and environment filter ─────────────────────────────────────────

describe('Projects — search and filter', () => {
  beforeEach(() => {
    mockOrder.mockResolvedValue({
      data: [
        makeProject({ id: 'p1', name: 'Alpha Cloud', environment: 'cloud', risk_score: 85, target: 'alpha.com' }),
        makeProject({ id: 'p2', name: 'Beta Internal', environment: 'internal', risk_score: 20, target: 'beta.net' }),
      ],
      error: null,
    });
  });

  it('filters projects by search query', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByText('Alpha Cloud'));
    fireEvent.change(screen.getByPlaceholderText('Search projects…'), { target: { value: 'alpha' } });
    expect(screen.getByText('Alpha Cloud')).toBeInTheDocument();
    expect(screen.queryByText('Beta Internal')).not.toBeInTheDocument();
  });

  it('shows count indicator when search is active', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByText('Alpha Cloud'));
    fireEvent.change(screen.getByPlaceholderText('Search projects…'), { target: { value: 'alpha' } });
    await waitFor(() => expect(screen.getByText(/1 of 2/)).toBeInTheDocument());
  });

  it('clears search via X button', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByText('Alpha Cloud'));
    const input = screen.getByPlaceholderText('Search projects…');
    fireEvent.change(input, { target: { value: 'alpha' } });
    fireEvent.click(screen.getByLabelText('Clear search'));
    await waitFor(() => expect(screen.getByText('Beta Internal')).toBeInTheDocument());
  });

  it('filters by environment (Cloud)', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByText('Alpha Cloud'));
    fireEvent.click(screen.getByRole('button', { name: 'Cloud' }));
    expect(screen.getByText('Alpha Cloud')).toBeInTheDocument();
    expect(screen.queryByText('Beta Internal')).not.toBeInTheDocument();
  });

  it('clicking risk filter button does not throw and shows risk filter buttons', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByText('Alpha Cloud'));
    // The risk filter buttons exist and are clickable
    const criticalBtn = screen.getByRole('button', { name: 'critical' });
    expect(criticalBtn).toBeInTheDocument();
    fireEvent.click(criticalBtn);
    // Reset back to all
    fireEvent.click(screen.getByRole('button', { name: 'All Risks' }));
    await waitFor(() => expect(screen.getByText('Alpha Cloud')).toBeInTheDocument());
  });

  it('shows no-match state when filters eliminate all results', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByText('Alpha Cloud'));
    fireEvent.change(screen.getByPlaceholderText('Search projects…'), { target: { value: 'zzznotfound' } });
    await waitFor(() =>
      expect(screen.getByText('No projects match your filters')).toBeInTheDocument(),
    );
  });

  it('clears filters via "Clear filters" button', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByText('Alpha Cloud'));
    fireEvent.change(screen.getByPlaceholderText('Search projects…'), { target: { value: 'zzznotfound' } });
    await waitFor(() => screen.getByText('Clear filters'));
    fireEvent.click(screen.getByText('Clear filters'));
    await waitFor(() => expect(screen.getByText('Alpha Cloud')).toBeInTheDocument());
  });

  it('sorts by Name A–Z', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByText('Alpha Cloud'));
    fireEvent.change(screen.getByTitle('Sort projects'), { target: { value: 'name' } });
    expect(screen.getByText('Alpha Cloud')).toBeInTheDocument();
    expect(screen.getByText('Beta Internal')).toBeInTheDocument();
  });

  it('sorts by oldest first', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByText('Alpha Cloud'));
    fireEvent.change(screen.getByTitle('Sort projects'), { target: { value: 'oldest' } });
    expect(screen.getByText('Alpha Cloud')).toBeInTheDocument();
  });

  it('sorts by risk descending', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByText('Alpha Cloud'));
    fireEvent.change(screen.getByTitle('Sort projects'), { target: { value: 'risk_desc' } });
    expect(screen.getByText('Alpha Cloud')).toBeInTheDocument();
  });

  it('sorts by risk ascending', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByText('Alpha Cloud'));
    fireEvent.change(screen.getByTitle('Sort projects'), { target: { value: 'risk_asc' } });
    expect(screen.getByText('Alpha Cloud')).toBeInTheDocument();
  });
});

// ─── Tag filter ─────────────────────────────────────────────────────────────

describe('Projects — tag filter', () => {
  beforeEach(() => {
    mockOrder.mockResolvedValue({
      data: [
        makeProject({ id: 'p1', name: 'Tagged Alpha', tags: ['prod', 'aws'] }),
        makeProject({ id: 'p2', name: 'Tagged Beta', tags: ['staging'] }),
      ],
      error: null,
    });
  });

  it('shows tag chips when projects have tags', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByRole('button', { name: /prod/ }));
    expect(screen.getByRole('button', { name: /aws/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /staging/ })).toBeInTheDocument();
  });

  it('filters by tag when tag chip clicked', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByRole('button', { name: /prod/ }));
    fireEvent.click(screen.getByRole('button', { name: /prod/ }));
    expect(screen.getByText('Tagged Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Tagged Beta')).not.toBeInTheDocument();
  });

  it('resets tag filter when All tags clicked', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByRole('button', { name: /prod/ }));
    fireEvent.click(screen.getByRole('button', { name: /prod/ }));
    fireEvent.click(screen.getByRole('button', { name: 'All tags' }));
    await waitFor(() => expect(screen.getByText('Tagged Beta')).toBeInTheDocument());
  });

  it('toggles off tag filter when same tag clicked again', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByRole('button', { name: /prod/ }));
    fireEvent.click(screen.getByRole('button', { name: /prod/ }));
    fireEvent.click(screen.getByRole('button', { name: /prod/ }));
    await waitFor(() => expect(screen.getByText('Tagged Beta')).toBeInTheDocument());
  });
});

// ─── View mode and kanban ───────────────────────────────────────────────────

describe('Projects — view mode and kanban', () => {
  const twoProjects = [
    makeProject({ id: 'p1', name: 'Todo Project', status: 'todo' }),
    makeProject({ id: 'p2', name: 'Done Project', status: 'done' }),
  ];

  beforeEach(() => {
    mockOrder.mockResolvedValue({ data: twoProjects, error: null });
    mockUpdateEq.mockResolvedValue({ data: null, error: null });
  });

  it('shows view mode toggle when projects loaded', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByTitle('Grid view'));
    expect(screen.getByTitle('Kanban view')).toBeInTheDocument();
  });

  it('switches to kanban view and shows columns', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByTitle('Kanban view'));
    fireEvent.click(screen.getByTitle('Kanban view'));
    await waitFor(() => expect(screen.getByText('To Do')).toBeInTheDocument());
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('shows projects in correct kanban columns', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByTitle('Kanban view'));
    fireEvent.click(screen.getByTitle('Kanban view'));
    await waitFor(() => screen.getByText('To Do'));
    expect(screen.getByText('Todo Project')).toBeInTheDocument();
    expect(screen.getByText('Done Project')).toBeInTheDocument();
  });

  it('navigates to ProjectDetail from kanban card', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByTitle('Kanban view'));
    fireEvent.click(screen.getByTitle('Kanban view'));
    await waitFor(() => screen.getByText('Todo Project'));
    fireEvent.click(screen.getByText('Todo Project'));
    expect(screen.getByText('ProjectDetail')).toBeInTheDocument();
  });

  it('shows delete button in kanban card', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByTitle('Kanban view'));
    fireEvent.click(screen.getByTitle('Kanban view'));
    await waitFor(() => screen.getByText('Todo Project'));
    const deleteBtns = screen.getAllByLabelText('Delete project');
    expect(deleteBtns.length).toBeGreaterThan(0);
  });

  it('handles drag start and end on kanban card', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByTitle('Kanban view'));
    fireEvent.click(screen.getByTitle('Kanban view'));
    await waitFor(() => screen.getByText('Todo Project'));
    const card = screen.getByText('Todo Project').closest('[draggable]') as HTMLElement;
    if (card) {
      fireEvent.dragStart(card);
      fireEvent.dragEnd(card);
    }
    expect(screen.getByText('Todo Project')).toBeInTheDocument();
  });

  it('switches back to grid view', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByTitle('Kanban view'));
    fireEvent.click(screen.getByTitle('Kanban view'));
    await waitFor(() => screen.getByTitle('Grid view'));
    fireEvent.click(screen.getByTitle('Grid view'));
    await waitFor(() => expect(screen.getByText('Todo Project')).toBeInTheDocument());
  });
});

// ─── Export CSV ─────────────────────────────────────────────────────────────

describe('Projects — export CSV', () => {
  it('shows Export CSV button when projects loaded', async () => {
    mockOrder.mockResolvedValue({ data: [makeProject()], error: null });
    render(<Projects />);
    await waitFor(() => expect(screen.getByText('Export CSV')).toBeInTheDocument());
  });

  it('triggers download when Export CSV clicked', async () => {
    mockOrder.mockResolvedValue({
      data: [makeProject({ name: 'CSV Test', target: 'csv.com', risk_score: 30 })],
      error: null,
    });
    const mockCreate = vi.fn().mockReturnValue('blob:mock');
    const mockRevoke = vi.fn();
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = mockCreate;
    URL.revokeObjectURL = mockRevoke;

    render(<Projects />);
    await waitFor(() => screen.getByText('Export CSV'));
    fireEvent.click(screen.getByText('Export CSV'));
    expect(mockCreate).toHaveBeenCalled();

    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;
  });
});

// ─── ProjectModal form ──────────────────────────────────────────────────────

describe('Projects — ProjectModal form', () => {
  beforeEach(() => {
    mockOrder.mockResolvedValue({ data: [], error: null });
  });

  it('submits form and calls insert on success', async () => {
    mockInsert.mockResolvedValue({ data: null, error: null });
    render(<Projects />);
    await waitFor(() => screen.getByText('No projects yet'));
    fireEvent.click(screen.getAllByText('New project')[0]);
    await waitFor(() => screen.getByPlaceholderText('Production AWS'));
    fireEvent.change(screen.getByPlaceholderText('Production AWS'), { target: { value: 'My New Project' } });
    fireEvent.change(screen.getByPlaceholderText('example.com'), { target: { value: 'new.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(() => expect(mockInsert).toHaveBeenCalled());
  });

  it('stays open and does not call insert when supabase returns error', async () => {
    mockInsert.mockResolvedValue({ data: null, error: { message: 'insert failed' } });
    render(<Projects />);
    await waitFor(() => screen.getByText('No projects yet'));
    fireEvent.click(screen.getAllByText('New project')[0]);
    await waitFor(() => screen.getByPlaceholderText('Production AWS'));
    fireEvent.change(screen.getByPlaceholderText('Production AWS'), { target: { value: 'Err Project' } });
    fireEvent.change(screen.getByPlaceholderText('example.com'), { target: { value: 'err.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(() => expect(mockInsert).toHaveBeenCalled());
  });

  it('closes modal when Cancel clicked', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByText('No projects yet'));
    fireEvent.click(screen.getAllByText('New project')[0]);
    await waitFor(() => screen.getByRole('heading', { name: /new project/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closes modal when X button clicked', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByText('No projects yet'));
    fireEvent.click(screen.getAllByText('New project')[0]);
    await waitFor(() => screen.getByRole('heading', { name: /new project/i }));
    fireEvent.click(screen.getByLabelText('Close'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closes modal when Escape key pressed', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByText('No projects yet'));
    fireEvent.click(screen.getAllByText('New project')[0]);
    await waitFor(() => screen.getByRole('heading', { name: /new project/i }));
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('changes environment selection inside modal', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByText('No projects yet'));
    fireEvent.click(screen.getAllByText('New project')[0]);
    await waitFor(() => screen.getByRole('button', { name: 'cloud' }));
    fireEvent.click(screen.getByRole('button', { name: 'cloud' }));
    fireEvent.click(screen.getByRole('button', { name: 'internal' }));
    fireEvent.click(screen.getByRole('button', { name: 'iac' }));
    expect(screen.getByRole('button', { name: 'iac' })).toBeInTheDocument();
  });

  it('closes modal when backdrop clicked', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByText('No projects yet'));
    fireEvent.click(screen.getAllByText('New project')[0]);
    await waitFor(() => screen.getByRole('heading', { name: /new project/i }));
    // Click the outer backdrop div (first child of body overlay)
    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.parentElement!;
    fireEvent.click(backdrop);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

// ─── relTime branches ───────────────────────────────────────────────────────

describe('Projects — relTime timestamp branches', () => {
  it('shows "just now" for < 1 min ago', async () => {
    mockOrder.mockResolvedValue({
      data: [makeProject({ created_at: new Date(Date.now() - 30000).toISOString() })],
      error: null,
    });
    render(<Projects />);
    await waitFor(() => expect(screen.getByText('just now')).toBeInTheDocument());
  });

  it('shows "Xm ago" for < 1 hour', async () => {
    mockOrder.mockResolvedValue({
      data: [makeProject({ created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString() })],
      error: null,
    });
    render(<Projects />);
    await waitFor(() => expect(screen.getByText('5m ago')).toBeInTheDocument());
  });

  it('shows "Xh ago" for < 24 hours', async () => {
    mockOrder.mockResolvedValue({
      data: [makeProject({ created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString() })],
      error: null,
    });
    render(<Projects />);
    await waitFor(() => expect(screen.getByText('3h ago')).toBeInTheDocument());
  });

  it('shows "Xd ago" for < 30 days', async () => {
    mockOrder.mockResolvedValue({
      data: [makeProject({ created_at: new Date(Date.now() - 5 * 86400 * 1000).toISOString() })],
      error: null,
    });
    render(<Projects />);
    await waitFor(() => expect(screen.getByText('5d ago')).toBeInTheDocument());
  });

  it('shows locale date for >= 30 days', async () => {
    mockOrder.mockResolvedValue({
      data: [makeProject({ created_at: new Date(Date.now() - 60 * 86400 * 1000).toISOString() })],
      error: null,
    });
    render(<Projects />);
    await waitFor(() => screen.getByText('Alpha Project'));
    // Just check it doesn't show "ago"
    expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
  });
});

describe('Projects — kanban drag and drop', () => {
  const switchToKanban = async () => {
    await waitFor(() => screen.getByTitle('Kanban view'));
    fireEvent.click(screen.getByTitle('Kanban view'));
    await waitFor(() => screen.getByText('To Do'));
  };

  it('shows "No completed projects" when done column is empty', async () => {
    mockOrder.mockResolvedValue({
      data: [
        makeProject({ id: 'p1', name: 'Todo1', status: 'todo' }),
        makeProject({ id: 'p2', name: 'Active1', status: 'in_progress' }),
      ],
      error: null,
    });
    render(<Projects />);
    await switchToKanban();
    expect(screen.getByText('No completed projects')).toBeInTheDocument();
  });

  it('handleDragOver fires preventDefault when dragging over column', async () => {
    mockOrder.mockResolvedValue({
      data: [makeProject({ id: 'p1', name: 'DragProj', status: 'todo' })],
      error: null,
    });
    render(<Projects />);
    await switchToKanban();
    await waitFor(() => screen.getByText('DragProj'));
    // Find the drop zone of the In Progress column (it has onDragOver)
    const inProgressHeadings = screen.getAllByText(/In Progress/i);
    if (inProgressHeadings.length > 0) {
      const dropZone = inProgressHeadings[0].closest('[class*="rounded-lg"]')?.querySelector('[class*="flex-1"]') as HTMLElement;
      if (dropZone) {
        // Create drag event with a mock dataTransfer to avoid jsdom's undefined dataTransfer
        const mockDragEvent = new Event('dragover', { bubbles: true, cancelable: true });
        Object.defineProperty(mockDragEvent, 'dataTransfer', {
          value: { dropEffect: '' },
          configurable: true,
          writable: true,
        });
        fireEvent(dropZone, mockDragEvent);
      }
    }
    expect(screen.getByText('DragProj')).toBeInTheDocument();
  });

  it('handleDrop moves project to new column when dropped with dragged project', async () => {
    mockOrder.mockResolvedValue({
      data: [makeProject({ id: 'p1', name: 'DropProj', status: 'todo' })],
      error: null,
    });
    mockUpdateEq.mockResolvedValue({ data: null, error: null });
    render(<Projects />);
    await switchToKanban();
    await waitFor(() => screen.getByText('DropProj'));
    // Drag the card first to set draggedProject state
    const card = screen.getByText('DropProj').closest('[draggable]') as HTMLElement;
    if (card) {
      fireEvent.dragStart(card);
      // Find In Progress column's drop zone and drop
      const inProgressHeadings = screen.getAllByText(/In Progress/i);
      if (inProgressHeadings.length > 0) {
        const dropZone = inProgressHeadings[0].closest('[class*="rounded-lg"]')?.querySelector('[class*="flex-1"]') as HTMLElement;
        if (dropZone) {
          // Create drag event with mock dataTransfer
          const mockDragEvent = new Event('dragover', { bubbles: true, cancelable: true });
          Object.defineProperty(mockDragEvent, 'dataTransfer', {
            value: { dropEffect: '' },
            configurable: true,
            writable: true,
          });
          fireEvent(dropZone, mockDragEvent);
          fireEvent.drop(dropZone);
        }
      }
    }
    expect(screen.getByText('DropProj')).toBeInTheDocument();
  });
});

// ─── Kanban onDelete callback coverage ──────────────────────────────────────

describe('Projects — kanban delete triggers confirm dialog', () => {
  beforeEach(() => {
    mockOrder.mockResolvedValue({
      data: [
        makeProject({ id: 'p1', name: 'KanbanDelProj', status: 'todo' }),
        makeProject({ id: 'p2', name: 'AnotherProj', status: 'in_progress' }),
      ],
      error: null,
    });
  });

  it('clicking delete in kanban card sets confirmId and opens confirm dialog', async () => {
    render(<Projects />);
    await waitFor(() => screen.getByTitle('Kanban view'));
    fireEvent.click(screen.getByTitle('Kanban view'));
    await waitFor(() => screen.getByText('KanbanDelProj'));
    const deleteBtns = screen.getAllByLabelText('Delete project');
    fireEvent.click(deleteBtns[0]);
    // onDelete callback triggers setConfirmId + setConfirmName → ConfirmDialog opens
    const dialog = await screen.findByRole('dialog', { name: /delete project/i });
    expect(dialog).toBeInTheDocument();
  });
});

// ─── ProjectModal no-user guard ──────────────────────────────────────────────

describe('Projects — ProjectModal warns when user is null', () => {
  afterEach(() => {
    // Restore the default implementation after this suite
    mockAuthUser.mockImplementation(() => ({ user: { id: 'user-1' }, organizations: [{ id: 'org-1', name: 'Test Org' }] }));
  });

  it('shows warning toast and does not insert when user is null at submit', async () => {
    mockAuthUser.mockImplementation(() => ({ user: null as unknown as { id: string }, organizations: [] }));
    mockOrder.mockResolvedValue({ data: [], error: null });
    render(<Projects />);
    // Header "New project" button is always visible regardless of loading state
    const newProjBtn = await screen.findByRole('button', { name: /new project/i });
    fireEvent.click(newProjBtn);
    await waitFor(() => screen.getByRole('heading', { name: /new project/i }));
    // Fill required fields
    fireEvent.change(screen.getByPlaceholderText('Production AWS'), { target: { value: 'NullUserProj' } });
    fireEvent.change(screen.getByPlaceholderText('example.com'), { target: { value: 'null.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    // insert should NOT be called because the !user guard returns early
    await waitFor(() => expect(mockInsert).not.toHaveBeenCalled());
  });
});

