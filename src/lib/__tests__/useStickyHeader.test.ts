import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { useStickyHeader } from '../useStickyHeader';

// ── IntersectionObserver mock ─────────────────────────────────────────────────
// jsdom does not implement IntersectionObserver, but setup.ts provides a basic
// stub that doesn't fire callbacks. We override it per-test to control behaviour.

type IOCallback = (entries: IntersectionObserverEntry[]) => void;

let capturedCallback: IOCallback | null = null;
let mockObserve: ReturnType<typeof vi.fn>;
let mockDisconnect: ReturnType<typeof vi.fn>;

beforeEach(() => {
  capturedCallback = null;
  mockObserve = vi.fn();
  mockDisconnect = vi.fn();

  class MockIntersectionObserver {
    constructor(cb: IOCallback) {
      capturedCallback = cb;
    }
    observe = mockObserve;
    disconnect = mockDisconnect;
    unobserve = vi.fn();
    takeRecords = () => [];
    root = null;
    rootMargin = '0px';
    thresholds = [0];
  }

  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Test component ────────────────────────────────────────────────────────────
// renderHook leaves sentinelRef.current=null (no DOM element). A real component
// assigns the ref to a DOM div so IntersectionObserver actually gets instantiated.

type StuckCapture = { value: boolean };

function StickyTestComponent({ capture }: { capture: StuckCapture }) {
  const { sentinelRef, stuck } = useStickyHeader();
  capture.value = stuck;
  return React.createElement('div', { ref: sentinelRef, 'data-testid': 'sentinel' });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useStickyHeader', () => {
  it('returns sentinelRef and stuck=false initially', () => {
    const capture: StuckCapture = { value: false };
    render(React.createElement(StickyTestComponent, { capture }));
    expect(capture.value).toBe(false);
  });

  it('calls IntersectionObserver.observe with the sentinel element', () => {
    const capture: StuckCapture = { value: false };
    render(React.createElement(StickyTestComponent, { capture }));
    expect(mockObserve).toHaveBeenCalledWith(expect.any(HTMLDivElement));
  });

  it('sets stuck=true when sentinel is NOT intersecting', () => {
    const capture: StuckCapture = { value: false };
    render(React.createElement(StickyTestComponent, { capture }));

    act(() => {
      capturedCallback?.([{ isIntersecting: false } as IntersectionObserverEntry]);
    });

    expect(capture.value).toBe(true);
  });

  it('sets stuck=false when sentinel IS intersecting after being stuck', () => {
    const capture: StuckCapture = { value: false };
    render(React.createElement(StickyTestComponent, { capture }));

    act(() => {
      capturedCallback?.([{ isIntersecting: false } as IntersectionObserverEntry]);
    });
    expect(capture.value).toBe(true);

    act(() => {
      capturedCallback?.([{ isIntersecting: true } as IntersectionObserverEntry]);
    });
    expect(capture.value).toBe(false);
  });

  it('disconnects observer on unmount', () => {
    const capture: StuckCapture = { value: false };
    const { unmount } = render(React.createElement(StickyTestComponent, { capture }));
    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
