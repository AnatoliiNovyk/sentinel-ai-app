import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import Sparkline from '../Sparkline';

// Helper to build a basic Sparkline
const DATA = [10, 20, 15, 30, 25];

describe('Sparkline', () => {
  it('renders an SVG element', () => {
    const { container } = render(<Sparkline data={DATA} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('returns null for empty data', () => {
    const { container } = render(<Sparkline data={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('uses default width and height', () => {
    const { container } = render(<Sparkline data={DATA} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '120');
    expect(svg).toHaveAttribute('height', '40');
  });

  it('applies custom width and height', () => {
    const { container } = render(<Sparkline data={DATA} width={200} height={60} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '200');
    expect(svg).toHaveAttribute('height', '60');
  });

  it('renders area fill path (d attribute starts with M)', () => {
    const { container } = render(<Sparkline data={DATA} />);
    const paths = container.querySelectorAll('path');
    // First path is area fill, second is line
    expect(paths.length).toBeGreaterThanOrEqual(2);
    expect(paths[0].getAttribute('d')).toMatch(/^M/);
  });

  it('renders the line path with no fill', () => {
    const { container } = render(<Sparkline data={DATA} />);
    const paths = container.querySelectorAll('path');
    const linePath = paths[1];
    expect(linePath).toHaveAttribute('fill', 'none');
  });

  it('renders a last-value dot circle', () => {
    const { container } = render(<Sparkline data={DATA} />);
    const circles = container.querySelectorAll('circle');
    // Two circles: solid dot + halo
    expect(circles.length).toBe(2);
  });

  it('uses default green color for stroke', () => {
    const { container } = render(<Sparkline data={DATA} />);
    const paths = container.querySelectorAll('path');
    const linePath = paths[1];
    expect(linePath.getAttribute('stroke')).toBe('#10b981');
  });

  it('applies custom color to stroke and circles', () => {
    const { container } = render(<Sparkline data={DATA} color="#ff0000" />);
    const paths = container.querySelectorAll('path');
    expect(paths[1].getAttribute('stroke')).toBe('#ff0000');
    const circle = container.querySelector('circle');
    expect(circle?.getAttribute('fill')).toBe('#ff0000');
  });

  it('renders correctly for single data point', () => {
    // Single point — no line, but should not crash
    const { container } = render(<Sparkline data={[42]} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('uses fillColor for gradient stops when provided', () => {
    const { container } = render(<Sparkline data={DATA} color="#ff0000" fillColor="#0000ff" />);
    const stops = container.querySelectorAll('stop');
    expect(stops.length).toBe(2);
    expect(stops[0].getAttribute('stop-color')).toBe('#0000ff');
    expect(stops[1].getAttribute('stop-color')).toBe('#0000ff');
  });

  it('does not produce NaN coordinates for flat data', () => {
    const { container } = render(<Sparkline data={[7, 7, 7, 7]} />);
    const paths = container.querySelectorAll('path');
    const lineD = paths[1].getAttribute('d') ?? '';
    expect(lineD).not.toContain('NaN');
    expect(lineD).not.toContain('Infinity');
  });

  it('applies strokeWidth as drawing pad in coordinates', () => {
    const { container } = render(<Sparkline data={[0, 10]} width={100} height={40} strokeWidth={4} />);
    const paths = container.querySelectorAll('path');
    const lineD = paths[1].getAttribute('d') ?? '';
    expect(lineD.startsWith('M 4 ')).toBe(true);
  });

  it('uses color as gradient stop-color when fillColor is not provided', () => {
    const { container } = render(<Sparkline data={DATA} color="#22c55e" />);
    const stops = container.querySelectorAll('stop');
    expect(stops).toHaveLength(2);
    expect(stops[0].getAttribute('stop-color')).toBe('#22c55e');
    expect(stops[1].getAttribute('stop-color')).toBe('#22c55e');
  });

  it('applies custom strokeWidth to the line path', () => {
    const { container } = render(<Sparkline data={DATA} strokeWidth={3} />);
    const paths = container.querySelectorAll('path');
    const linePath = paths[1];
    expect(linePath).toHaveAttribute('stroke-width', '3');
  });

  it('uses custom width and height in viewBox', () => {
    const { container } = render(<Sparkline data={DATA} width={160} height={52} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('viewBox', '0 0 160 52');
  });

  it('applies overflow-visible class to svg container', () => {
    const { container } = render(<Sparkline data={DATA} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('overflow-visible');
  });

  it('renders area path fill using generated spark gradient id', () => {
    const { container } = render(<Sparkline data={DATA} color="#3b82f6" />);
    const paths = container.querySelectorAll('path');
    const areaPath = paths[0];
    const fill = areaPath.getAttribute('fill') ?? '';

    expect(fill.startsWith('url(#spark-')).toBe(true);
    expect(fill.endsWith(')')).toBe(true);
  });

  it('renders halo circle with radius 5 and opacity 0.2', () => {
    const { container } = render(<Sparkline data={DATA} color="#ef4444" />);
    const circles = container.querySelectorAll('circle');
    const halo = circles[1];

    expect(halo).toHaveAttribute('r', '5');
    expect(halo).toHaveAttribute('fill-opacity', '0.2');
    expect(halo).toHaveAttribute('fill', '#ef4444');
  });

  it('uses default viewBox dimensions when width and height are omitted', () => {
    const { container } = render(<Sparkline data={DATA} />);
    const svg = container.querySelector('svg');

    expect(svg).toHaveAttribute('viewBox', '0 0 120 40');
  });

  it('uses default stroke width of 1.5 for line path', () => {
    const { container } = render(<Sparkline data={DATA} />);
    const paths = container.querySelectorAll('path');
    const linePath = paths[1];

    expect(linePath).toHaveAttribute('stroke-width', '1.5');
  });

  it('links area path fill url to the rendered linearGradient id', () => {
    const { container } = render(<Sparkline data={DATA} color="#06b6d4" />);
    const gradient = container.querySelector('linearGradient');
    const areaPath = container.querySelectorAll('path')[0];

    expect(gradient).toBeInTheDocument();
    expect(areaPath).toHaveAttribute('fill', `url(#${gradient?.getAttribute('id')})`);
  });
});
