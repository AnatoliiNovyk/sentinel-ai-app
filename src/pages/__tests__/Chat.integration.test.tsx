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
  }, { timeout: 5000 });

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
  }, { timeout: 5000 });

  it('renders error message when gateway throws', async () => {
    mockRunAgent.mockResolvedValueOnce(null);
    mockCallAiGateway.mockRejectedValueOnce(new Error('AI processing timed out. Please try again.'));

    render(<Chat />);

    fireEvent.click(screen.getByRole('button', { name: 'Generate an executive summary' }));

    await waitFor(
      () => expect(screen.getByText('Error: AI processing timed out. Please try again.')).toBeInTheDocument(),
      { timeout: 3000 },
    );
  }, { timeout: 5000 });

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
  }, { timeout: 6000 });
});
