import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
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

describe('PresenceAvatars — branch coverage (c8 ignore paths)', () => {
  it('shows "1 viewing" for a single member', () => {
    mockGetMembersViewing.mockReturnValue([
      { id: 'p-1', user_id: 'zara0001', context_type: 'project', context_id: 'proj-1' },
    ]);
    render(<PresenceAvatars contextType="project" contextId="proj-1" />);
    expect(screen.getByText('1 viewing')).toBeInTheDocument();
    expect(screen.getByText('Z')).toBeInTheDocument();
  });

  it('renders avatar title attribute with first 8 chars of user_id', () => {
    mockGetMembersViewing.mockReturnValue([
      { id: 'p-1', user_id: 'abcdefghijk', context_type: 'project', context_id: 'proj-1' },
    ]);
    render(<PresenceAvatars contextType="project" contextId="proj-1" />);
    expect(screen.getByTitle('User abcdefgh')).toBeInTheDocument();
  });

  it('cycles AVATAR_COLORS via modulo when 9+ members are present', () => {
    // 9 members → idx 8 wraps around to color index 0 (bg-red-500)
    const members = Array.from({ length: 9 }, (_, i) => ({
      id: `p-${i}`,
      user_id: `user${i.toString().padStart(4, '0')}`,
      context_type: 'project' as const,
      context_id: 'proj-1',
    }));
    mockGetMembersViewing.mockReturnValue(members);
    render(<PresenceAvatars contextType="project" contextId="proj-1" />);
    expect(screen.getByText('9 viewing')).toBeInTheDocument();
    // All 9 avatars rendered — first avatar initial 'U' appears 9 times
    expect(screen.getAllByText('U')).toHaveLength(9);
  });

  it('works with contextType="report"', () => {
    mockGetMembersViewing.mockReturnValue([
      { id: 'p-1', user_id: 'reportuser', context_type: 'report', context_id: 'rpt-42' },
    ]);
    render(<PresenceAvatars contextType="report" contextId="rpt-42" />);
    expect(screen.getByText('1 viewing')).toBeInTheDocument();
    expect(mockGetMembersViewing).toHaveBeenCalledWith('report', 'rpt-42');
  });

  it('renders ping animation dot indicator', () => {
    mockGetMembersViewing.mockReturnValue([
      { id: 'p-1', user_id: 'alice123', context_type: 'project', context_id: 'proj-1' },
    ]);
    const { container } = render(
      <PresenceAvatars contextType="project" contextId="proj-1" />
    );
    // Check for animate-ping span (animated dot)
    const pingSpan = container.querySelector('span.animate-ping');
    expect(pingSpan).toBeInTheDocument();
    expect(pingSpan?.classList.contains('bg-emerald-400')).toBe(true);
  });

  it('applies correct avatar color classes for multiple members', () => {
    // Create 4 members to verify color cycling
    mockGetMembersViewing.mockReturnValue([
      { id: 'p-1', user_id: 'alice123', context_type: 'project', context_id: 'proj-1' },
      { id: 'p-2', user_id: 'bob456', context_type: 'project', context_id: 'proj-1' },
      { id: 'p-3', user_id: 'carol789', context_type: 'project', context_id: 'proj-1' },
      { id: 'p-4', user_id: 'diana012', context_type: 'project', context_id: 'proj-1' },
    ]);
    const { container } = render(
      <PresenceAvatars contextType="project" contextId="proj-1" />
    );
    // Get all avatar div elements
    const avatars = container.querySelectorAll('.rounded-full.flex.items-center');
    // Each avatar should have a color class
    expect(avatars.length).toBe(4);
    const colorClasses = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500'];
    avatars.forEach((avatar, idx) => {
      expect(avatar.classList.contains(colorClasses[idx % colorClasses.length])).toBe(true);
    });
  });

  it('renders initials for members with different user_id patterns', () => {
    mockGetMembersViewing.mockReturnValue([
      { id: 'p-1', user_id: 'x_user_001', context_type: 'project', context_id: 'proj-1' },
      { id: 'p-2', user_id: '9trailing', context_type: 'project', context_id: 'proj-1' },
    ]);
    render(<PresenceAvatars contextType="project" contextId="proj-1" />);
    // First avatar should show 'X' (first letter of 'x_user_001')
    expect(screen.getByText('X')).toBeInTheDocument();
    // Second avatar should show '9' (first letter of '9trailing')
    expect(screen.getByText('9')).toBeInTheDocument();
  });
});
