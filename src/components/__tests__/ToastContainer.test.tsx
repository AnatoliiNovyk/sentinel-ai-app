import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import ToastContainer from '../ToastContainer';

// Override global mock to also expose useToasts
vi.mock('../../lib/toastContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/toastContext')>();
  return {
    ...actual,
    useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
    useToasts: () => mockUseToastsValue(),
  };
});

const mockRemoveToast = vi.fn();
let mockToastsList: { id: string; type: 'success' | 'error' | 'info' | 'warning'; message: string }[] = [];

function mockUseToastsValue() {
  return { toasts: mockToastsList, removeToast: mockRemoveToast };
}

describe('ToastContainer', () => {
  beforeEach(() => {
    mockToastsList = [];
    mockRemoveToast.mockClear();
  });

  it('renders nothing when there are no toasts', () => {
    mockToastsList = [];
    const { container } = render(<ToastContainer />);
    expect(container.firstChild).toBeNull();
  });

  it('renders aria-live="polite" container when toasts exist', () => {
    mockToastsList = [{ id: 'toast-1', type: 'success', message: 'Done!' }];
    const { container } = render(<ToastContainer />);
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
  });

  it('renders toast message text', () => {
    mockToastsList = [{ id: 'toast-1', type: 'success', message: 'Operation successful' }];
    render(<ToastContainer />);
    expect(screen.getByText('Operation successful')).toBeInTheDocument();
  });

  it('renders multiple toast messages', () => {
    mockToastsList = [
      { id: 'toast-1', type: 'success', message: 'Saved successfully' },
      { id: 'toast-2', type: 'error', message: 'Something went wrong' },
    ];
    render(<ToastContainer />);
    expect(screen.getByText('Saved successfully')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('calls removeToast when Dismiss button is clicked', () => {
    mockToastsList = [{ id: 'toast-1', type: 'info', message: 'Hello' }];
    render(<ToastContainer />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(mockRemoveToast).toHaveBeenCalledWith('toast-1');
  });

  it('renders Dismiss button for each toast', () => {
    mockToastsList = [
      { id: 'a', type: 'success', message: 'A' },
      { id: 'b', type: 'warning', message: 'B' },
    ];
    render(<ToastContainer />);
    expect(screen.getAllByRole('button', { name: 'Dismiss' })).toHaveLength(2);
  });
});
