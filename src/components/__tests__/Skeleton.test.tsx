import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it } from 'vitest';
import { SkeletonBlock, SkeletonCardGrid, SkeletonList, SkeletonSidebar } from '../Skeleton';

describe('SkeletonBlock', () => {
  it('renders an element with animate-pulse class', () => {
    const { container } = render(<SkeletonBlock />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });

  it('applies additional className prop', () => {
    const { container } = render(<SkeletonBlock className="h-4 w-24" />);
    expect(container.firstChild).toHaveClass('h-4', 'w-24');
  });

  it('has aria-hidden="true"', () => {
    const { container } = render(<SkeletonBlock />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('SkeletonCardGrid', () => {
  it('renders 6 cards by default', () => {
    const { container } = render(<SkeletonCardGrid />);
    const grid = container.firstChild as HTMLElement;
    expect(grid.children.length).toBe(6);
  });

  it('renders correct count when count prop is provided', () => {
    const { container } = render(<SkeletonCardGrid count={3} />);
    const grid = container.firstChild as HTMLElement;
    expect(grid.children.length).toBe(3);
  });

  it('has aria-busy="true"', () => {
    render(<SkeletonCardGrid />);
    expect(screen.getByRole('generic', { busy: true })).toBeInTheDocument();
  });

  it('renders 3-column layout by default (cols=3)', () => {
    const { container } = render(<SkeletonCardGrid cols={3} />);
    const grid = container.firstChild as HTMLElement;
    expect(grid.className).toMatch(/grid-cols-1/);
    expect(grid.className).toMatch(/md:grid-cols-2/);
    expect(grid.className).toMatch(/lg:grid-cols-3/);
  });

  it('renders 2-column layout (cols=2)', () => {
    const { container } = render(<SkeletonCardGrid cols={2} />);
    const grid = container.firstChild as HTMLElement;
    expect(grid.className).toMatch(/grid-cols-1/);
    expect(grid.className).toMatch(/md:grid-cols-2/);
    expect(grid.className).not.toMatch(/lg:grid-cols-3/);
  });

  it('renders 1-column layout (cols=1)', () => {
    const { container } = render(<SkeletonCardGrid cols={1} />);
    const grid = container.firstChild as HTMLElement;
    expect(grid.className).toMatch(/grid-cols-1/);
    expect(grid.className).not.toMatch(/md:grid-cols-2/);
    expect(grid.className).not.toMatch(/lg:grid-cols-3/);
  });

  it('applies custom height class', () => {
    const { container } = render(<SkeletonCardGrid height="h-48" />);
    const cards = container.querySelectorAll('[class*="h-48"]');
    expect(cards.length).toBeGreaterThan(0);
  });
});

describe('SkeletonList', () => {
  it('renders 4 list items by default', () => {
    const { container } = render(<SkeletonList />);
    const list = container.firstChild as HTMLElement;
    expect(list.children.length).toBe(4);
  });

  it('renders correct count when count prop is provided', () => {
    const { container } = render(<SkeletonList count={2} />);
    const list = container.firstChild as HTMLElement;
    expect(list.children.length).toBe(2);
  });
});

describe('SkeletonSidebar', () => {
  it('renders 5 sidebar items by default', () => {
    const { container } = render(<SkeletonSidebar />);
    const sidebar = container.firstChild as HTMLElement;
    expect(sidebar.children.length).toBe(5);
  });

  it('renders correct count when count prop is provided', () => {
    const { container } = render(<SkeletonSidebar count={3} />);
    const sidebar = container.firstChild as HTMLElement;
    expect(sidebar.children.length).toBe(3);
  });
});
