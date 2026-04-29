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
