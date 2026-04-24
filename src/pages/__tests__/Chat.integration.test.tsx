import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '../../lib/errors';
import Chat from '../Chat';

const { mockRunAgent, mockGetProjects, mockDispatchChatTask, mockPollForResult, authValue } = vi.hoisted(() => ({
  mockRunAgent: vi.fn(),
  mockGetProjects: vi.fn(),
  mockDispatchChatTask: vi.fn(),
  mockPollForResult: vi.fn(),
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

vi.mock('../../api/scans.service', () => ({
  ScansService: {
    getProjects: mockGetProjects,
  },
}));

vi.mock('../../lib/agentTools', () => ({
  runAgent: mockRunAgent,
  TOOL_LABELS: {
    list_projects: 'Listed projects',
  },
}));

vi.mock('../../api/ai.service', () => ({
  AiService: {
    dispatchChatTask: mockDispatchChatTask,
    pollForResult: mockPollForResult,
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
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });

    vi.clearAllMocks();
    conversations = [];
    messages = [];
    convoIdCounter = 1;
    msgIdCounter = 1;

    mockGetProjects.mockResolvedValue([{ id: 'project-1', name: 'Main project' }]);
    mockRunAgent.mockResolvedValue({
      content: 'Agent response ready',
      toolCalls: [{ name: 'list_projects', ok: true, summary: 'ok' }],
    });
    mockDispatchChatTask.mockResolvedValue({ ok: true, data: 'job-1' });
    mockPollForResult.mockResolvedValue({ ok: true, data: { description: 'AI polling response' } });
  });

  it('sends suggestion and persists user+assistant messages via agent path', async () => {
    render(<Chat />);

    await waitFor(() => expect(mockGetProjects).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'List my open findings' }));

    await waitFor(() => expect(mockRunAgent).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Agent response ready')).toBeInTheDocument());

    expect(screen.getAllByText('List my open findings').length).toBeGreaterThan(0);
  });

  it('renders assistant response from polling after dispatch success', async () => {
    mockRunAgent.mockResolvedValueOnce(null);
    mockDispatchChatTask.mockResolvedValueOnce({ ok: true, data: 'job-2' });
    mockPollForResult.mockResolvedValueOnce({
      ok: true,
      data: { description: 'Recovered answer after retry' },
    });

    render(<Chat />);
    await waitFor(() => expect(mockGetProjects).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Check compliance status' }));

    await waitFor(() => expect(mockDispatchChatTask).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockPollForResult).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('Recovered answer after retry')).toBeInTheDocument());
  });

  it('renders timeout error message when polling times out', async () => {
    mockRunAgent.mockResolvedValueOnce(null);
    mockDispatchChatTask.mockResolvedValueOnce({ ok: true, data: 'job-timeout' });
    mockPollForResult.mockResolvedValueOnce({
      ok: false,
      error: {
        code: ErrorCode.AI_PROCESSING_TIMEOUT,
        message: 'timed out',
        timestamp: new Date().toISOString(),
      },
    });

    render(<Chat />);
    await waitFor(() => expect(mockGetProjects).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Generate an executive summary' }));

    await waitFor(() => expect(mockDispatchChatTask).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockPollForResult).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByText('Error: AI processing timed out. Please try again.')).toBeInTheDocument(),
    );
  });

  it('shows retrying label while polling reports transient retry', async () => {
    mockRunAgent.mockResolvedValueOnce(null);
    mockDispatchChatTask.mockResolvedValueOnce({ ok: true, data: 'job-retry-ui' });

    let releasePoll!: () => void;
    const pollPromise = new Promise<void>((resolve) => {
      releasePoll = () => resolve();
    });

    mockPollForResult.mockImplementationOnce(
      async (_scanId, _startTime, onProgress?: (p: { status: string }) => void) => {
        onProgress?.({ status: 'retrying' });
        await pollPromise;
        return { ok: true, data: { description: 'Recovered after retry loop' } };
      },
    );

    render(<Chat />);
    await waitFor(() => expect(mockGetProjects).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'SLA status — what is overdue?' }));

    await waitFor(() => expect(screen.getByText(/Retrying after transient error/)).toBeInTheDocument());
    releasePoll();
    await waitFor(() => expect(screen.getByText('Recovered after retry loop')).toBeInTheDocument());
  });
});
