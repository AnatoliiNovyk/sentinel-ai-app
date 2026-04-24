import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Landing from '../Landing';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
}));

describe('Landing', () => {
  it('renders "Sentinel AI" brand name', () => {
    render(<Landing />);
    const brands = screen.getAllByText('Sentinel AI');
    expect(brands.length).toBeGreaterThanOrEqual(1);
  });

  it('renders "Autonomous Security" in hero heading', () => {
    render(<Landing />);
    expect(screen.getByText(/Autonomous Security/i)).toBeInTheDocument();
  });

  it('renders "For Modern Infrastructure" in hero heading', () => {
    render(<Landing />);
    expect(screen.getByText(/For Modern Infrastructure/i)).toBeInTheDocument();
  });

  it('renders "Start Free Trial" CTA button', () => {
    render(<Landing />);
    expect(screen.getByRole('link', { name: /Start Free Trial/i })).toBeInTheDocument();
  });

  it('renders "Sign In" navigation link', () => {
    render(<Landing />);
    expect(screen.getByRole('link', { name: /Sign In/i })).toBeInTheDocument();
  });

  it('renders "Features" navigation link', () => {
    render(<Landing />);
    const links = screen.getAllByRole('link', { name: /Features/i });
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it('renders "Enterprise-Grade Security Pipeline" features section', () => {
    render(<Landing />);
    expect(screen.getByText('Enterprise-Grade Security Pipeline')).toBeInTheDocument();
  });

  it('renders feature cards: Passive Reconnaissance, AI Remediation, CI/CD Integration', () => {
    render(<Landing />);
    expect(screen.getByText('Passive Reconnaissance')).toBeInTheDocument();
    expect(screen.getByText('AI Remediation')).toBeInTheDocument();
    expect(screen.getByText('CI/CD Integration')).toBeInTheDocument();
  });

  it('renders "Dark Web Monitoring" feature card', () => {
    render(<Landing />);
    expect(screen.getByText('Dark Web Monitoring')).toBeInTheDocument();
  });
});
