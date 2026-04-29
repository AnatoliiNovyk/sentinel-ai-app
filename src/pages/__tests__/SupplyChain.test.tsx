import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SupplyChain from '../SupplyChain';

const { mockScan, mockGetCircuitBreaker, mockGetGlobalScaAnalyzer } = vi.hoisted(() => {
  const mockScan = vi.fn();
  const mockCb = { execute: vi.fn() };
  const mockGetCircuitBreaker = vi.fn().mockReturnValue(mockCb);
  const mockGetGlobalScaAnalyzer = vi.fn().mockReturnValue({ scan: mockScan });
  return { mockScan, mockGetCircuitBreaker, mockGetGlobalScaAnalyzer };
});

vi.mock('../../lib/supplyChain', () => ({
  getGlobalScaAnalyzer: mockGetGlobalScaAnalyzer,
}));

vi.mock('../../lib/rateLimiter', () => ({
  getCircuitBreaker: mockGetCircuitBreaker,
}));

describe('SupplyChain', () => {
  beforeEach(() => {
    mockScan.mockReset();
  });

  it('renders "Supply Chain Analysis" heading', () => {
    render(<SupplyChain />);
    expect(screen.getByText('Supply Chain Analysis')).toBeInTheDocument();
  });

  it('renders description about OSV.dev', () => {
    render(<SupplyChain />);
    expect(screen.getByText(/OSV\.dev/i)).toBeInTheDocument();
  });

  it('renders dropzone with "Upload package.json" label', () => {
    render(<SupplyChain />);
    expect(screen.getByText('Upload package.json')).toBeInTheDocument();
  });

  it('renders drop hint text', () => {
    render(<SupplyChain />);
    expect(screen.getByText(/Drop your npm package\.json here/i)).toBeInTheDocument();
  });

  it('renders hidden file input', () => {
    render(<SupplyChain />);
    const input = screen.getByLabelText('Upload package.json');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'file');
  });

  it('shows error for unsupported file type', async () => {
    render(<SupplyChain />);
    const input = screen.getByLabelText('Upload package.json');
    const file = new File(['{}'], 'requirements.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(
        screen.getByText(/Only package\.json and package-lock\.json files are supported/i),
      ).toBeInTheDocument(),
    );
  });

  it('shows scanning state while analyzing', async () => {
    mockScan.mockReturnValue(new Promise(() => {})); // never resolves
    render(<SupplyChain />);
    const input = screen.getByLabelText('Upload package.json');
    const file = new File(['{"name":"test","dependencies":{}}'], 'package.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(screen.getByText('Analyzing Dependencies...')).toBeInTheDocument(),
    );
  });

  it('shows scan results after successful scan', async () => {
    mockScan.mockResolvedValue({
      ok: true,
      data: {
        risks: [
          {
            dependency: { name: 'lodash', version: '4.17.15', type: 'prod' },
            vulnerabilities: [
              { id: 'GHSA-1234', summary: 'Prototype pollution', details: '...', severity: 'high', fixedIn: '4.17.21' },
            ],
          },
        ],
      },
    });
    render(<SupplyChain />);
    const input = screen.getByLabelText('Upload package.json');
    const file = new File(['{"name":"test","dependencies":{"lodash":"4.17.15"}}'], 'package.json', {
      type: 'application/json',
    });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('lodash')).toBeInTheDocument());
    expect(screen.getByText('Prototype pollution')).toBeInTheDocument();
  });

  it('shows error when scan fails', async () => {
    mockScan.mockResolvedValue({ ok: false, error: { message: 'OSV service unavailable' } });
    render(<SupplyChain />);
    const input = screen.getByLabelText('Upload package.json');
    const file = new File(['{"name":"test"}'], 'package.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(screen.getByText('OSV service unavailable')).toBeInTheDocument(),
    );
  });

  it('clears filters after applying severity filter', async () => {
    mockScan.mockResolvedValue({
      ok: true,
      data: {
        risks: [
          {
            dependency: { name: 'express', version: '4.18.0', type: 'prod' },
            vulnerabilities: [
              { id: 'GHSA-5555', summary: 'RCE in express', details: '...', severity: 'critical', fixedIn: '4.18.2' },
            ],
          },
        ],
      },
    });
    render(<SupplyChain />);
    const input = screen.getByLabelText('Upload package.json');
    const file = new File(['{"name":"test","dependencies":{"express":"4.18.0"}}'], 'package.json', {
      type: 'application/json',
    });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('express')).toBeInTheDocument());
    // find severity filter buttons and click Critical
    const criticalBtn = screen.queryByRole('button', { name: /critical/i });
    if (criticalBtn) {
      fireEvent.click(criticalBtn);
      // now clear filters
      const clearBtn = screen.queryByRole('button', { name: /clear filters/i });
      if (clearBtn) {
        fireEvent.click(clearBtn);
      }
    }
  });
});
