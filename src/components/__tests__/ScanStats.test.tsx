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

  it('Total card does not render progress bar or percentage text', () => {
    render(<ScanStats stats={defaultStats} totalVulnerabilities={29} />);

    const percentageTexts = screen.queryAllByText(/% of total/i);
    expect(percentageTexts.length).toBe(4);
  });

  it('sets correct width percentage for each card progress bar', () => {
    const stats = { critical: 10, high: 20, medium: 30, low: 20, info: 20 };
    const { container } = render(<ScanStats stats={stats} totalVulnerabilities={100} />);

    const bars = container.querySelectorAll('div.h-full.rounded-full');
    expect(bars[0]).toHaveStyle('width: 10%');
    expect(bars[1]).toHaveStyle('width: 20%');
    expect(bars[2]).toHaveStyle('width: 30%');
    expect(bars[3]).toHaveStyle('width: 20%');
  });

  it('renders grid layout with responsive columns (2 md:5)', () => {
    const { container } = render(<ScanStats stats={defaultStats} totalVulnerabilities={29} />);

    const grid = container.querySelector('.grid');
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveClass('grid-cols-2');
    expect(grid).toHaveClass('md:grid-cols-5');

    const cards = container.querySelectorAll('div.bg-slate-800\\/40');
    expect(cards.length).toBe(5);
  });

  it('renders correct icons for each severity level', () => {
    const { container } = render(<ScanStats stats={defaultStats} totalVulnerabilities={29} />);

    expect(container.querySelector('.text-red-500')).toBeInTheDocument();
    expect(container.querySelector('.text-orange-500')).toBeInTheDocument();
    expect(container.querySelector('.text-yellow-500')).toBeInTheDocument();
    expect(container.querySelector('.text-blue-500')).toBeInTheDocument();
    expect(container.querySelector('.text-slate-400')).toBeInTheDocument();
  });
});
