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

  it('renders progress bar color branches for critical/high/medium/low cards', () => {
    const { container } = render(<ScanStats stats={defaultStats} totalVulnerabilities={29} />);

    expect(container.querySelector('.bg-red-500')).toBeInTheDocument();
    expect(container.querySelector('.bg-orange-500')).toBeInTheDocument();
    expect(container.querySelector('.bg-yellow-400')).toBeInTheDocument();
    expect(container.querySelector('.bg-blue-500')).toBeInTheDocument();
  });

  it('shows rounded percentages for non-total cards', () => {
    const stats = { critical: 1, high: 1, medium: 1, low: 0, info: 0 };
    render(<ScanStats stats={stats} totalVulnerabilities={3} />);

    expect(screen.getAllByText('33% of total').length).toBe(3);
    expect(screen.getByText('0% of total')).toBeInTheDocument();
  });

  it('does not render percentage rows for Total card', () => {
    render(<ScanStats stats={defaultStats} totalVulnerabilities={29} />);

    expect(screen.getAllByText(/% of total/i).length).toBe(4);
  });

  it('sets progress width to 0% when total is zero', () => {
    const zeroStats = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const { container } = render(<ScanStats stats={zeroStats} totalVulnerabilities={0} />);

    const bars = container.querySelectorAll('div.h-full.rounded-full');
    expect(bars.length).toBe(4);
    bars.forEach((bar) => {
      expect((bar as HTMLDivElement).style.width).toBe('0%');
    });
  });
});
