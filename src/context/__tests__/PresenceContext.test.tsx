/**
 * Unit tests for src/context/PresenceContext.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';

// Override the global setup.ts mock so we can test the real implementation
vi.unmock('../PresenceContext');
vi.unmock('../../context/PresenceContext');

// ─── Mock useAuth ─────────────────────────────────────────────────────────────

const mockUseAuth = vi.fn();

vi.mock('../useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// ─── Mock Supabase ────────────────────────────────────────────────────────────

const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockSubscribe = vi.fn().mockReturnValue({ unsubscribe: vi.fn() });
const mockOn = vi.fn().mockReturnThis();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table.startsWith('presence')) {
        return { upsert: mockUpsert };
      }
      return {};
    },
    channel: (..._args: unknown[]) => ({
      on: mockOn,
      subscribe: mockSubscribe,
    }),
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

import { PresenceProvider, usePresence } from '../PresenceContext';

function TestConsumer({ onResult }: { onResult: (v: ReturnType<typeof usePresence>) => void }) {
  const presence = usePresence();
  onResult(presence);
  return <div data-testid="consumer">ok</div>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('usePresence', () => {
  it('throws when used outside PresenceProvider', () => {
    const BadComponent = () => {
      usePresence();
      return null;
    };
    expect(() => render(<BadComponent />)).toThrow('usePresence must be used within PresenceProvider');
  });
});

describe('PresenceProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOn.mockReturnThis();
    mockSubscribe.mockReturnValue({ unsubscribe: vi.fn() });

    mockUseAuth.mockReturnValue({
      user: null,
      profile: null,
      organizations: [],
    });
  });

  it('renders children', () => {
    render(
      <PresenceProvider>
        <div data-testid="child">content</div>
      </PresenceProvider>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('getMembersViewing returns empty array for unknown context key', () => {
    let captured: ReturnType<typeof usePresence> | undefined;

    render(
      <PresenceProvider>
        <TestConsumer onResult={(v) => { captured = v; }} />
      </PresenceProvider>
    );

    expect(captured).toBeDefined();
    const members = captured!.getMembersViewing('project', 'proj-unknown');
    expect(members).toEqual([]);
  });

  it('updatePresence does nothing when user is null', async () => {
    mockUseAuth.mockReturnValue({ user: null, profile: null, organizations: [] });

    let captured: ReturnType<typeof usePresence> | undefined;

    render(
      <PresenceProvider>
        <TestConsumer onResult={(v) => { captured = v; }} />
      </PresenceProvider>
    );

    await act(async () => {
      await captured!.updatePresence('project', 'proj-1');
    });

    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('updatePresence calls supabase upsert when user/profile/orgs are present', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      profile: { id: 'user-1' },
      organizations: [{ id: 'org-1' }],
    });

    let captured: ReturnType<typeof usePresence> | undefined;

    render(
      <PresenceProvider>
        <TestConsumer onResult={(v) => { captured = v; }} />
      </PresenceProvider>
    );

    await act(async () => {
      await captured!.updatePresence('project', 'proj-1');
    });

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ context_type: 'project', context_id: 'proj-1' }),
        expect.objectContaining({ onConflict: expect.any(String) })
      );
    });
  });

  it('unsubscribes old subscription when updatePresence is called again', async () => {
    const mockUnsubscribe1 = vi.fn();
    mockSubscribe
      .mockReturnValueOnce({ unsubscribe: mockUnsubscribe1 })
      .mockReturnValue({ unsubscribe: vi.fn() });

    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      profile: { id: 'user-1' },
      organizations: [{ id: 'org-1' }],
    });

    let captured: ReturnType<typeof usePresence> | undefined;
    render(
      <PresenceProvider>
        <TestConsumer onResult={(v) => { captured = v; }} />
      </PresenceProvider>
    );

    // First call creates subscription
    await act(async () => {
      await captured!.updatePresence('project', 'proj-1');
    });

    // Second call should unsubscribe the first subscription
    await act(async () => {
      await captured!.updatePresence('project', 'proj-2');
    });

    expect(mockUnsubscribe1).toHaveBeenCalled();
  });

  it('updates activePresence when on("*") callback fires for matching context', async () => {
    let capturedOnCallback: ((payload: { new: unknown }) => void) | null = null;

    mockOn.mockImplementation(function (this: unknown, _eventType: string, _filter: unknown, cb: (payload: { new: unknown }) => void) {
      capturedOnCallback = cb;
      return this;
    });

    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      profile: { id: 'user-1' },
      organizations: [{ id: 'org-1' }],
    });

    let captured: ReturnType<typeof usePresence> | undefined;
    render(
      <PresenceProvider>
        <TestConsumer onResult={(v) => { captured = v; }} />
      </PresenceProvider>
    );

    await act(async () => {
      await captured!.updatePresence('project', 'proj-1');
    });

    expect(capturedOnCallback).not.toBeNull();

    // Fire the realtime callback with a matching presence record
    await act(async () => {
      capturedOnCallback!({
        new: {
          context_type: 'project',
          context_id: 'proj-1',
          user_id: 'user-2',
          last_seen_at: new Date().toISOString(),
        },
      });
    });

    const members = captured!.getMembersViewing('project', 'proj-1');
    expect(members.length).toBeGreaterThanOrEqual(1);
    expect(members.some((m) => m.user_id === 'user-2')).toBe(true);
  });

  it('on("*") callback does not update state for non-matching context', async () => {
    let capturedOnCallback: ((payload: { new: unknown }) => void) | null = null;

    mockOn.mockImplementation(function (this: unknown, _eventType: string, _filter: unknown, cb: (payload: { new: unknown }) => void) {
      capturedOnCallback = cb;
      return this;
    });

    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      profile: { id: 'user-1' },
      organizations: [{ id: 'org-1' }],
    });

    let captured: ReturnType<typeof usePresence> | undefined;
    render(
      <PresenceProvider>
        <TestConsumer onResult={(v) => { captured = v; }} />
      </PresenceProvider>
    );

    await act(async () => {
      await captured!.updatePresence('project', 'proj-1');
    });

    // Fire callback with DIFFERENT context
    await act(async () => {
      capturedOnCallback!({
        new: {
          context_type: 'scan',
          context_id: 'scan-999',
          user_id: 'user-3',
          last_seen_at: new Date().toISOString(),
        },
      });
    });

    // proj-1 should still be empty since the event was for a different context
    const members = captured!.getMembersViewing('project', 'proj-1');
    expect(members).toHaveLength(0);
  });

  it('heartbeat fires updatePresence after 30s when presenceRef is set', async () => {
    vi.useFakeTimers();

    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      profile: { id: 'user-1' },
      organizations: [{ id: 'org-1' }],
    });

    let captured: ReturnType<typeof usePresence> | undefined;
    const { rerender } = render(
      <PresenceProvider>
        <TestConsumer onResult={(v) => { captured = v; }} />
      </PresenceProvider>
    );

    // Call updatePresence to set presenceRef.current
    await act(async () => {
      await captured!.updatePresence('project', 'proj-1');
    });

    mockUpsert.mockClear();

    // Change orgs to force updatePresence identity change → useEffect re-runs
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      profile: { id: 'user-1' },
      organizations: [{ id: 'org-1' }, { id: 'org-2' }],
    });

    await act(async () => {
      rerender(
        <PresenceProvider>
          <TestConsumer onResult={(v) => { captured = v; }} />
        </PresenceProvider>
      );
    });

    // Advance 30 seconds to trigger the heartbeat interval
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    expect(mockUpsert).toHaveBeenCalled();

    vi.useRealTimers();
  });
});
