import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import type { GatewayResponse } from '../../lib/aiGateway';
import Chat from '../Chat';

const { mockRunAgent, mockCallAiGateway, authValue } = vi.hoisted(() => ({
  mockRunAgent: vi.fn(),
  mockCallAiGateway: vi.fn(),
  authValue: {
    user: { id: 'user-1' },
    organizations: [{ id: 'org-1' }],
  },
}));

type Conversation = { id: string; title: string; created_at?: string; user_id?: string };
type Message = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

let conversations: Conversation[];
let messages: Message[];
let convoIdCounter = 1;
let msgIdCounter = 1;

vi.mock('../../context/useAuth', () => ({
  useAuth: () => authValue,
}));

vi.mock('../../lib/aiGateway', () => ({
  callAiGateway: mockCallAiGateway,
}));

vi.mock('../../lib/agentTools', () => ({
  runAgent: mockRunAgent,
  TOOL_LABELS: {
    list_projects: 'Listed projects',
  },
}));

vi.mock('marked', () => ({
  marked: {
    setOptions: vi.fn(),
    parse: (s: string) => s,
  },
}));

vi.mock('../../api/client', () => {
  const from = vi.fn((table: string) => {
    if (table === 'ai_conversations') {
      return {
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [...conversations] }),
          }),
        }),
        insert: (payload: { user_id: string; title: string }) => ({
          select: () => ({
            maybeSingle: async () => {
              const created = {
                id: `convo-${convoIdCounter++}`,
                title: payload.title,
                user_id: payload.user_id,
                created_at: new Date().toISOString(),
              };
              conversations = [created, ...conversations];
              return { data: created };
            },
          }),
        }),
        delete: () => ({
          eq: (_f: string, id: string) => {
            conversations = conversations.filter((c) => c.id !== id);
            return Promise.resolve({ data: null, error: null });
          },
          in: (_f: string, ids: string[]) => {
            conversations = conversations.filter((c) => !ids.includes(c.id));
            return Promise.resolve({ data: null, error: null });
          },
        }),
      };
    }

    if (table === 'ai_messages') {
      return {
        select: () => ({
          eq: (_field: string, convoId: string) => ({
            order: () => Promise.resolve({ data: messages.filter((m) => m.conversation_id === convoId) }),
          }),
        }),
        insert: (payload: {
          conversation_id: string;
          user_id: string;
          role: 'user' | 'assistant';
          content: string;
        }) => ({
          select: () => ({
            maybeSingle: async () => {
              const created: Message = {
                id: `msg-${msgIdCounter++}`,
                conversation_id: payload.conversation_id,
                user_id: payload.user_id,
                role: payload.role,
                content: payload.content,
                created_at: new Date().toISOString(),
              };
              messages = [...messages, created];
              return { data: created };
            },
          }),
        }),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return { supabase: { from } };
});

describe('Chat integration flow', () => {
  beforeEach(() => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo');
    if (!descriptor || descriptor.configurable !== false) {
      Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
        configurable: true,
        value: vi.fn(),
      });
    }

    vi.clearAllMocks();
    conversations = [];
    messages = [];
    convoIdCounter = 1;
    msgIdCounter = 1;

    mockRunAgent.mockResolvedValue({
      content: 'Agent response ready',
      toolCalls: [{ name: 'list_projects', ok: true, summary: 'ok' }],
    });
    mockCallAiGateway.mockResolvedValue({ content: 'Gateway response', provider: 'mock', isMock: true } satisfies GatewayResponse);
  });

  afterEach(() => {
    vi.clearAllMocks();
    conversations = [];
    messages = [];
  });

  it('sends suggestion and persists user+assistant messages via agent path', async () => {
    render(<Chat />);

    fireEvent.click(screen.getByRole('button', { name: 'List my open findings' }));

    await waitFor(() => expect(mockRunAgent).toHaveBeenCalled(), { timeout: 3000 });
    await waitFor(() => expect(screen.getByText('Agent response ready')).toBeInTheDocument(), { timeout: 3000 });

    expect(screen.getAllByText('List my open findings').length).toBeGreaterThan(0);
  });

  it('renders assistant response from gateway when agent returns null', async () => {
    mockRunAgent.mockResolvedValueOnce(null);
    mockCallAiGateway.mockResolvedValueOnce({
      content: 'Recovered answer after retry',
      provider: 'mock',
      isMock: true,
    } satisfies GatewayResponse);

    render(<Chat />);

    fireEvent.click(screen.getByRole('button', { name: 'Check compliance status' }));

    await waitFor(() => expect(mockCallAiGateway).toHaveBeenCalledTimes(1), { timeout: 3000 });
    await waitFor(() => expect(screen.getByText('Recovered answer after retry')).toBeInTheDocument(), { timeout: 3000 });
  });

  it('renders error message when gateway throws', async () => {
    mockRunAgent.mockResolvedValueOnce(null);
    mockCallAiGateway.mockRejectedValueOnce(new Error('AI processing timed out. Please try again.'));

    render(<Chat />);

    fireEvent.click(screen.getByRole('button', { name: 'Generate an executive summary' }));

    await waitFor(
      () => expect(screen.getByText('Error: AI processing timed out. Please try again.')).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });

  it('shows thinking label while gateway is processing', async () => {
    mockRunAgent.mockResolvedValueOnce(null);

    let releaseGateway!: () => void;
    const gatewayPromise = new Promise<GatewayResponse>((resolve) => {
      releaseGateway = () => resolve({ content: 'Recovered after wait', provider: 'mock', isMock: true });
    });
    mockCallAiGateway.mockReturnValueOnce(gatewayPromise);

    render(<Chat />);

    fireEvent.click(screen.getByRole('button', { name: 'SLA status — what is overdue?' }));

    await waitFor(
      () => expect(screen.getByText(/Analyzing|Querying|Computing|Checking|Generating|Calling/i)).toBeInTheDocument(),
      { timeout: 3000 },
    );

    releaseGateway();
    await waitFor(() => expect(screen.getByText('Recovered after wait')).toBeInTheDocument(), { timeout: 3000 });
  });
});

  describe('Chat — sidebar conversation switching', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      conversations = [
        { id: 'c-1', title: 'First Chat', created_at: new Date().toISOString(), user_id: 'user-1' },
        { id: 'c-2', title: 'Second Chat', created_at: new Date().toISOString(), user_id: 'user-1' },
      ];
      messages = [];
      convoIdCounter = 1;
      msgIdCounter = 1;
      mockRunAgent.mockResolvedValue({ content: 'ok', toolCalls: [] });
      mockCallAiGateway.mockResolvedValue({ content: 'ok', provider: 'mock', isMock: true } satisfies GatewayResponse);
        try {
          Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() });
        } catch { /* already defined */ }
    });

    it('switches active conversation when clicking conversation in sidebar', async () => {
      render(<Chat />);
      await waitFor(() => expect(screen.getByText('First Chat')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Second Chat'));
    });
  });

describe('Chat — form and keyboard interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conversations = [];
    messages = [];
    convoIdCounter = 1;
    msgIdCounter = 1;
    try { Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() }); } catch { /* already defined */ }
    mockRunAgent.mockResolvedValue({ content: 'Response', toolCalls: [] });
    mockCallAiGateway.mockResolvedValue({ content: 'GW response', provider: 'mock', isMock: true } satisfies GatewayResponse);
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('handleSubmit — form submit sends message', async () => {
    render(<Chat />);
    const ta = screen.getByPlaceholderText(/ask anything/i);
    fireEvent.change(ta, { target: { value: 'form submit test' } });
    fireEvent.submit(ta.closest('form')!);
    await waitFor(() => expect(mockRunAgent).toHaveBeenCalled(), { timeout: 3000 });
  });

  it('handleKeyDown — Enter key sends message', async () => {
    render(<Chat />);
    const ta = screen.getByPlaceholderText(/ask anything/i);
    fireEvent.change(ta, { target: { value: 'enter key test' } });
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: false });
    await waitFor(() => expect(mockRunAgent).toHaveBeenCalled(), { timeout: 3000 });
  });

  it('handleKeyDown — Shift+Enter does not submit', () => {
    render(<Chat />);
    const ta = screen.getByPlaceholderText(/ask anything/i);
    fireEvent.change(ta, { target: { value: 'shift enter test' } });
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true });
    expect(mockRunAgent).not.toHaveBeenCalled();
  });

  it('shows char counter when input has text', () => {
    render(<Chat />);
    const ta = screen.getByPlaceholderText(/ask anything/i);
    fireEvent.change(ta, { target: { value: 'hello' } });
    expect(screen.getByText('5/2000')).toBeInTheDocument();
  });

  it('char counter turns red when input exceeds 1800 chars', () => {
    render(<Chat />);
    const ta = screen.getByPlaceholderText(/ask anything/i);
    fireEvent.change(ta, { target: { value: 'a'.repeat(1801) } });
    const counter = screen.getByText('1801/2000');
    expect(counter.className).toContain('text-red-400');
  });
});

describe('Chat — conversation management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conversations = [
      { id: 'c-1', title: 'Conv One', created_at: new Date().toISOString(), user_id: 'user-1' },
      { id: 'c-2', title: 'Conv Two', created_at: new Date(Date.now() - 3600000).toISOString(), user_id: 'user-1' },
    ];
    messages = [];
    convoIdCounter = 3;
    msgIdCounter = 1;
    try { Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() }); } catch { /* already defined */ }
    mockRunAgent.mockResolvedValue({ content: 'ok', toolCalls: [] });
    mockCallAiGateway.mockResolvedValue({ content: 'ok', provider: 'mock', isMock: true } satisfies GatewayResponse);
  });

  it('newConversation — "New chat" button adds a conversation', async () => {
    render(<Chat />);
    await waitFor(() => screen.getByText('Conv One'));
    fireEvent.click(screen.getByRole('button', { name: /new chat/i }));
    await waitFor(() => expect(screen.getByText('New conversation')).toBeInTheDocument(), { timeout: 3000 });
  });

  it('deleteConversation — removes a conversation from sidebar', async () => {
    render(<Chat />);
    await waitFor(() => screen.getByText('Conv Two'));
    const deleteBtns = screen.getAllByRole('button', { name: 'Delete conversation' });
    fireEvent.click(deleteBtns[1]);
    await waitFor(() => expect(screen.queryByText('Conv Two')).toBeNull(), { timeout: 3000 });
  });

  it('deleteConversation when active — clears messages pane', async () => {
    render(<Chat />);
    await waitFor(() => screen.getByText('Conv One'));
    const deleteBtns = screen.getAllByRole('button', { name: 'Delete conversation' });
    fireEvent.click(deleteBtns[0]);
    await waitFor(() => expect(screen.queryByText('Conv One')).toBeNull(), { timeout: 3000 });
  });

  it('clearAllConversations — removes all conversations', async () => {
    render(<Chat />);
    await waitFor(() => screen.getByText('Conv One'));
    fireEvent.click(screen.getByRole('button', { name: 'Clear all conversations' }));
    await waitFor(() => expect(screen.queryByText('Conv One')).toBeNull(), { timeout: 3000 });
    expect(screen.queryByText('Conv Two')).toBeNull();
  });

  it('searchQuery — filters conversations by title', async () => {
    render(<Chat />);
    await waitFor(() => screen.getByText('Conv One'));
    fireEvent.change(screen.getByPlaceholderText('Search chats...'), { target: { value: 'Two' } });
    await waitFor(() => expect(screen.queryByText('Conv One')).toBeNull());
    expect(screen.getByText('Conv Two')).toBeInTheDocument();
  });

  it('dateFilter — select changes to today', async () => {
    render(<Chat />);
    await waitFor(() => screen.getByText('Conv One'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by date' }), { target: { value: 'today' } });
    expect(screen.getByText('Conv One')).toBeInTheDocument();
  });

  it('relativeConvTime — shows relative time for conversations', async () => {
    render(<Chat />);
    await waitFor(() => screen.getByText('Conv One'));
    expect(screen.getAllByText(/ago|just now/i).length).toBeGreaterThanOrEqual(1);
  });
});

describe('Chat — copyMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conversations = [{ id: 'c-1', title: 'Chat with msg', created_at: new Date().toISOString(), user_id: 'user-1' }];
    messages = [
      { id: 'msg-1', conversation_id: 'c-1', user_id: 'user-1', role: 'assistant', content: 'Hello from AI', created_at: new Date().toISOString() },
    ];
    convoIdCounter = 2;
    msgIdCounter = 2;
    try { Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() }); } catch { /* already defined */ }
    mockRunAgent.mockResolvedValue({ content: 'ok', toolCalls: [] });
    mockCallAiGateway.mockResolvedValue({ content: 'ok', provider: 'mock', isMock: true } satisfies GatewayResponse);
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('copyMessage — clipboard called with assistant message content', async () => {
    render(<Chat />);
    await waitFor(() => screen.getByText('Hello from AI'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy message' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Hello from AI'));
  });
});
