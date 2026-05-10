import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

describe('CommentThread — adding a comment', () => {
  beforeEach(() => {
    mockGetComments.mockResolvedValue([]);
    mockSubscribeToComments.mockReturnValue(vi.fn());
    mockAddComment.mockResolvedValue(undefined);
  });

  it('Send button is disabled when input is empty', async () => {
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() => screen.getByTitle('Send comment'));
    expect(screen.getByTitle('Send comment')).toBeDisabled();
  });

  it('Send button is enabled when input has text', async () => {
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() => screen.getByPlaceholderText(/Add a comment/i));
    fireEvent.change(screen.getByPlaceholderText(/Add a comment/i), { target: { value: 'Hello world' } });
    expect(screen.getByTitle('Send comment')).not.toBeDisabled();
  });

  it('calls addComment when Send is clicked', async () => {
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() => screen.getByPlaceholderText(/Add a comment/i));
    fireEvent.change(screen.getByPlaceholderText(/Add a comment/i), { target: { value: 'Test message' } });
    await act(async () => {
      fireEvent.click(screen.getByTitle('Send comment'));
    });
    expect(mockAddComment).toHaveBeenCalledWith('vuln-1', 'user-1', 'Test message', undefined);
  });

  it('clears input after sending comment', async () => {
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() => screen.getByPlaceholderText(/Add a comment/i));
    fireEvent.change(screen.getByPlaceholderText(/Add a comment/i), { target: { value: 'Test message' } });
    await act(async () => {
      fireEvent.click(screen.getByTitle('Send comment'));
    });
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/Add a comment/i)).toHaveValue(''),
    );
  });

  it('submits on Enter key press', async () => {
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() => screen.getByPlaceholderText(/Add a comment/i));
    const input = screen.getByPlaceholderText(/Add a comment/i);
    fireEvent.change(input, { target: { value: 'Enter key test' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });
    expect(mockAddComment).toHaveBeenCalled();
  });
});

describe('CommentThread — editing a comment', () => {
  const comment = {
    id: 'c-edit-1',
    vulnerability_id: 'vuln-1',
    user_id: 'user-1',
    content: 'Original comment text',
    created_at: '2026-04-01T10:00:00Z',
    updated_at: '2026-04-01T10:00:00Z',
    replies: [],
  };

  beforeEach(() => {
    mockGetComments.mockResolvedValue([comment]);
    mockSubscribeToComments.mockReturnValue(vi.fn());
    mockUpdateComment.mockResolvedValue(undefined);
  });

  it('shows edit/delete buttons for own comment', async () => {
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() => screen.getByTitle('Edit comment'));
    expect(screen.getByTitle('Edit comment')).toBeInTheDocument();
    expect(screen.getByTitle('Delete comment')).toBeInTheDocument();
  });

  it('clicking edit shows edit textarea with original content', async () => {
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() => screen.getByTitle('Edit comment'));
    fireEvent.click(screen.getByTitle('Edit comment'));
    await waitFor(() => {
      const textarea = screen.getByRole('textbox', { name: /Edit comment/i });
      expect(textarea).toHaveValue('Original comment text');
    });
  });

  it('clicking Save in edit mode calls updateComment', async () => {
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() => screen.getByTitle('Edit comment'));
    fireEvent.click(screen.getByTitle('Edit comment'));
    await waitFor(() => screen.getByRole('textbox', { name: /Edit comment/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /Edit comment/i }), { target: { value: 'Updated text' } });
    await act(async () => {
      fireEvent.click(screen.getByTitle('Save comment'));
    });
    expect(mockUpdateComment).toHaveBeenCalledWith('c-edit-1', 'Updated text');
  });

  it('clicking Cancel in edit mode hides textarea', async () => {
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() => screen.getByTitle('Edit comment'));
    fireEvent.click(screen.getByTitle('Edit comment'));
    await waitFor(() => screen.getByTitle('Cancel edit'));
    fireEvent.click(screen.getByTitle('Cancel edit'));
    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: /Edit comment/i })).not.toBeInTheDocument(),
    );
  });
});

describe('CommentThread — deleting a comment', () => {
  const comment = {
    id: 'c-del-1',
    vulnerability_id: 'vuln-1',
    user_id: 'user-1',
    content: 'Comment to delete',
    created_at: '2026-04-01T10:00:00Z',
    updated_at: '2026-04-01T10:00:00Z',
    replies: [],
  };

  beforeEach(() => {
    mockGetComments.mockResolvedValue([comment]);
    mockSubscribeToComments.mockReturnValue(vi.fn());
    mockDeleteComment.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls deleteComment when delete button clicked and confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() => screen.getByTitle('Delete comment'));
    await act(async () => {
      fireEvent.click(screen.getByTitle('Delete comment'));
    });
    expect(mockDeleteComment).toHaveBeenCalledWith('c-del-1');
  });

  it('does not call deleteComment when confirm returns false', async () => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    mockGetComments.mockResolvedValue([comment]);
    mockSubscribeToComments.mockReturnValue(vi.fn());
    mockDeleteComment.mockResolvedValue(undefined);
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() => screen.getByTitle('Delete comment'));
    await act(async () => {
      fireEvent.click(screen.getByTitle('Delete comment'));
    });
    expect(mockDeleteComment).not.toHaveBeenCalled();
  });
});

describe('CommentThread — replies', () => {
  const comment = {
    id: 'c-parent',
    vulnerability_id: 'vuln-1',
    user_id: 'user-2',
    content: 'Parent comment',
    created_at: '2026-04-01T10:00:00Z',
    updated_at: '2026-04-01T10:00:00Z',
    replies: [
      {
        id: 'r-1',
        vulnerability_id: 'vuln-1',
        user_id: 'user-3',
        content: 'Reply text here',
        created_at: '2026-04-01T11:00:00Z',
        updated_at: '2026-04-01T11:00:00Z',
        replies: [],
      },
    ],
  };

  beforeEach(() => {
    mockGetComments.mockResolvedValue([comment]);
    mockSubscribeToComments.mockReturnValue(vi.fn());
    mockAddComment.mockResolvedValue(undefined);
    mockDeleteComment.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows reply content', async () => {
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() =>
      expect(screen.getByText('Reply text here')).toBeInTheDocument(),
    );
  });

  it('shows Reply button on comment', async () => {
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() => screen.getByText('Reply'));
    expect(screen.getByText('Reply')).toBeInTheDocument();
  });

  it('clicking Reply shows "Replying to comment..." indicator', async () => {
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() => screen.getByText('Reply'));
    fireEvent.click(screen.getByText('Reply'));
    await waitFor(() =>
      expect(screen.getByText(/Replying to comment/i)).toBeInTheDocument(),
    );
  });

  it('clicking Reply again cancels reply (toggle)', async () => {
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() => screen.getByText('Reply'));
    fireEvent.click(screen.getByText('Reply'));
    await waitFor(() => screen.getByText('Cancel reply'));
    fireEvent.click(screen.getByText('Cancel reply'));
    await waitFor(() =>
      expect(screen.queryByText(/Replying to comment/i)).not.toBeInTheDocument(),
    );
  });

  it('cancel reply ✕ button removes reply indicator', async () => {
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() => screen.getByText('Reply'));
    fireEvent.click(screen.getByText('Reply'));
    await waitFor(() => screen.getByText(/Replying to comment/i));
    // ✕ button is in the reply indicator bar
    const cancelBtn = screen.getAllByRole('button').find(b => b.textContent === '✕');
    expect(cancelBtn).toBeDefined();
    fireEvent.click(cancelBtn!);
    await waitFor(() =>
      expect(screen.queryByText(/Replying to comment/i)).not.toBeInTheDocument(),
    );
  });

  it('reply count included in comment count badge', async () => {
    // 1 parent + 1 reply = 2
    render(<CommentThread {...DEFAULT_PROPS} />);
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
  });
});

describe('CommentThread — timeAgo display', () => {
  beforeEach(() => {
    mockSubscribeToComments.mockReturnValue(vi.fn());
  });

  it('shows "just now" for very recent comment', async () => {
    const comment = makeComment({ created_at: new Date().toISOString() });
    mockGetComments.mockResolvedValue([comment]);
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() => expect(screen.getByText(/just now/i)).toBeInTheDocument());
  });

  it('shows minutes ago for recent comment', async () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    const comment = makeComment({ created_at: fiveMinAgo });
    mockGetComments.mockResolvedValue([comment]);
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() => expect(screen.getByText(/5m ago/i)).toBeInTheDocument());
  });

  it('shows hours ago for comment from 3 hours ago', async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60000).toISOString();
    const comment = makeComment({ created_at: threeHoursAgo });
    mockGetComments.mockResolvedValue([comment]);
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() => expect(screen.getByText(/3h ago/i)).toBeInTheDocument());
  });

  it('shows locale date string for comment older than 24 hours', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60000).toISOString();
    const comment = makeComment({ created_at: twoDaysAgo });
    mockGetComments.mockResolvedValue([comment]);
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    const expectedDate = new Date(twoDaysAgo).toLocaleDateString();
    await waitFor(() => expect(screen.getByText(expectedDate)).toBeInTheDocument());
  });
});

describe('CommentThread — edit guard', () => {
  const comment = {
    id: 'c-edit-guard',
    vulnerability_id: 'vuln-1',
    user_id: 'user-1',
    content: 'Editable comment',
    created_at: '2026-04-01T10:00:00Z',
    updated_at: '2026-04-01T10:00:00Z',
    replies: [],
  };

  beforeEach(() => {
    mockGetComments.mockResolvedValue([comment]);
    mockSubscribeToComments.mockReturnValue(vi.fn());
    mockUpdateComment.mockResolvedValue(undefined);
  });

  it('does not call updateComment when edit text is blank', async () => {
    render(<CommentThread {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Open comments'));
    await waitFor(() => screen.getByTitle('Edit comment'));
    fireEvent.click(screen.getByTitle('Edit comment'));
    await waitFor(() => screen.getByRole('textbox', { name: /Edit comment/i }));
    // Clear the textarea
    fireEvent.change(screen.getByRole('textbox', { name: /Edit comment/i }), { target: { value: '' } });
    await act(async () => {
      fireEvent.click(screen.getByTitle('Save comment'));
    });
    expect(mockUpdateComment).not.toHaveBeenCalled();
  });
});
