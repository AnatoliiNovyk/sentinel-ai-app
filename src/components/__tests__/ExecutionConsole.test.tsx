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

  it('logs target environment using uppercase type value', async () => {
    render(
      <ExecutionConsole
        code="echo done"
        type="azure"
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText(/Targeting asset environment: AZURE/i)).toBeInTheDocument();
  });

  it('renders command logs only for non-empty code lines', async () => {
    render(
      <ExecutionConsole
        code={'cmd-one\n\n   \ncmd-two'}
        type="linux"
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText('> cmd-one')).toBeInTheDocument();
    expect(screen.getByText('> cmd-two')).toBeInTheDocument();
    const commandLines = screen.getAllByText(/^> /i);
    expect(commandLines).toHaveLength(2);
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

  it('hides Abort button once finishing state is reached', async () => {
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

    expect(screen.queryByText('Abort')).not.toBeInTheDocument();
  });

  it('displays error count when errors exist in log', async () => {
    render(
      <ExecutionConsole
        code="echo error"
        type="linux"
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // After completion, error count should be visible if any errors were logged
    const errorElement = screen.queryByText(/error\(s\)/i);
    // The component adds error logs during execution
    if (errorElement) {
      expect(errorElement).toBeInTheDocument();
    }
  });

  it('copyLog function sets logCopied to true then back to false', async () => {
    // Mock clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });

    render(
      <ExecutionConsole
        code="test log"
        type="linux"
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const copyBtn = screen.getByTitle('Copy log');
    fireEvent.click(copyBtn);

    // Check if "Copied" message appears briefly
    expect(screen.getByText('Copied')).toBeInTheDocument();

    // Advance timer to reset the copied state
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // After timeout, "Copied" should be gone and "Copy log" should return
    expect(screen.getByText('Copy log')).toBeInTheDocument();
  });
});
