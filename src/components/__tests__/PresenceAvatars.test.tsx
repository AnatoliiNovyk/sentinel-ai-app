import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import { PresenceAvatars } from '../PresenceAvatars';

// Override global PresenceContext mock to add getMembersViewing
vi.mock('../../context/PresenceContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../context/PresenceContext')>();
  return {
    ...actual,
    PresenceProvider: ({ children }: { children: unknown }) => children,
    usePresence: () => ({
      onlineUsers: [],
      currentUser: null,
      isUserOnline: () => false,
      getMembersViewing: mockGetMembersViewing,
    }),
  };
});

const mockGetMembersViewing = vi.fn();

beforeEach(() => {
  mockGetMembersViewing.mockReset();
});

describe('PresenceAvatars — rendering', () => {
  it('returns null when there are 0 members viewing', () => {
    mockGetMembersViewing.mockReturnValue([]);
    const { container } = render(
      <PresenceAvatars contextType="project" contextId="proj-1" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows "{count} viewing" text when members are present', () => {
    mockGetMembersViewing.mockReturnValue([
      { id: 'p-1', user_id: 'alice123', context_type: 'project', context_id: 'proj-1' },
      { id: 'p-2', user_id: 'bob456', context_type: 'project', context_id: 'proj-1' },
    ]);
    render(<PresenceAvatars contextType="project" contextId="proj-1" />);
    expect(screen.getByText('2 viewing')).toBeInTheDocument();
  });

  it('shows first char uppercase as avatar initial', () => {
    mockGetMembersViewing.mockReturnValue([
      { id: 'p-1', user_id: 'alice123', context_type: 'project', context_id: 'proj-1' },
    ]);
    render(<PresenceAvatars contextType="project" contextId="proj-1" />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders correct number of avatar circles', () => {
    mockGetMembersViewing.mockReturnValue([
      { id: 'p-1', user_id: 'alice123', context_type: 'project', context_id: 'proj-1' },
      { id: 'p-2', user_id: 'bob456', context_type: 'project', context_id: 'proj-1' },
      { id: 'p-3', user_id: 'carol789', context_type: 'project', context_id: 'proj-1' },
    ]);
    render(<PresenceAvatars contextType="project" contextId="proj-1" />);
    expect(screen.getByText('3 viewing')).toBeInTheDocument();
    // A, B, C initials
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('passes contextType and contextId to getMembersViewing', () => {
    mockGetMembersViewing.mockReturnValue([]);
    render(<PresenceAvatars contextType="scan" contextId="scan-99" />);
    expect(mockGetMembersViewing).toHaveBeenCalledWith('scan', 'scan-99');
  });
});
