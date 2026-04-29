/**
 * Unit tests for src/context/PresenceContext.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import React from 'react';

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
        return {
          upsert: mockUpsert,
          on: mockOn,
          subscribe: mockSubscribe,
        };
      }
      return {};
    },
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
});
