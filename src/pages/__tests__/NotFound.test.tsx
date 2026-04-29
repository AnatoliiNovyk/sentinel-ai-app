import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NotFound from '../NotFound';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
  useNavigate: () => mockNavigate,
}));

const mockNavigate = vi.fn();

describe('NotFound', () => {
  it('renders "404" heading', () => {
    render(<NotFound />);
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('renders page evaded detection description', () => {
    render(<NotFound />);
    expect(screen.getByText(/this page has evaded detection/i)).toBeInTheDocument();
  });

  it('renders "Return to Dashboard" link', () => {
    render(<NotFound />);
    expect(screen.getByRole('link', { name: /Return to Dashboard/i })).toBeInTheDocument();
  });

  it('"Return to Dashboard" link points to "/"', () => {
    render(<NotFound />);
    const link = screen.getByRole('link', { name: /Return to Dashboard/i });
    expect(link).toHaveAttribute('href', '/');
  });

  it('renders "doesn\'t exist or has been patched" text', () => {
    render(<NotFound />);
    expect(screen.getByText(/doesn't exist or has been patched/i)).toBeInTheDocument();
  });

  it('"Go Back" button calls navigate(-1)', () => {
    mockNavigate.mockReset();
    render(<NotFound />);
    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
