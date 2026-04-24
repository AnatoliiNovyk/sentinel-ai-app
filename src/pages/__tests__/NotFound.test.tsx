import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NotFound from '../NotFound';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
}));

describe('NotFound', () => {
  it('renders "404" heading', () => {
    render(<NotFound />);
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('renders "The page you are looking for" description', () => {
    render(<NotFound />);
    expect(screen.getByText(/The page you are looking for/i)).toBeInTheDocument();
  });

  it('renders "Return to Base" link', () => {
    render(<NotFound />);
    expect(screen.getByRole('link', { name: /Return to Base/i })).toBeInTheDocument();
  });

  it('"Return to Base" link points to "/"', () => {
    render(<NotFound />);
    const link = screen.getByRole('link', { name: /Return to Base/i });
    expect(link).toHaveAttribute('href', '/');
  });

  it('renders "neutralized or does not exist" text', () => {
    render(<NotFound />);
    expect(screen.getByText(/neutralized or does not exist/i)).toBeInTheDocument();
  });
});
