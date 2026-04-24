import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ApiDocs from '../ApiDocs';

const { mockClipboardWriteText } = vi.hoisted(() => ({
  mockClipboardWriteText: vi.fn().mockResolvedValue(undefined),
}));

Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: mockClipboardWriteText },
  writable: true,
  configurable: true,
});

describe('ApiDocs', () => {
  beforeEach(() => {
    mockClipboardWriteText.mockReset();
    mockClipboardWriteText.mockResolvedValue(undefined);
  });

  it('renders "REST API & CLI" heading', () => {
    render(<ApiDocs />);
    expect(screen.getByText('REST API & CLI')).toBeInTheDocument();
  });

  it('renders description about programmatic access', () => {
    render(<ApiDocs />);
    expect(screen.getByText(/Programmatic access to Sentinel AI/i)).toBeInTheDocument();
  });

  it('renders authentication info banner', () => {
    render(<ApiDocs />);
    expect(screen.getByText(/Personal Access Token/i)).toBeInTheDocument();
  });

  it('renders "Start a Scan (REST API)" section', () => {
    render(<ApiDocs />);
    expect(screen.getByText(/Start a Scan/i)).toBeInTheDocument();
  });

  it('renders "Sentinel CLI" section', () => {
    render(<ApiDocs />);
    expect(screen.getByText(/Sentinel CLI/i)).toBeInTheDocument();
  });

  it('renders cURL code block with POST endpoint', () => {
    render(<ApiDocs />);
    expect(screen.getByText(/POST \/scan-dispatch/i)).toBeInTheDocument();
  });

  it('clicking "Copy cURL" copies to clipboard', async () => {
    render(<ApiDocs />);
    const btn = screen.getByRole('button', { name: /copy curl/i });
    fireEvent.click(btn);
    expect(mockClipboardWriteText).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText(/Copied/i)).toBeInTheDocument());
  });
});
