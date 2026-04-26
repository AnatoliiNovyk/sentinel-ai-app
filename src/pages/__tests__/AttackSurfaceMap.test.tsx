import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AttackSurfaceMap from '../AttackSurfaceMap';

const { mockEq, mockVulnsEq } = vi.hoisted(() => ({
  mockEq: vi.fn().mockResolvedValue({ data: [], error: null }),
  mockVulnsEq: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'projects') {
        return { select: () => ({ eq: mockEq }) };
      }
      return { select: () => ({ eq: mockVulnsEq }) };
    },
  },
  riskBand: vi.fn().mockReturnValue('low'),
}));

vi.mock('../../context/useAuth', () => {
  const _user = { id: 'user-1' };
  return { useAuth: () => ({ user: _user }) };
});

vi.mock('../../lib/riskScore', () => ({
  riskBand: vi.fn().mockReturnValue('low'),
}));

// Prevent requestAnimationFrame loop from running indefinitely in tests
const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 0);
vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});

describe('AttackSurfaceMap', () => {
  beforeEach(() => {
    mockEq.mockResolvedValue({ data: [], error: null });
    mockVulnsEq.mockResolvedValue({ data: [], error: null });
    rafSpy.mockImplementation(() => 0);
  });

  it('renders "Attack Surface Map" heading', async () => {
    render(<AttackSurfaceMap />);
    await waitFor(() => expect(screen.getByText('Attack Surface Map')).toBeInTheDocument());
  });

  it('renders description text', async () => {
    render(<AttackSurfaceMap />);
    await waitFor(() =>
      expect(screen.getByText(/Interactive visualization of your infrastructure/i)).toBeInTheDocument(),
    );
  });

  it('renders "Re-layout" button', async () => {
    render(<AttackSurfaceMap />);
    await waitFor(() => expect(screen.getByRole('button', { name: /re-layout/i })).toBeInTheDocument());
  });

  it('renders stat card "Projects"', async () => {
    render(<AttackSurfaceMap />);
    await waitFor(() => {
      expect(screen.getAllByText('Projects').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders stat card "Open Findings"', async () => {
    render(<AttackSurfaceMap />);
    await waitFor(() => expect(screen.getByText('Open Findings')).toBeInTheDocument());
  });

  it('renders stat card "Critical"', async () => {
    render(<AttackSurfaceMap />);
    await waitFor(() => expect(screen.getByText('Critical')).toBeInTheDocument());
  });

  it('renders stat card "High"', async () => {
    render(<AttackSurfaceMap />);
    await waitFor(() => expect(screen.getByText('High')).toBeInTheDocument());
  });

  it('renders zero value for all stats when no data', async () => {
    render(<AttackSurfaceMap />);
    await waitFor(() => {
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThanOrEqual(4);
    });
  });

  it('renders project nodes when projects are loaded', async () => {
    mockEq.mockResolvedValue({
      data: [{ id: 'p-1', name: 'Alpha', risk_score: 50 }],
      error: null,
    });
    render(<AttackSurfaceMap />);
    await waitFor(() =>
      expect(screen.getAllByText('Alpha').length).toBeGreaterThanOrEqual(1),
    );
  });

  it('clicking "Re-layout" does not throw', async () => {
    render(<AttackSurfaceMap />);
    await waitFor(() => screen.getByRole('button', { name: /re-layout/i }));
    fireEvent.click(screen.getByRole('button', { name: /re-layout/i }));
    expect(screen.getByText('Attack Surface Map')).toBeInTheDocument();
  });
});
