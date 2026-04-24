import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PublicReport from '../PublicReport';

const { mockMaybeSingle } = vi.hoisted(() => ({
  mockMaybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: mockMaybeSingle,
          }),
        }),
      }),
    }),
  },
}));

describe('PublicReport', () => {
  it('shows loading state initially', () => {
    mockMaybeSingle.mockReturnValue(new Promise(() => {})); // never resolves
    render(<PublicReport token="abc123" />);
    expect(screen.getByText(/Loading shared report/i)).toBeInTheDocument();
  });

  it('shows "Report not available" when token not found', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    render(<PublicReport token="bad-token" />);
    await waitFor(() =>
      expect(screen.getByText('Report not available')).toBeInTheDocument(),
    );
  });

  it('shows "revoked or never existed" message for missing report', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    render(<PublicReport token="bad-token" />);
    await waitFor(() =>
      expect(screen.getByText(/revoked or never existed/i)).toBeInTheDocument(),
    );
  });

  it('renders report title and Sentinel AI branding when found', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'r-1',
        title: 'Executive Security Report',
        content: '## Summary\nAll clear.',
        kind: 'executive',
        is_public: true,
        share_token: 'abc123',
        created_at: '2026-04-24T00:00:00Z',
        user_id: 'user-1',
        project_id: 'p-1',
      },
      error: null,
    });
    render(<PublicReport token="abc123" />);
    await waitFor(() =>
      expect(screen.getByText('Executive Security Report')).toBeInTheDocument(),
    );
    expect(screen.getByText('Sentinel AI')).toBeInTheDocument();
    expect(screen.getByText('Shared report')).toBeInTheDocument();
  });

  it('renders "Markdown" download button when report found', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'r-1',
        title: 'Test Report',
        content: '## Test',
        kind: 'executive',
        is_public: true,
        share_token: 'abc123',
        created_at: '2026-04-24T00:00:00Z',
        user_id: 'user-1',
        project_id: 'p-1',
      },
      error: null,
    });
    render(<PublicReport token="abc123" />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /markdown/i })).toBeInTheDocument(),
    );
  });
});
