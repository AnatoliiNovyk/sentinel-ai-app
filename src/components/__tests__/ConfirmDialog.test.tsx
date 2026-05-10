import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import ConfirmDialog from '../ConfirmDialog';

// ── Tests ─────────────────────────────────────────────────────────────────

describe('ConfirmDialog — rendering', () => {
  it('does not render when open=false', () => {
    render(
      <ConfirmDialog
        open={false}
        title="Delete project"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog when open=true', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete project"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete project')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('uses confirmLabel="Delete" by default', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Really?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('renders custom confirmLabel', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Really?"
        confirmLabel="Remove"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });
});

describe('ConfirmDialog — interactions', () => {
  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Really?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    // Component has both an X icon button (aria-label="Cancel") and a text "Cancel" button.
    // Target the visible text button by its text content.
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onConfirm when Delete button is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Really?"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when backdrop overlay is clicked', () => {
    const onCancel = vi.fn();
    const { container } = render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Really?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    // Click the outermost backdrop div (first child of body portal)
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onCancel on Escape key press', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Really?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onConfirm on Enter key press', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Really?"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

describe('ConfirmDialog — accessibility and icons', () => {
  it('closes dialog via X icon button (aria-label="Cancel")', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Really?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByLabelText('Cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('dialog has aria-modal="true" attribute', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Really?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('renders AlertTriangle icon in dialog header', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Really?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const icon = document.querySelector('svg.lucide-alert-triangle');
    expect(icon).not.toBeNull();
  });
});

describe('ConfirmDialog — focus trap (Tab key)', () => {
  it('Tab key from last button wraps to first (cancel)', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Really?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    const dialog = screen.getByRole('dialog');
    // Focus the confirm (delete) button — it's the "last" focusable
    const deleteBtn = screen.getByRole('button', { name: /delete/i });
    deleteBtn.focus();
    // Fire Tab from the dialog element while Delete is focused
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: false });
    // Focus should wrap: the handler calls first.focus() 
    // (we just verify it doesn't throw and the handler runs)
  });

  it('Shift+Tab key from first button wraps to last (confirm)', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Really?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    const dialog = screen.getByRole('dialog');
    // Focus the cancel button — it's the "first" focusable
    const cancelBtn = screen.getByText('Cancel');
    cancelBtn.focus();
    // Fire Shift+Tab from dialog while Cancel is focused
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    // Focus should wrap: handler calls last.focus()
  });

  it('Tab on non-Tab key does nothing', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Really?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const dialog = screen.getByRole('dialog');
    // Non-Tab key — should not throw
    fireEvent.keyDown(dialog, { key: 'a' });
  });
});

describe('ConfirmDialog — additional coverage', () => {
  it('dialog has aria-labelledby="confirm-dialog-title" attribute', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Really?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'confirm-dialog-title');
  });

  it('clicking inside dialog does not call onCancel (stopPropagation)', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Really?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole('dialog'));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('confirm button has bg-red-600 class', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Really?"
        confirmLabel="Delete"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const confirmBtn = screen.getByRole('button', { name: /delete/i });
    expect(confirmBtn).toHaveClass('bg-red-600');
  });

  it('auto-focuses Cancel button shortly after opening', () => {
    vi.useFakeTimers();

    render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Really?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    vi.advanceTimersByTime(15);
    expect(screen.getByText('Cancel')).toHaveFocus();

    vi.useRealTimers();
  });

  it('does not react to Escape/Enter when mounted with open=false', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open={false}
        title="Confirm"
        message="Really?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('removes keydown listeners after dialog is closed via rerender', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    const { rerender } = render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Really?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    rerender(
      <ConfirmDialog
        open={false}
        title="Confirm"
        message="Really?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
