import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ErrorBoundary from '../ErrorBoundary';

// Suppress console.error noise from intentional throws
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// A component that throws on demand
function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Boom! Test explosion');
  return <div>Safe content</div>;
}

describe('ErrorBoundary — normal render', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });
});

describe('ErrorBoundary — error caught', () => {
  it('renders fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('shows the error message in fallback UI', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Boom! Test explosion')).toBeInTheDocument();
  });

  it('shows context label when context prop provided', () => {
    render(
      <ErrorBoundary context="Dashboard">
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/Dashboard encountered an error/i)).toBeInTheDocument();
  });

  it('shows "Try again" button in fallback UI', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('logs error to console.error', () => {
    render(
      <ErrorBoundary context="Test">
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(console.error).toHaveBeenCalled();
  });
});

describe('ErrorBoundary — custom fallback', () => {
  it('renders custom fallback when fallback prop provided', () => {
    render(
      <ErrorBoundary fallback={(err) => <div>Custom: {err.message}</div>}>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Custom: Boom! Test explosion')).toBeInTheDocument();
  });

  it('passes reset function to custom fallback', () => {
    const onReset = vi.fn();
    render(
      <ErrorBoundary fallback={(_err, reset) => (
        <button onClick={() => { reset(); onReset(); }}>Reset</button>
      )}>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});
