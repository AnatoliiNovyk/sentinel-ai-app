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

  it('sets dialog aria attributes for accessibility', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Command palette');
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

  it('can filter by generic keyword (home → Dashboard)', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search pages/i), {
      target: { value: 'home' },
    });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('AI Assistant')).not.toBeInTheDocument();
  });

  it('can filter by description text', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search pages/i), {
      target: { value: 'preferences' },
    });
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('shows singular footer count when exactly one result matches', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search pages/i), {
      target: { value: 'nmap' },
    });
    expect(screen.getByText('1 result')).toBeInTheDocument();
  });

  it('shows plural footer count when multiple results match', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search pages/i), {
      target: { value: 'a' },
    });
    expect(screen.getByText(/\d+ results/)).toBeInTheDocument();
  });

  it('shows exact no-results message with the current query', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search pages/i), {
      target: { value: 'xyzxyzxyz' },
    });
    expect(screen.getByText('No results for "xyzxyzxyz"')).toBeInTheDocument();
  });

  it('trims surrounding spaces in search query before filtering', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search pages/i), {
      target: { value: '   compliance   ' },
    });

    expect(screen.getByText('Compliance')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });
});

describe('CommandPalette — item click navigation', () => {
  beforeEach(() => mockNavigate.mockClear());

  const navigationItems = [
    { label: 'AI Assistant', path: '/chat' },
    { label: 'Projects', path: '/projects' },
    { label: 'Scans', path: '/scans' },
    { label: 'Reports', path: '/reports' },
    { label: 'Compliance', path: '/compliance' },
    { label: 'Scheduler', path: '/scheduler' },
    { label: 'Attack Surface Map', path: '/attack-map' },
    { label: 'OSINT Analyzer', path: '/dark-web' },
    { label: 'Active Recon', path: '/recon' },
    { label: 'Supply Chain', path: '/supply-chain' },
    { label: 'AI Red Team', path: '/kill-chain' },
    { label: 'Integrations', path: '/integrations' },
    { label: 'API & CLI', path: '/api' },
    { label: 'Settings', path: '/settings' },
  ];

  it.each(navigationItems)('clicking "$label" navigates to $path', ({ label, path }) => {
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText(label));
    expect(mockNavigate).toHaveBeenCalledWith(path);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('mouseEnter on item updates active index', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    const scansBtn = screen.getByText('Scans').closest('button')!;
    fireEvent.mouseEnter(scansBtn);
    // No error; highlight changes
    expect(scansBtn).toBeInTheDocument();
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

  it('clicking inside dialog content does not call onClose', () => {
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);

    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ArrowDown moves active index down and Enter navigates to second item', () => {
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);
    const input = screen.getByPlaceholderText(/search pages/i);
    // Move down from first item to second
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    // Enter on second item — should navigate (not to '/')
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockNavigate).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('ArrowUp does not go below zero index', () => {
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);
    const input = screen.getByPlaceholderText(/search pages/i);
    // ArrowUp from 0 stays at 0
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('ArrowDown then ArrowUp returns to first item', () => {
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);
    const input = screen.getByPlaceholderText(/search pages/i);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });
    // Should be back to first item = '/'
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('Enter does nothing when there are no filtered results', () => {
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);
    const input = screen.getByPlaceholderText(/search pages/i);

    fireEvent.change(input, {
      target: { value: 'definitely-no-match' },
    });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
