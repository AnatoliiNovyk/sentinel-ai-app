import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ExecutionConsole from '../ExecutionConsole';

const DEFAULT_PROPS = {
  code: 'apt-get install patch\npatch -p1 < fix.diff',
  type: 'linux',
  onComplete: vi.fn(),
  onCancel: vi.fn(),
};

describe('ExecutionConsole — static render', () => {
  it('renders the terminal title', () => {
    render(<ExecutionConsole {...DEFAULT_PROPS} />);
    expect(screen.getByText('sentinel-ai --apply-fix --force')).toBeInTheDocument();
  });

  it('shows "Abort" button initially', () => {
    render(<ExecutionConsole {...DEFAULT_PROPS} />);
    expect(screen.getByText('Abort')).toBeInTheDocument();
  });

  it('shows "AI execution in progress..." spinner', () => {
    render(<ExecutionConsole {...DEFAULT_PROPS} />);
    expect(screen.getByText('AI execution in progress...')).toBeInTheDocument();
  });

  it('shows status "Executing..." in footer', () => {
    render(<ExecutionConsole {...DEFAULT_PROPS} />);
    expect(screen.getByText(/Executing\.\.\./i)).toBeInTheDocument();
  });

  it('calls onCancel when Abort button clicked', () => {
    const onCancel = vi.fn();
    render(<ExecutionConsole {...DEFAULT_PROPS} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Abort'));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe('ExecutionConsole — async sequence (fake timers)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('calls onComplete after the full sequence completes', async () => {
    const onComplete = vi.fn();
    render(
      <ExecutionConsole
        code="echo test"
        type="linux"
        onComplete={onComplete}
        onCancel={vi.fn()}
      />,
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('shows "Remediation Complete" heading after sequence', async () => {
    render(
      <ExecutionConsole
        code="echo done"
        type="aws"
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText('Remediation Complete')).toBeInTheDocument();
  });

  it('shows status "Success" in footer after completion', async () => {
    render(
      <ExecutionConsole
        code="fix.sh"
        type="gcp"
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText(/Status: Success/i)).toBeInTheDocument();
  });
});
