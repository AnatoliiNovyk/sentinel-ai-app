import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import CommandPalette from '../CommandPalette';

// jsdom does not implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn() as typeof Element.prototype.scrollIntoView;

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('CommandPalette — rendering', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('renders nothing when open=false', () => {
    const { container } = render(
      <CommandPalette open={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog when open=true', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders search input placeholder', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText(/search pages/i)).toBeInTheDocument();
  });

  it('renders navigation items (Dashboard, AI Assistant, Settings)', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});

describe('CommandPalette — filtering', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('filters items when typing in search', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search pages/i), {
      target: { value: 'compliance' },
    });
    expect(screen.getByText('Compliance')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('shows "No results" when no match', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search pages/i), {
      target: { value: 'xyzxyzxyz' },
    });
    expect(screen.getByText(/no results/i)).toBeInTheDocument();
  });

  it('can filter by keyword (nmap → Active Recon)', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search pages/i), {
      target: { value: 'nmap' },
    });
    expect(screen.getByText('Active Recon')).toBeInTheDocument();
  });
});

describe('CommandPalette — keyboard', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('calls onClose when Escape is pressed on the input', () => {
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);
    fireEvent.keyDown(screen.getByPlaceholderText(/search pages/i), {
      key: 'Escape',
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('navigates and closes on Enter key (first item)', () => {
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);
    fireEvent.keyDown(screen.getByPlaceholderText(/search pages/i), {
      key: 'Enter',
    });
    expect(mockNavigate).toHaveBeenCalledWith('/');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('clicking backdrop calls onClose', () => {
    const onClose = vi.fn();
    const { container } = render(
      <CommandPalette open={true} onClose={onClose} />
    );
    // Click the outermost backdrop div
    fireEvent.click(container.firstChild as HTMLElement);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
