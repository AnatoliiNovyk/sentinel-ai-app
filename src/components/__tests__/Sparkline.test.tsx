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
});
