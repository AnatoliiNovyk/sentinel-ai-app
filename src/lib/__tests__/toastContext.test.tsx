// Use real implementation for this test file — setup.ts globally mocks useToast
// but this file tests the real context internals
vi.unmock('../toastContext');

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { ToastProvider, useToast, useToasts } from '../toastContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

describe('toastContext — useToasts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('starts with empty toasts', () => {
    const { result } = renderHook(() => useToasts(), { wrapper });
    expect(result.current.toasts).toEqual([]);
  });

  it('addToast adds a toast', () => {
    const { result } = renderHook(() => useToasts(), { wrapper });
    act(() => {
      result.current.addToast('success', 'Hello');
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Hello');
    expect(result.current.toasts[0].type).toBe('success');
  });

  it('removeToast removes a toast by id', () => {
    const { result } = renderHook(() => useToasts(), { wrapper });
    act(() => {
      result.current.addToast('info', 'Test');
    });
    const id = result.current.toasts[0].id;
    act(() => {
      result.current.removeToast(id);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('toast auto-dismisses after 4 seconds', () => {
    const { result } = renderHook(() => useToasts(), { wrapper });
    act(() => {
      result.current.addToast('error', 'Auto dismiss');
    });
    expect(result.current.toasts).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(4001);
    });
    expect(result.current.toasts).toHaveLength(0);
  });
});

describe('toastContext — error boundaries', () => {
  it('useToast throws when used outside ToastProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useToast())).toThrow(/useToast must be used inside/i);
    consoleSpy.mockRestore();
  });

  it('useToasts throws when used outside ToastProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useToasts())).toThrow(/useToasts must be used inside/i);
    consoleSpy.mockRestore();
  });
});

describe('toastContext — useToast helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('success() adds a success toast', () => {
    const { result } = renderHook(() => ({ toast: useToast(), toasts: useToasts() }), { wrapper });
    act(() => { result.current.toast.success('Done!'); });
    expect(result.current.toasts.toasts[0]).toMatchObject({ type: 'success', message: 'Done!' });
  });

  it('error() adds an error toast', () => {
    const { result } = renderHook(() => ({ toast: useToast(), toasts: useToasts() }), { wrapper });
    act(() => { result.current.toast.error('Oops!'); });
    expect(result.current.toasts.toasts[0]).toMatchObject({ type: 'error', message: 'Oops!' });
  });

  it('info() adds an info toast', () => {
    const { result } = renderHook(() => ({ toast: useToast(), toasts: useToasts() }), { wrapper });
    act(() => { result.current.toast.info('FYI'); });
    expect(result.current.toasts.toasts[0]).toMatchObject({ type: 'info', message: 'FYI' });
  });

  it('warning() adds a warning toast', () => {
    const { result } = renderHook(() => ({ toast: useToast(), toasts: useToasts() }), { wrapper });
    act(() => { result.current.toast.warning('Watch out'); });
    expect(result.current.toasts.toasts[0]).toMatchObject({ type: 'warning', message: 'Watch out' });
  });
});
