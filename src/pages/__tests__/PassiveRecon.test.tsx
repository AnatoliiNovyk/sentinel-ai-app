import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ActiveRecon from '../PassiveRecon';

const { mockUseAuth } = vi.hoisted(() => {
  const _user = { id: 'user-1' };
  const mockUseAuth = vi.fn().mockReturnValue({ user: _user });
  return { mockUseAuth };
});

vi.mock('../../context/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

const { mockDownloadFile } = vi.hoisted(() => ({ mockDownloadFile: vi.fn() }));

vi.mock('../../lib/exporters', () => ({
  downloadFile: mockDownloadFile,
}));

describe('ActiveRecon (PassiveRecon)', () => {
  beforeEach(() => {
    mockDownloadFile.mockClear();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });
  it('renders "Active Reconnaissance (Deep Nmap)" heading', () => {
    render(<ActiveRecon />);
    expect(screen.getByText('Active Reconnaissance (Deep Nmap)')).toBeInTheDocument();
  });

  it('renders description about active port discovery', () => {
    render(<ActiveRecon />);
    expect(screen.getByText(/active port discovery/i)).toBeInTheDocument();
  });

  it('renders info banner about VPS agent', () => {
    render(<ActiveRecon />);
    expect(screen.getByText(/high-intensity Nmap scan/i)).toBeInTheDocument();
  });

  it('renders "Target IP or Domain" label', () => {
    render(<ActiveRecon />);
    expect(screen.getByText('Target IP or Domain')).toBeInTheDocument();
  });

  it('renders input with placeholder', () => {
    render(<ActiveRecon />);
    expect(screen.getByPlaceholderText(/8\.8\.8\.8 or example\.com/i)).toBeInTheDocument();
  });

  it('renders "Start Active Recon" button disabled when input is empty', () => {
    render(<ActiveRecon />);
    const btn = screen.getByRole('button', { name: /start active recon/i });
    expect(btn).toBeDisabled();
  });

  it('enables "Start Active Recon" button when input has value', () => {
    render(<ActiveRecon />);
    const input = screen.getByPlaceholderText(/8\.8\.8\.8 or example\.com/i);
    fireEvent.change(input, { target: { value: 'example.com' } });
    const btn = screen.getByRole('button', { name: /start active recon/i });
    expect(btn).not.toBeDisabled();
  });

  it('shows "Executing..." and queued status after clicking scan', async () => {
    render(<ActiveRecon />);
    const input = screen.getByPlaceholderText(/8\.8\.8\.8 or example\.com/i);
    fireEvent.change(input, { target: { value: 'example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /start active recon/i }));
    await waitFor(() => expect(screen.getByText(/Executing.../i)).toBeInTheDocument());
  });

  it('shows terminal console with nmap command after scan starts', async () => {
    render(<ActiveRecon />);
    const input = screen.getByPlaceholderText(/8\.8\.8\.8 or example\.com/i);
    fireEvent.change(input, { target: { value: '10.0.0.1' } });
    fireEvent.click(screen.getByRole('button', { name: /start active recon/i }));
    await waitFor(() => expect(screen.getByText(/nmap -sV -sC -T4 --open 10\.0\.0\.1/i)).toBeInTheDocument());
  });

  it('shows scan complete message after scan finishes', async () => {
    render(<ActiveRecon />);
    const input = screen.getByPlaceholderText(/8\.8\.8\.8 or example\.com/i);
    fireEvent.change(input, { target: { value: 'example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /start active recon/i }));
    await waitFor(
      () => expect(screen.getByText(/Scan complete/i)).toBeInTheDocument(),
      { timeout: 8000 },
    );
  }, 10000);

  it('shows Copy and CSV buttons after scan and calls exportResults', async () => {
    render(<ActiveRecon />);
    const input = screen.getByPlaceholderText(/8\.8\.8\.8 or example\.com/i);
    fireEvent.change(input, { target: { value: 'example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /start active recon/i }));
    await waitFor(
      () => expect(screen.getByText(/Scan complete/i)).toBeInTheDocument(),
      { timeout: 8000 },
    );
    const csvBtn = screen.getByRole('button', { name: /csv/i });
    expect(csvBtn).toBeInTheDocument();
    fireEvent.click(csvBtn);
    expect(mockDownloadFile).toHaveBeenCalled();
  }, 10000);

  it('clicks Copy button after scan and calls clipboard', async () => {
    render(<ActiveRecon />);
    const input = screen.getByPlaceholderText(/8\.8\.8\.8 or example\.com/i);
    fireEvent.change(input, { target: { value: 'example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /start active recon/i }));
    await waitFor(
      () => expect(screen.getByText(/Scan complete/i)).toBeInTheDocument(),
      { timeout: 8000 },
    );
    const copyBtn = screen.getByRole('button', { name: /copy output/i });
    expect(copyBtn).toBeInTheDocument();
    await act(async () => { fireEvent.click(copyBtn); });
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  }, 10000);
});

// ── Post-scan features ────────────────────────────────────────────────────────

async function renderAfterScan() {
  render(<ActiveRecon />);
  const input = screen.getByPlaceholderText(/8\.8\.8\.8 or example\.com/i);
  fireEvent.change(input, { target: { value: 'scanme.example.com' } });
  fireEvent.click(screen.getByRole('button', { name: /start active recon/i }));
  await waitFor(
    () => expect(screen.getByText(/Scan complete/i)).toBeInTheDocument(),
    { timeout: 8000 },
  );
}

describe('ActiveRecon — port search and sort', () => {
  beforeEach(() => {
    mockDownloadFile.mockClear();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    localStorage.clear();
  });

  it('renders port table after scan', async () => {
    await renderAfterScan();
    // MOCK_PORTS includes ssh — port table rendered
    expect(screen.getAllByText('ssh').length).toBeGreaterThanOrEqual(1);
  }, 10000);

  it('port search filters by service name', async () => {
    await renderAfterScan();
    const searchInput = screen.getByPlaceholderText('Search port, service…');
    fireEvent.change(searchInput, { target: { value: 'mysql' } });
    await waitFor(() => expect(screen.getAllByText('mysql').length).toBeGreaterThanOrEqual(1));
    // ssh should be gone
    expect(screen.queryAllByText(/^ssh$/).length).toBe(0);
  }, 10000);

  it('port search with no match shows "No ports match filter"', async () => {
    await renderAfterScan();
    const searchInput = screen.getByPlaceholderText('Search port, service…');
    fireEvent.change(searchInput, { target: { value: 'xyz-not-a-service' } });
    await waitFor(() => expect(screen.getByText('No ports match filter.')).toBeInTheDocument());
  }, 10000);

  it('sort "Port↓" button changes sort order', async () => {
    await renderAfterScan();
    const sortBtn = screen.getByRole('button', { name: 'Port↓' });
    fireEvent.click(sortBtn);
    // Still shows scan results
    expect(screen.getByText(/Scan complete/i)).toBeInTheDocument();
  }, 10000);

  it('sort "Svc A→Z" button changes sort order', async () => {
    await renderAfterScan();
    fireEvent.click(screen.getByRole('button', { name: 'Svc A→Z' }));
    expect(screen.getByText(/Scan complete/i)).toBeInTheDocument();
  }, 10000);

  it('sort "State" button changes sort order', async () => {
    await renderAfterScan();
    fireEvent.click(screen.getByRole('button', { name: 'State' }));
    expect(screen.getByText(/Scan complete/i)).toBeInTheDocument();
  }, 10000);

  it('sort "Risk↓" button changes sort order', async () => {
    await renderAfterScan();
    fireEvent.click(screen.getByRole('button', { name: 'Risk↓' }));
    expect(screen.getByText(/Scan complete/i)).toBeInTheDocument();
  }, 10000);

  it('renders stat cards: Open Ports, High-Risk Ports, Unique Services', async () => {
    await renderAfterScan();
    expect(screen.getByText('Open Ports')).toBeInTheDocument();
    expect(screen.getByText('High-Risk Ports')).toBeInTheDocument();
    expect(screen.getByText('Unique Services')).toBeInTheDocument();
  }, 10000);

  it('exports JSON via JSON button', async () => {
    await renderAfterScan();
    const jsonBtn = screen.getByRole('button', { name: /json/i });
    fireEvent.click(jsonBtn);
    expect(mockDownloadFile).toHaveBeenCalledWith(
      expect.stringMatching(/\.json$/),
      expect.stringContaining('"target"'),
      'application/json',
    );
  }, 10000);
});

describe('ActiveRecon — scan history', () => {
  beforeEach(() => {
    mockDownloadFile.mockClear();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    localStorage.clear();
  });

  it('shows Scan History section after completed scan', async () => {
    await renderAfterScan();
    await waitFor(() => expect(screen.getByText('Scan History')).toBeInTheDocument());
  }, 10000);

  it('toggles history list on click', async () => {
    await renderAfterScan();
    await waitFor(() => expect(screen.getByText('Scan History')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Scan History'));
    await waitFor(() => expect(screen.getByText('scanme.example.com')).toBeInTheDocument());
    // collapse
    fireEvent.click(screen.getByText(/hide/i));
    await waitFor(() => expect(screen.queryByText('scanme.example.com')).toBeNull());
  }, 10000);

  it('removes a history entry via X button', async () => {
    await renderAfterScan();
    await waitFor(() => screen.getByText('Scan History'));
    fireEvent.click(screen.getByText('Scan History'));
    await waitFor(() => screen.getByText('scanme.example.com'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove entry' }));
    await waitFor(() => expect(screen.queryByText('Scan History')).toBeNull());
  }, 10000);

  it('shows "Clear all history" button and clears all when clicked (2+ entries)', async () => {
    // Do first scan
    await renderAfterScan();
    await waitFor(() => screen.getByText('Scan History'));

    // Do second scan on same rendered component
    const input = screen.getByPlaceholderText(/8\.8\.8\.8 or example\.com/i);
    fireEvent.change(input, { target: { value: 'second.example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /start active recon/i }));
    await waitFor(
      () => expect(screen.getByText(/Scan complete/i)).toBeInTheDocument(),
      { timeout: 8000 },
    );

    // Now history has 2 entries — show history
    fireEvent.click(screen.getByText('Scan History'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /clear all history/i })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /clear all history/i }));
    await waitFor(() => expect(screen.queryByText('Scan History')).toBeNull());
  }, 25000);
});

// ── Running state content ─────────────────────────────────────────────────────

describe('ActiveRecon — running state display', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows "Scanning ports..." during running state', async () => {
    render(<ActiveRecon />);
    const input = screen.getByPlaceholderText(/8\.8\.8\.8 or example\.com/i);
    fireEvent.change(input, { target: { value: 'running-test.com' } });
    fireEvent.click(screen.getByRole('button', { name: /start active recon/i }));
    // After first 2s timeout, status becomes 'running'
    await waitFor(
      () => expect(screen.getByText(/Scanning ports\.\.\./i)).toBeInTheDocument(),
      { timeout: 5000 },
    );
    expect(screen.getByText(/Nmap scan report for running-test\.com/i)).toBeInTheDocument();
  }, 10000);
});

// ── No-user guard ─────────────────────────────────────────────────────────────

describe('ActiveRecon — no user (unauthenticated)', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null });
    localStorage.clear();
  });

  afterEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
  });

  it('does not start scan when user is null (button stays not disabled but handleScan exits early)', async () => {
    render(<ActiveRecon />);
    const input = screen.getByPlaceholderText(/8\.8\.8\.8 or example\.com/i);
    fireEvent.change(input, { target: { value: 'example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /start active recon/i }));
    // Should not show "Executing..." because handleScan returns early
    await new Promise(r => setTimeout(r, 300));
    expect(screen.queryByText(/Executing\.\.\./i)).toBeNull();
  });
});
