import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommentThread } from '../CommentThread';
import type { FindingComment } from '../../lib/supabase';

// ── commentService mocks ──────────────────────────────────────────────────────

const {
  mockGetComments,
  mockAddComment,
  mockUpdateComment,
  mockDeleteComment,
  mockSubscribeToComments,
} = vi.hoisted(() => ({
  mockGetComments: vi.fn(),
  mockAddComment: vi.fn(),
  mockUpdateComment: vi.fn(),
  mockDeleteComment: vi.fn(),
  mockSubscribeToComments: vi.fn(),
}));

vi.mock('../../lib/commentService', () => ({
  getComments: mockGetComments,
  addComment: mockAddComment,
  updateComment: mockUpdateComment,
  deleteComment: mockDeleteComment,
  subscribeToComments: mockSubscribeToComments,
}));

vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeComment(overrides: Partial<FindingComment> = {}): FindingComment {
  return {
    id: `c-${Math.random().toString(36).slice(2)}`,
    vulnerability_id: 'vuln-1',
    user_id: 'user-1',
    content: 'Test comment text',
    created_at: '2026-04-01T10:00:00Z',
    updated_at: '2026-04-01T10:00:00Z',
    replies: [],
    ...overrides,
  };
}

const DEFAULT_PROPS = {
  vulnerabilityId: 'vuln-1',
  vulnerabilityTitle: 'SQL Injection in login form',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CommentThread — collapsed state', () => {
  beforeEach(() => {
    mockGetComments.mockResolvedValue([]);
    mockSubscribeToComments.mockReturnValue(vi.fn()); // returns unsubscribe fn
  });

  it('renders collapsed button with "Comments" label', () => {
    render(<CommentThread {...DEFAULT_PROPS} />);
    expect(screen.getByText('Comments')).toBeInTheDocument();
  });

  it('does not show the panel before opening', () => {
    render(<CommentThread {...DEFAULT_PROPS} />);
    expect(screen.queryByText(/Loading comments/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Comments/i })).not.toBeInTheDocument();
  });

  it('shows comment count badge when comments are loaded', async () => {
    mockGetComments.mockResolvedValue([makeComment(), makeComment()]);
    render(<CommentThread {...DEFAULT_PROPS} />);
    // Count badge appears on the collapsed button
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
  });
});

describe('CommentThread — opened state', () => {
  beforeEach(() => {
    mockGetComments.mockResolvedValue([]);
    mockSubscribeToComments.mockReturnValue(vi.fn());
  });

  it('opens panel when button clicked', async () => {
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() =>
      expect(screen.getByTitle('Close comments')).toBeInTheDocument(),
    );
  });

  it('shows vulnerability title in panel header', async () => {
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() =>
      expect(screen.getByText('SQL Injection in login form')).toBeInTheDocument(),
    );
  });

  it('shows "No comments yet" when empty', async () => {
    mockGetComments.mockResolvedValue([]);
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() =>
      expect(screen.getByText(/No comments yet/i)).toBeInTheDocument(),
    );
  });

  it('shows comment content when comments loaded', async () => {
    mockGetComments.mockResolvedValue([
      makeComment({ content: 'Confirmed SQL injection on /login endpoint' }),
    ]);
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() =>
      expect(screen.getByText('Confirmed SQL injection on /login endpoint')).toBeInTheDocument(),
    );
  });

  it('renders textarea for new comment input', async () => {
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/Add a comment/i)).toBeInTheDocument(),
    );
  });

  it('closes panel when close button clicked', async () => {
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() => screen.getByTitle('Close comments'));
    fireEvent.click(screen.getByTitle('Close comments'));
    await waitFor(() =>
      expect(screen.queryByText(/No comments yet/i)).not.toBeInTheDocument(),
    );
  });
});

describe('CommentThread — showing loading state', () => {
  it('shows "Loading comments..." while fetching', async () => {
    // Never-resolving promise to keep loading state visible
    mockGetComments.mockReturnValue(new Promise(() => {}));
    mockSubscribeToComments.mockReturnValue(vi.fn());
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() =>
      expect(screen.getByText(/Loading comments/i)).toBeInTheDocument(),
    );
  });
});
