import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

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
