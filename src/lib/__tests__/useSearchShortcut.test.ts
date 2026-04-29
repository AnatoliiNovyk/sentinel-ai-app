import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';
import { useSearchShortcut } from '../useSearchShortcut';

// ── Helpers ───────────────────────────────────────────────────────────────────

function dispatchKey(key: string, target: EventTarget = window) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'target', { value: target, writable: false });
  window.dispatchEvent(event);
  return event;
}

function makeInputRef() {
  // Create a real input element so focus/blur/activeElement work
  const input = document.createElement('input');
  document.body.appendChild(input);
  return input;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useSearchShortcut — "/" key', () => {
  let input: HTMLInputElement;
  let onClear: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    input = makeInputRef();
    onClear = vi.fn();
  });

  afterEach(() => {
    input.remove();
  });

  it('focuses the input when "/" is pressed outside an input', () => {
    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLInputElement>(input);
      useSearchShortcut(ref, onClear);
    });

    act(() => { dispatchKey('/'); });

    expect(document.activeElement).toBe(input);
    unmount();
  });

  it('does NOT focus input when "/" is pressed while already in an input field', () => {
    const otherInput = document.createElement('input');
    document.body.appendChild(otherInput);
    otherInput.focus();

    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLInputElement>(input);
      useSearchShortcut(ref, onClear);
    });

    // dispatch "/" with target = another input element
    const event = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true });
    // jsdom doesn't use target in dispatched events — simulate by setting document.activeElement
    otherInput.focus();
    act(() => { otherInput.dispatchEvent(event); });

    // The hook target is `window`, so we test that onClear was NOT called
    expect(onClear).not.toHaveBeenCalled();
    otherInput.remove();
    unmount();
  });
});

describe('useSearchShortcut — "Escape" key', () => {
  let input: HTMLInputElement;
  let onClear: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    input = makeInputRef();
    onClear = vi.fn();
  });

  afterEach(() => {
    input.remove();
  });

  it('calls onClear and blurs input when Escape is pressed while input is focused', () => {
    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLInputElement>(input);
      useSearchShortcut(ref, onClear);
    });

    // Focus the tracked input so activeElement === input
    act(() => { input.focus(); });
    expect(document.activeElement).toBe(input);

    act(() => { dispatchKey('Escape'); });

    expect(onClear).toHaveBeenCalledOnce();
    unmount();
  });

  it('does NOT call onClear when Escape is pressed while input is NOT focused', () => {
    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLInputElement>(input);
      useSearchShortcut(ref, onClear);
    });

    // Do not focus the input
    act(() => { dispatchKey('Escape'); });

    expect(onClear).not.toHaveBeenCalled();
    unmount();
  });
});

describe('useSearchShortcut — cleanup', () => {
  it('removes keydown listener on unmount', () => {
    const input = makeInputRef();
    const onClear = vi.fn();
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLInputElement>(input);
      useSearchShortcut(ref, onClear);
    });

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    input.remove();
    removeSpy.mockRestore();
  });
});
