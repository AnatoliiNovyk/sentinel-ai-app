import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getComments, addComment, updateComment, deleteComment, subscribeToComments } from '../commentService';

// ── Per-operation mock builders ────────────────────────────────────────────────
// Each operation has its own terminal mock so we can easily inject resolved values.

// addComment: .insert({...}).select().maybeSingle()
const mockAddMaybeSingle = vi.fn();
const mockInsert = vi.fn(() => ({
  select: vi.fn(() => ({ maybeSingle: mockAddMaybeSingle })),
}));

// updateComment: .update({...}).eq().select().maybeSingle()
const mockUpdateMaybeSingle = vi.fn();
const mockUpdate = vi.fn(() => ({
  eq: vi.fn(() => ({
    select: vi.fn(() => ({ maybeSingle: mockUpdateMaybeSingle })),
  })),
}));

// deleteComment: .delete().eq()  — awaited directly
const mockDeleteEq = vi.fn();
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq }));

// getComments: .select('*').eq().is().order()  and replies: .select('*').eq().eq().order()
// Use a counter to return different values per call to .order()
const orderResults: Array<{ data: unknown; error: unknown }> = [];
let orderCallIdx = 0;

function makeQueryChain() {
  // Chain that supports: .select, .eq, .is, .order — order() is terminal
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.order = vi.fn(() => {
    const result = orderResults[orderCallIdx++];
    return Promise.resolve(result ?? { data: null, error: null });
  });
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
  return chain;
}

vi.mock('../supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../supabase')>();
  return {
    ...actual,
    supabase: {
      from: vi.fn(() => ({
        select: makeQueryChain().select,
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
        // also expose select on the root for the getComments query
        ...makeQueryChain(),
      })),
    },
  };
});

describe('commentService — getComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orderResults.length = 0;
    orderCallIdx = 0;
  });

  it('returns [] when supabase returns an error', async () => {
    orderResults[0] = { data: null, error: { message: 'DB error' } };
    const result = await getComments('vuln-1');
    expect(result).toEqual([]);
  });

  it('returns comments with empty replies array when no replies', async () => {
    const mockComments = [{ id: 'c-1', vulnerability_id: 'vuln-1', content: 'Test', user_id: 'u-1' }];
    // idx=0: main query result; idx=1: replies for c-1
    orderResults[0] = { data: mockComments, error: null };
    orderResults[1] = { data: [], error: null };
    const result = await getComments('vuln-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c-1');
    expect((result[0] as { replies: unknown[] }).replies).toEqual([]);
  });
});

describe('commentService — addComment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns new comment on success', async () => {
    const newComment = { id: 'c-new', vulnerability_id: 'vuln-1', user_id: 'u-1', content: 'Hello' };
    mockAddMaybeSingle.mockResolvedValueOnce({ data: newComment, error: null });
    const result = await addComment('vuln-1', 'u-1', 'Hello');
    expect(result).toEqual(newComment);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ vulnerability_id: 'vuln-1', user_id: 'u-1', content: 'Hello' })
    );
  });

  it('returns null on error', async () => {
    mockAddMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'Insert failed' } });
    const result = await addComment('vuln-1', 'u-1', 'Hello');
    expect(result).toBeNull();
  });

  it('passes parentId when provided', async () => {
    mockAddMaybeSingle.mockResolvedValueOnce({ data: { id: 'c-reply' }, error: null });
    await addComment('vuln-1', 'u-1', 'Reply', 'parent-123');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ parent_id: 'parent-123' })
    );
  });
});

describe('commentService — updateComment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls update with new content', async () => {
    const updated = { id: 'c-1', content: 'Updated' };
    mockUpdateMaybeSingle.mockResolvedValueOnce({ data: updated, error: null });
    const result = await updateComment('c-1', 'Updated');
    expect(result).toEqual(updated);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Updated' })
    );
  });

  it('returns null on error', async () => {
    mockUpdateMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'Update failed' } });
    const result = await updateComment('c-1', 'Updated');
    expect(result).toBeNull();
  });
});

describe('commentService — deleteComment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns true on success', async () => {
    mockDeleteEq.mockResolvedValueOnce({ error: null });
    const result = await deleteComment('c-1');
    expect(result).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
  });

  it('returns false on error', async () => {
    mockDeleteEq.mockResolvedValueOnce({ error: { message: 'Delete failed' } });
    const result = await deleteComment('c-1');
    expect(result).toBe(false);
  });
});

// ─── subscribeToComments ──────────────────────────────────────────────────────

describe('commentService — subscribeToComments', () => {
  it('returns an unsubscribe function', async () => {
    const unsubscribeMock = vi.fn();
    // Patch the supabase mock to handle .on().subscribe() for subscribe calls
    const supabaseMod = vi.mocked(
      (await import('../supabase')).supabase
    );
    (supabaseMod.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: unsubscribeMock }),
    });

    const unsubscribe = subscribeToComments('vuln-1', vi.fn());
    expect(typeof unsubscribe).toBe('function');
  });

  it('calls unsubscribe when the returned function is invoked', async () => {
    const unsubscribeMock = vi.fn();
    const supabaseMod = vi.mocked(
      (await import('../supabase')).supabase
    );
    (supabaseMod.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: unsubscribeMock }),
    });

    const unsubscribe = subscribeToComments('vuln-1', vi.fn());
    unsubscribe();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });
});
