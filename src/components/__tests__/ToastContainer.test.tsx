import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
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

  it('applies style mappings for all toast types', () => {
    mockToastsList = [
      { id: 's', type: 'success', message: 'S message' },
      { id: 'e', type: 'error', message: 'E message' },
      { id: 'i', type: 'info', message: 'I message' },
      { id: 'w', type: 'warning', message: 'W message' },
    ];

    const { container } = render(<ToastContainer />);

    expect(container.querySelector('.bg-emerald-500')).toBeInTheDocument();
    expect(container.querySelector('.text-emerald-400')).toBeInTheDocument();

    expect(container.querySelector('.bg-red-500')).toBeInTheDocument();
    expect(container.querySelector('.text-red-400')).toBeInTheDocument();

    expect(container.querySelector('.bg-sky-500')).toBeInTheDocument();
    expect(container.querySelector('.text-sky-400')).toBeInTheDocument();

    expect(container.querySelector('.bg-amber-500')).toBeInTheDocument();
    expect(container.querySelector('.text-amber-400')).toBeInTheDocument();
  });

  it('dismisses the correct toast when multiple toasts exist', () => {
    mockToastsList = [
      { id: 'toast-1', type: 'success', message: 'First' },
      { id: 'toast-2', type: 'error', message: 'Second' },
    ];
    render(<ToastContainer />);

    const dismissButtons = screen.getAllByRole('button', { name: 'Dismiss' });
    fireEvent.click(dismissButtons[1]);

    expect(mockRemoveToast).toHaveBeenCalledWith('toast-2');
  });

  it('renders one progress row per toast', () => {
    mockToastsList = [
      { id: 'a', type: 'success', message: 'A' },
      { id: 'b', type: 'error', message: 'B' },
      { id: 'c', type: 'info', message: 'C' },
    ];

    const { container } = render(<ToastContainer />);
    const progressRows = Array.from(container.querySelectorAll('div')).filter(
      (el) => el.classList.contains('h-0.5') && el.classList.contains('bg-slate-800'),
    );
    expect(progressRows).toHaveLength(3);
  });

  it('renders correct icons for each toast type', () => {
    mockToastsList = [
      { id: 's', type: 'success', message: 'Success' },
      { id: 'e', type: 'error', message: 'Error' },
      { id: 'i', type: 'info', message: 'Info' },
      { id: 'w', type: 'warning', message: 'Warning' },
    ];

    const { container } = render(<ToastContainer />);

    // Success: CheckCircle2 (has 'check-circle-2' or similar in aria-label or as fallback)
    const icons = container.querySelectorAll('svg');
    // Each toast has 1 icon + 1 X button = 2 SVGs per toast, so 4 toasts = 8 SVGs total
    expect(icons.length).toBeGreaterThanOrEqual(8);
  });

  it('renders colored left bar for each toast', () => {
    mockToastsList = [
      { id: 's', type: 'success', message: 'S' },
      { id: 'e', type: 'error', message: 'E' },
    ];

    const { container } = render(<ToastContainer />);

    // Success left bar: bg-emerald-500
    const successLeftBar = Array.from(container.querySelectorAll('div')).find(
      (el) => el.classList.contains('absolute') && el.classList.contains('left-0') && el.classList.contains('bg-emerald-500'),
    );
    expect(successLeftBar).toBeInTheDocument();

    // Error left bar: bg-red-500
    const errorLeftBar = Array.from(container.querySelectorAll('div')).find(
      (el) => el.classList.contains('absolute') && el.classList.contains('left-0') && el.classList.contains('bg-red-500'),
    );
    expect(errorLeftBar).toBeInTheDocument();
  });

  it('renders toast container with fixed positioning and correct z-index', () => {
    mockToastsList = [{ id: 'toast-1', type: 'info', message: 'Test' }];
    const { container } = render(<ToastContainer />);

    const liveRegion = container.querySelector('[aria-live="polite"]');
    // Check for fixed positioning classes
    expect(liveRegion?.classList.contains('fixed')).toBe(true);
    expect(liveRegion?.classList.contains('bottom-20')).toBe(true);
    expect(liveRegion?.classList.contains('right-6')).toBe(true);
    expect(liveRegion?.classList.contains('z-[60]')).toBe(true);
  });

  it('each toast card has bg-slate-900 background class', () => {
    mockToastsList = [
      { id: 'a', type: 'success', message: 'Alpha' },
      { id: 'b', type: 'error', message: 'Beta' },
    ];
    const { container } = render(<ToastContainer />);
    const cards = container.querySelectorAll('.bg-slate-900');
    expect(cards.length).toBeGreaterThanOrEqual(2);
  });

  it('outer aria-live container has pointer-events-none class', () => {
    mockToastsList = [{ id: 'toast-1', type: 'warning', message: 'Watch out' }];
    const { container } = render(<ToastContainer />);
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion?.classList.contains('pointer-events-none')).toBe(true);
  });

  it('calls removeToast exactly once when Dismiss is clicked', () => {
    mockToastsList = [{ id: 'toast-x', type: 'success', message: 'Done' }];
    render(<ToastContainer />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(mockRemoveToast).toHaveBeenCalledTimes(1);
    expect(mockRemoveToast).toHaveBeenCalledWith('toast-x');
  });
});
