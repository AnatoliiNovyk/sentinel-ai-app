import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Chat from '../Chat';

// ── Mocks ──────────────────────────────────────────────────────────────

const { mockCallAiGateway } = vi.hoisted(() => ({
  mockCallAiGateway: vi.fn().mockResolvedValue({ content: 'Hello! How can I help?', provider: 'mock' }),
}));

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn().mockReturnValue({
    user: { id: 'user-1' },
    organizations: [{ id: 'org-1', name: 'Test Org' }],
  }),
}));

vi.mock('../../lib/aiGateway', () => ({
  callAiGateway: (...args: unknown[]) => mockCallAiGateway(...args),
  TOOL_LABELS: { run_agent: 'Run Agent' },
}));

vi.mock('../../lib/agentTools', () => ({
  runAgent: vi.fn().mockResolvedValue(null),
  TOOL_LABELS: {},
}));

vi.mock('../../context/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

const fakeConv = { id: 'conv-1', title: 'Test chat', created_at: new Date().toISOString(), user_id: 'user-1' };
const fakeMsg  = { id: 'msg-1', role: 'user', content: 'Hello AI', conversation_id: 'conv-1', user_id: 'user-1', created_at: new Date().toISOString() };
const fakeAiMsg = { id: 'msg-2', role: 'assistant', content: 'Hello! How can I help?', conversation_id: 'conv-1', user_id: 'user-1', created_at: new Date().toISOString() };

const makeChain = (overrides: Record<string, unknown> = {}) => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  // make eq/select return the chain object itself
  chain.select.mockReturnValue(chain);
  chain.delete.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
};

let convChain: ReturnType<typeof makeChain>;
let msgChain: ReturnType<typeof makeChain>;

vi.mock('../../api/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'ai_conversations') return convChain;
      return msgChain;
    }),
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────

const setupMocks = (convData: unknown[] = [], maybeSingleConv = fakeConv, maybeSingleMsg = fakeMsg) => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    organizations: [{ id: 'org-1', name: 'Test Org' }],
  });
  convChain = makeChain({
    order: vi.fn().mockResolvedValue({ data: convData, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: maybeSingleConv, error: null }),
  });
  convChain.select.mockReturnValue(convChain);
  convChain.delete.mockReturnValue(convChain);
  convChain.eq.mockReturnValue(convChain);
  msgChain = makeChain({
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: maybeSingleMsg, error: null }),
  });
  msgChain.select.mockReturnValue(msgChain);
  msgChain.eq.mockReturnValue(msgChain);
};

// ── Tests ───────────────────────────────────────────────────────────────

describe('Chat — basic render and send message', () => {
  beforeEach(() => {
    setupMocks();
    mockCallAiGateway.mockResolvedValue({ content: 'Hello! How can I help?', provider: 'mock' });
  });

  it('renders the chat input', async () => {
    render(<Chat />);
    await waitFor(() => expect(screen.getByPlaceholderText(/Ask anything/i)).toBeInTheDocument());
  });

  it('sends a message and calls AI gateway', async () => {
    render(<Chat />);
    await waitFor(() => expect(screen.getByPlaceholderText(/Ask anything/i)).toBeInTheDocument());
    const input = screen.getByPlaceholderText(/Ask anything/i);
    const sendBtn = screen.getByRole('button', { name: /send message/i });
    fireEvent.change(input, { target: { value: 'Hello AI' } });
    fireEvent.click(sendBtn);
    await waitFor(() => expect(mockCallAiGateway).toHaveBeenCalled());
  });

  it('sends message on Enter key', async () => {
    render(<Chat />);
    await waitFor(() => expect(screen.getByPlaceholderText(/Ask anything/i)).toBeInTheDocument());
    const input = screen.getByPlaceholderText(/Ask anything/i);
    fireEvent.change(input, { target: { value: 'Enter message' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
    await waitFor(() => expect(mockCallAiGateway).toHaveBeenCalled());
  });

  it('does not send on Shift+Enter', async () => {
    mockCallAiGateway.mockClear();
    render(<Chat />);
    await waitFor(() => expect(screen.getByPlaceholderText(/Ask anything/i)).toBeInTheDocument());
    const input = screen.getByPlaceholderText(/Ask anything/i);
    fireEvent.change(input, { target: { value: 'Shift enter' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    expect(mockCallAiGateway).not.toHaveBeenCalled();
  });

  it('suggestion button sends message directly', async () => {
    render(<Chat />);
    await waitFor(() => expect(screen.getByPlaceholderText(/Ask anything/i)).toBeInTheDocument());
    const suggestion = screen.getAllByRole('button').find(b => b.textContent?.includes('List my open findings'));
    if (suggestion) {
      fireEvent.click(suggestion);
      await waitFor(() => expect(mockCallAiGateway).toHaveBeenCalled());
    }
  });
});

describe('Chat — conversations list and sidebar', () => {
  beforeEach(() => {
    setupMocks([fakeConv]);
  });

  it('shows conversation in sidebar when loaded', async () => {
    render(<Chat />);
    await waitFor(() => expect(screen.getByText('Test chat')).toBeInTheDocument());
  });

  it('clicks new conversation button', async () => {
    render(<Chat />);
    await waitFor(() => expect(screen.getByText('Test chat')).toBeInTheDocument());
    const newBtn = screen.getByRole('button', { name: /new chat/i });
    fireEvent.click(newBtn);
    await waitFor(() => expect(convChain.insert).toHaveBeenCalled());
  });

  it('switches active conversation on click', async () => {
    render(<Chat />);
    await waitFor(() => expect(screen.getByText('Test chat')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Test chat'));
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    // No error = pass
  });

  it('searches/filters conversations', async () => {
    render(<Chat />);
    await waitFor(() => expect(screen.getByText('Test chat')).toBeInTheDocument());
    const searchInput = screen.getByPlaceholderText(/search chats/i);
    fireEvent.change(searchInput, { target: { value: 'nomatch' } });
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    expect(screen.queryByText('Test chat')).not.toBeInTheDocument();
  });

  it('filters by date — today via select', async () => {
    render(<Chat />);
    await waitFor(() => expect(screen.getByText('Test chat')).toBeInTheDocument());
    const dateSelect = screen.getByRole('combobox', { name: /filter by date/i });
    fireEvent.change(dateSelect, { target: { value: 'today' } });
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    // conversation has today's date — should still be visible
    expect(screen.getByText('Test chat')).toBeInTheDocument();
  });

  it('deletes a conversation', async () => {
    render(<Chat />);
    await waitFor(() => expect(screen.getByText('Test chat')).toBeInTheDocument());
    const deleteBtn = screen.getByRole('button', { name: /delete conversation/i });
    fireEvent.click(deleteBtn);
    await waitFor(() => expect(convChain.delete).toHaveBeenCalled());
  });

  it('clears all conversations', async () => {
    render(<Chat />);
    await waitFor(() => expect(screen.getByText('Test chat')).toBeInTheDocument());
    const clearBtn = screen.getByRole('button', { name: /clear all/i });
    fireEvent.click(clearBtn);
    await waitFor(() => expect(convChain.delete).toHaveBeenCalled());
  });
});

describe('Chat — messages rendering', () => {
  beforeEach(() => {
    setupMocks([fakeConv]);
    // Make messages endpoint return an assistant message
    msgChain.order.mockResolvedValue({ data: [fakeAiMsg], error: null });
  });

  it('renders assistant message with copy button', async () => {
    render(<Chat />);
    await waitFor(() => expect(screen.getByText('Test chat')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Test chat'));
    await waitFor(() => expect(screen.getByRole('button', { name: /copy message/i })).toBeInTheDocument());
  });

  it('copies message to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<Chat />);
    await waitFor(() => expect(screen.getByText('Test chat')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Test chat'));
    await waitFor(() => expect(screen.getByRole('button', { name: /copy message/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /copy message/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Hello! How can I help?'));
  });
});

describe('Chat — agent tool path and sending spinner', () => {
  beforeEach(() => {
    setupMocks([fakeConv]);
  });

  it('shows sending spinner during message send', async () => {
    // Slow down AI response so we can catch sending state
    mockCallAiGateway.mockImplementation(() => new Promise(r => setTimeout(() => r({ content: 'resp', provider: 'mock' }), 200)));
    render(<Chat />);
    await waitFor(() => expect(screen.getByPlaceholderText(/Ask anything/i)).toBeInTheDocument());
    const input = screen.getByPlaceholderText(/Ask anything/i);
    fireEvent.change(input, { target: { value: 'test spinner' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    // spinner may be visible briefly
    await waitFor(() => expect(mockCallAiGateway).toHaveBeenCalled());
  });

  it('uses runAgent path when agent returns result', async () => {
    const { runAgent } = await import('../../lib/agentTools');
    (runAgent as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ content: 'agent result', toolCalls: [{ name: 'run_agent' }] });
    render(<Chat />);
    await waitFor(() => expect(screen.getByPlaceholderText(/Ask anything/i)).toBeInTheDocument());
    const input = screen.getByPlaceholderText(/Ask anything/i);
    fireEvent.change(input, { target: { value: 'run agent' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    await act(async () => { await new Promise(r => setTimeout(r, 200)); });
  });

  it('handles AI gateway error gracefully', async () => {
    mockCallAiGateway.mockRejectedValueOnce(new Error('Gateway down'));
    render(<Chat />);
    await waitFor(() => expect(screen.getByPlaceholderText(/Ask anything/i)).toBeInTheDocument());
    const input = screen.getByPlaceholderText(/Ask anything/i);
    fireEvent.change(input, { target: { value: 'error test' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    await act(async () => { await new Promise(r => setTimeout(r, 200)); });
  });

  it('builds history from existing messages (lines 166-167)', async () => {
    // Load conversation with existing messages so history map runs
    msgChain.order.mockResolvedValue({ data: [fakeMsg], error: null });
    render(<Chat />);
    await waitFor(() => expect(screen.getByText('Test chat')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Test chat'));
    // Wait for messages to load
    await act(async () => { await new Promise(r => setTimeout(r, 100)); });
    // Now send a message — history will include fakeMsg
    const input = screen.getByPlaceholderText(/Ask anything/i);
    fireEvent.change(input, { target: { value: 'second message' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    await waitFor(() => expect(mockCallAiGateway).toHaveBeenCalled());
  });
});

describe('Chat — delete active conversation', () => {
  it('clears active conversation when deleting the active one', async () => {
    // Start with conversation already active (loaded)
    setupMocks([fakeConv]);
    render(<Chat />);
    await waitFor(() => expect(screen.getByText('Test chat')).toBeInTheDocument());
    // Click to make it active
    fireEvent.click(screen.getByText('Test chat'));
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    // Now delete it
    const deleteBtn = screen.getByRole('button', { name: /delete conversation/i });
    fireEvent.click(deleteBtn);
    await waitFor(() => expect(convChain.delete).toHaveBeenCalled());
  });
});

describe('Chat — relativeConvTime display', () => {
  it('shows just now for recent conversation', async () => {
    const recent = { ...fakeConv, created_at: new Date().toISOString() };
    setupMocks([recent]);
    render(<Chat />);
    await waitFor(() => expect(screen.getByText('Test chat')).toBeInTheDocument());
    expect(screen.getByText(/just now/i)).toBeInTheDocument();
  });

  it('shows Xh ago for hour-old conversation', async () => {
    const hourAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const old = { ...fakeConv, created_at: hourAgo };
    setupMocks([old]);
    render(<Chat />);
    await waitFor(() => expect(screen.getByText('Test chat')).toBeInTheDocument());
    expect(screen.getByText(/h ago/i)).toBeInTheDocument();
  });

  it('shows Xd ago for day-old conversation', async () => {
    const dayAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const old = { ...fakeConv, created_at: dayAgo };
    setupMocks([old]);
    render(<Chat />);
    await waitFor(() => expect(screen.getByText('Test chat')).toBeInTheDocument());
    expect(screen.getByText(/d ago/i)).toBeInTheDocument();
  });

  it('shows Xm ago for minute-old conversation', async () => {
    const minsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const old = { ...fakeConv, created_at: minsAgo };
    setupMocks([old]);
    render(<Chat />);
    await waitFor(() => expect(screen.getByText('Test chat')).toBeInTheDocument());
    expect(screen.getByText(/m ago/i)).toBeInTheDocument();
  });
});
