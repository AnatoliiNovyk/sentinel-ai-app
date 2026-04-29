import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

describe('Landing — handleSubscribe & FAQ', () => {
  it('shows success message after valid email subscription', async () => {
    render(<Landing />);
    const emailInput = screen.getByPlaceholderText(/enter your email/i);
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.submit(emailInput.closest('form')!);
    await waitFor(() =>
      expect(screen.getByText(/thanks for subscribing/i)).toBeInTheDocument(),
    );
  });

  it('does not subscribe with invalid email', () => {
    render(<Landing />);
    const emailInput = screen.getByPlaceholderText(/enter your email/i);
    fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
    fireEvent.submit(emailInput.closest('form')!);
    // No success message should appear
    expect(screen.queryByText(/subscribed|thank you/i)).not.toBeInTheDocument();
  });

  it('opens FAQ answer when question clicked', async () => {
    render(<Landing />);
    const faqQuestion = screen.getByText(/What is Sentinel AI\?/i);
    fireEvent.click(faqQuestion);
    await waitFor(() =>
      expect(screen.getByText(/autonomous threat exposure/i)).toBeVisible(),
    );
  });

  it('closes FAQ answer when same question clicked again', async () => {
    render(<Landing />);
    const faqQuestion = screen.getByText(/What is Sentinel AI\?/i);
    fireEvent.click(faqQuestion);
    await waitFor(() =>
      expect(screen.getByText(/autonomous threat exposure/i)).toBeInTheDocument(),
    );
    fireEvent.click(faqQuestion);
    // Answer is conditionally rendered — should be removed from DOM
    await waitFor(() =>
      expect(screen.queryByText(/autonomous threat exposure/i)).not.toBeInTheDocument(),
    );
  });
});
