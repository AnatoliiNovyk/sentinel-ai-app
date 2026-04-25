import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScanStats } from '../scans/ScanStats';

const defaultStats = {
  critical: 3,
  high: 7,
  medium: 12,
  low: 5,
  info: 2,
};

describe('ScanStats', () => {
  it('renders all five severity labels', () => {
    render(<ScanStats stats={defaultStats} totalVulnerabilities={29} />);
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
  });

  it('displays correct critical count', () => {
    render(<ScanStats stats={defaultStats} totalVulnerabilities={29} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('displays correct high count', () => {
    render(<ScanStats stats={defaultStats} totalVulnerabilities={29} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('displays totalVulnerabilities value', () => {
    render(<ScanStats stats={defaultStats} totalVulnerabilities={29} />);
    expect(screen.getByText('29')).toBeInTheDocument();
  });

  it('renders zero counts correctly', () => {
    const zeroStats = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    render(<ScanStats stats={zeroStats} totalVulnerabilities={0} />);
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBe(5);
  });
});
