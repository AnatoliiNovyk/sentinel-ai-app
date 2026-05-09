import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ErrorBoundary from '../ErrorBoundary';
import { useState } from 'react';

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

  it('logs with base [ErrorBoundary] prefix when context is not provided', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[ErrorBoundary]'),
      expect.any(Error),
      expect.any(String),
    );
  });

  it('recovers and renders children after clicking Try again when child no longer throws', () => {
    function RecoverableBoundaryHarness() {
      const [shouldThrow, setShouldThrow] = useState(true);

      return (
        <>
          <button onClick={() => setShouldThrow(false)}>Recover child</button>
          <ErrorBoundary>
            <Bomb shouldThrow={shouldThrow} />
          </ErrorBoundary>
        </>
      );
    }

    render(<RecoverableBoundaryHarness />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /recover child/i }));
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByText('Safe content')).toBeInTheDocument();
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

  it('passes Error instance and reset callback to fallback renderer', () => {
    const fallbackSpy = vi.fn((err: Error, _reset: () => void) => <div>Custom fallback: {err.message}</div>);

    render(
      <ErrorBoundary fallback={fallbackSpy}>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );

    expect(fallbackSpy).toHaveBeenCalled();
    const [errorArg, resetArg] = fallbackSpy.mock.calls[0];
    expect(errorArg).toBeInstanceOf(Error);
    expect(errorArg.message).toBe('Boom! Test explosion');
    expect(typeof resetArg).toBe('function');
    expect(screen.getByText('Custom fallback: Boom! Test explosion')).toBeInTheDocument();
  });
});

describe('ErrorBoundary — static API', () => {
  it('getDerivedStateFromError returns state with provided error', () => {
    const err = new Error('Static branch test');
    expect(ErrorBoundary.getDerivedStateFromError(err)).toEqual({ error: err });
  });
});

describe('ErrorBoundary — icons and styling', () => {
  it('renders AlertTriangle icon in fallback UI', () => {
    const { container } = render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    const alertIcon = container.querySelector('svg.lucide-alert-triangle');
    expect(alertIcon).toBeInTheDocument();
  });

  it('renders RefreshCw icon on Try again button', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    const button = screen.getByRole('button', { name: /try again/i });
    const svgInButton = button.querySelector('svg');
    expect(svgInButton).toBeInTheDocument();
  });

  it('applies correct styling to error container (min-h-[300px] and max-w-md)', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    const errorText = screen.getByText(/something went wrong/i);
    const textBlock = errorText.parentElement;
    expect(textBlock).not.toBeNull();
    if (!textBlock) throw new Error('Expected text block to exist');

    const innerDiv = textBlock.parentElement;
    expect(innerDiv).not.toBeNull();
    if (!innerDiv) throw new Error('Expected inner wrapper to exist');

    const outerDiv = innerDiv.parentElement;
    expect(outerDiv).not.toBeNull();
    if (!outerDiv) throw new Error('Expected outer container to exist');

    expect(outerDiv).toHaveClass('min-h-[300px]');
    expect(outerDiv).toHaveClass('flex');
    expect(outerDiv).toHaveClass('items-center');
    expect(outerDiv).toHaveClass('justify-center');
    expect(outerDiv).toHaveClass('p-8');

    expect(innerDiv).toHaveClass('max-w-md');
    expect(innerDiv).toHaveClass('w-full');
    expect(innerDiv).toHaveClass('bg-slate-900');
    expect(innerDiv).toHaveClass('border');
    expect(innerDiv).toHaveClass('rounded-xl');
  });
});
