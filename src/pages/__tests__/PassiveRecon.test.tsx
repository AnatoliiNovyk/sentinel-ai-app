import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ActiveRecon from '../PassiveRecon';

vi.mock('../../context/useAuth', () => {
  const _user = { id: 'user-1' };
  return { useAuth: () => ({ user: _user }) };
});

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
