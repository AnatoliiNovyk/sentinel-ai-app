import '@testing-library/jest-dom/vitest';
import { vi, afterEach } from 'vitest';
import { act } from '@testing-library/react';

// Flush all pending async state updates after each test to silence act() warnings
afterEach(async () => {
  await act(async () => {});
});

if (!('IntersectionObserver' in globalThis)) {
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = '0px';
    thresholds = [0];
  }

  (globalThis as unknown as { IntersectionObserver: typeof MockIntersectionObserver }).IntersectionObserver =
    MockIntersectionObserver;
}

if (!HTMLElement.prototype.scrollTo) {
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    value: vi.fn(),
    writable: true,
  });
}

// Global mock for ToastProvider — many components call useToast and need this
vi.mock('../lib/toastContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/toastContext')>();
  return {
    ...actual,
    useToast: () => ({
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    }),
  };
});

// Global mock for PresenceContext — FindingsTab and similar use usePresence
vi.mock('../context/PresenceContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../context/PresenceContext')>();
  return {
    ...actual,
    PresenceProvider: ({ children }: { children: unknown }) => children,
    usePresence: () => ({
      onlineUsers: [],
      currentUser: null,
      isUserOnline: () => false,
    }),
  };
});
