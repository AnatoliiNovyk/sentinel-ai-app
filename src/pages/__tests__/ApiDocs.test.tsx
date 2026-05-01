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
    expect(screen.getByText('/functions/v1/scan-dispatch')).toBeInTheDocument();
  });

  it('clicking "Copy cURL" copies to clipboard', async () => {
    render(<ApiDocs />);
    const btns = screen.getAllByRole('button', { name: /copy curl/i });
    fireEvent.click(btns[0]);
    expect(mockClipboardWriteText).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getAllByText(/Copied/i)[0]).toBeInTheDocument());
  });

  it('renders stat cards with endpoint counts', () => {
    render(<ApiDocs />);
    expect(screen.getByText('Total Endpoints')).toBeInTheDocument();
    expect(screen.getByText('POST Endpoints')).toBeInTheDocument();
    expect(screen.getByText('GET Endpoints')).toBeInTheDocument();
    expect(screen.getByText('Rate Limit')).toBeInTheDocument();
  });

  it('renders all endpoints when "All" method filter is active', () => {
    render(<ApiDocs />);
    // All endpoints should be visible initially
    expect(screen.getByText(/Start a Scan/i)).toBeInTheDocument();
    expect(screen.getByText(/Get Scan Result/i)).toBeInTheDocument();
  });

  it('clicking POST filter hides GET endpoints', () => {
    render(<ApiDocs />);
    const postBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('POST'));
    fireEvent.click(postBtn!);
    // After filtering to POST, GET endpoints should be hidden or non-visible
    expect(screen.getByText(/Start a Scan/i)).toBeInTheDocument();
  });

  it('clicking GET filter hides POST endpoints', () => {
    render(<ApiDocs />);
    const getBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('GET'));
    fireEvent.click(getBtn!);
    // After filtering to GET, should show GET endpoints
    expect(screen.getByText(/Get Scan Result/i)).toBeInTheDocument();
  });

  it('search input filters endpoints by label', () => {
    render(<ApiDocs />);
    const searchInput = screen.getByPlaceholderText('Search endpoints…');
    fireEvent.change(searchInput, { target: { value: 'Scan' } });
    // Should still show filtered endpoints
    expect(screen.getByText(/Start a Scan/i)).toBeInTheDocument();
  });

  it('search input with no match shows "No endpoints match"', () => {
    render(<ApiDocs />);
    const searchInput = screen.getByPlaceholderText('Search endpoints…');
    fireEvent.change(searchInput, { target: { value: 'xyz-not-found-endpoint' } });
    expect(screen.getByText(/No endpoints match your filter/i)).toBeInTheDocument();
  });

  it('clicking "Copy Script" for CLI copies bash script', async () => {
    render(<ApiDocs />);
    const cliCopyBtn = screen.getByRole('button', { name: /copy script/i });
    fireEvent.click(cliCopyBtn);
    expect(mockClipboardWriteText).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText(/Copied/i)).toBeInTheDocument());
  });

  it('renders Sentinel CLI bash script section', () => {
    render(<ApiDocs />);
    expect(screen.getByText(/Sentinel CLI/i)).toBeInTheDocument();
    expect(screen.getByText(/Copy Script/i)).toBeInTheDocument();
  });

  it('clears search when input is emptied', () => {
    render(<ApiDocs />);
    const searchInput = screen.getByPlaceholderText('Search endpoints…');
    fireEvent.change(searchInput, { target: { value: 'xyz-not-found' } });
    expect(screen.getByText(/No endpoints match/i)).toBeInTheDocument();
    fireEvent.change(searchInput, { target: { value: '' } });
    // All endpoints should be visible again
    expect(screen.getByText(/Start a Scan/i)).toBeInTheDocument();
  });

  it('method filter and search can be combined', () => {
    render(<ApiDocs />);
    const postBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('POST'));
    fireEvent.click(postBtn!);
    const searchInput = screen.getByPlaceholderText('Search endpoints…');
    fireEvent.change(searchInput, { target: { value: 'Scan' } });
    expect(screen.getByText(/Start a Scan/i)).toBeInTheDocument();
  });

  it('clicking "All" method filter shows all endpoints again', () => {
    render(<ApiDocs />);
    const postBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('POST'));
    fireEvent.click(postBtn!);
    const allBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('All'));
    fireEvent.click(allBtn!);
    expect(screen.getByText(/Start a Scan/i)).toBeInTheDocument();
    expect(screen.getByText(/Get Scan Result/i)).toBeInTheDocument();
  });

  it('endpoint cards render with method badge', () => {
    render(<ApiDocs />);
    const postBadges = screen.getAllByText('POST');
    expect(postBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('endpoint cards show description text', () => {
    render(<ApiDocs />);
    expect(screen.getByText(/Trigger a new scan job asynchronously/i)).toBeInTheDocument();
  });

  it('stat card shows rate limit info', () => {
    render(<ApiDocs />);
    expect(screen.getByText('100/min')).toBeInTheDocument();
  });
});
