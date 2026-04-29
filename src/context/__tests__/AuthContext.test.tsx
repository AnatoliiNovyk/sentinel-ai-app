import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider } from '../AuthContext';
import { useAuth } from '../useAuth';

const { mockOnAuthStateChange, mockSignInWithPassword, mockSignUp, mockSignOut, mockProfilesSelect, mockOrgsSelect, mockProfilesInsert } = vi.hoisted(() => {
  const _mockOnAuthStateChange = vi.fn();
  const _mockSignInWithPassword = vi.fn();
  const _mockSignUp = vi.fn();
  const _mockSignOut = vi.fn();
  const _mockProfilesSelect = vi.fn();
  const _mockOrgsSelect = vi.fn();
  const _mockProfilesInsert = vi.fn();

  return {
    mockOnAuthStateChange: _mockOnAuthStateChange,
    mockSignInWithPassword: _mockSignInWithPassword,
    mockSignUp: _mockSignUp,
    mockSignOut: _mockSignOut,
    mockProfilesSelect: _mockProfilesSelect,
    mockOrgsSelect: _mockOrgsSelect,
    mockProfilesInsert: _mockProfilesInsert,
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: mockOnAuthStateChange,
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      signOut: mockSignOut,
    },
    from: (table: string) => {
      if (table === 'profiles') return mockProfilesSelect();
      if (table === 'organizations') return mockOrgsSelect();
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [] }) }) };
    },
  },
}));

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockSignUp.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue(undefined);
    mockProfilesSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
    mockProfilesInsert.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'user-1', email: 'test@example.com', full_name: 'Test User' },
            error: null,
          }),
        }),
      }),
    });
    mockOrgsSelect.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });
  });

  describe('useAuth', () => {
    it('throws error when used outside AuthProvider', () => {
      const TestComponent = () => {
        useAuth();
        return null;
      };

      expect(() => render(<TestComponent />)).toThrow('useAuth must be used within AuthProvider');
    });
  });

  describe('AuthProvider', () => {
    it('renders children', () => {
      render(
        <AuthProvider>
          <div data-testid="child">Child content</div>
        </AuthProvider>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('signIn calls supabase.auth.signInWithPassword', async () => {
      let capturedSignIn: (email: string, password: string) => Promise<{ error: string | null }>;

      const TestComponent = () => {
        const { signIn } = useAuth();
        capturedSignIn = signIn;
        return null;
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await act(async () => {
        await capturedSignIn('test@example.com', 'password123');
      });

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('signIn returns { error: null } on success', async () => {
      let result: { error: string | null } | undefined;

      const TestComponent = () => {
        const { signIn } = useAuth();
        return (
          <button
            onClick={async () => {
              result = await signIn('test@example.com', 'password123');
            }}
          >
            Sign In
          </button>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const button = screen.getByRole('button', { name: 'Sign In' });
      await act(async () => {
        button.click();
        await waitFor(() => expect(result).toBeDefined());
      });

      expect(result).toEqual({ error: null });
    });

    it('signIn returns error message on failure', async () => {
      mockSignInWithPassword.mockResolvedValue({
        error: { message: 'Invalid credentials' },
      });

      let result: { error: string | null } | undefined;

      const TestComponent = () => {
        const { signIn } = useAuth();
        return (
          <button
            onClick={async () => {
              result = await signIn('test@example.com', 'wrong');
            }}
          >
            Sign In
          </button>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const button = screen.getByRole('button', { name: 'Sign In' });
      await act(async () => {
        button.click();
        await waitFor(() => expect(result).toBeDefined());
      });

      expect(result).toEqual({ error: 'Invalid credentials' });
    });

    it('signUp calls supabase.auth.signUp with full_name in options', async () => {
      let capturedSignUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;

      const TestComponent = () => {
        const { signUp } = useAuth();
        capturedSignUp = signUp;
        return null;
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await act(async () => {
        await capturedSignUp('newuser@example.com', 'password123', 'New User');
      });

      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'password123',
        options: { data: { full_name: 'New User' } },
      });
    });

    it('signUp returns { error: null } on success', async () => {
      let result: { error: string | null } | undefined;

      const TestComponent = () => {
        const { signUp } = useAuth();
        return (
          <button
            onClick={async () => {
              result = await signUp('newuser@example.com', 'password123', 'New User');
            }}
          >
            Sign Up
          </button>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const button = screen.getByRole('button', { name: 'Sign Up' });
      await act(async () => {
        button.click();
        await waitFor(() => expect(result).toBeDefined());
      });

      expect(result).toEqual({ error: null });
    });

    it('signOut calls supabase.auth.signOut', async () => {
      let capturedSignOut: () => Promise<void>;

      const TestComponent = () => {
        const { signOut } = useAuth();
        capturedSignOut = signOut;
        return null;
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await act(async () => {
        await capturedSignOut();
      });

      expect(mockSignOut).toHaveBeenCalled();
    });

    it('sets user when auth callback fires with a session', async () => {
      let capturedCb: ((event: string, session: unknown) => void) | undefined;
      mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
        capturedCb = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });
      // Return existing profile so the insert branch is skipped
      mockProfilesSelect.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'user-1', email: 'test@example.com', full_name: 'Test' },
              error: null,
            }),
          }),
        }),
      });

      let capturedUser: ReturnType<typeof useAuth>['user'] | undefined;
      const TestComponent = () => {
        const { user } = useAuth();
        capturedUser = user;
        return null;
      };

      await act(async () => {
        render(<AuthProvider><TestComponent /></AuthProvider>);
      });

      const mockUser = { id: 'user-1', email: 'test@example.com', user_metadata: {} };
      await act(async () => {
        capturedCb!('SIGNED_IN', { user: mockUser });
      });

      expect(capturedUser).toEqual(mockUser);
    });

    it('clears profile and organizations on SIGNED_OUT event', async () => {
      let capturedCb: ((event: string, session: unknown) => void) | undefined;
      mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
        capturedCb = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      let capturedAuth: ReturnType<typeof useAuth> | undefined;
      const TestComponent = () => {
        capturedAuth = useAuth();
        return null;
      };

      await act(async () => {
        render(<AuthProvider><TestComponent /></AuthProvider>);
      });

      await act(async () => {
        capturedCb!('SIGNED_OUT', null);
      });

      expect(capturedAuth!.profile).toBeNull();
      expect(capturedAuth!.organizations).toEqual([]);
    });

    it('fetches existing profile when user is set via auth callback', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com', user_metadata: {} };

      let capturedCb: ((event: string, session: unknown) => void) | undefined;
      mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
        capturedCb = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      mockProfilesSelect.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'user-1', email: 'test@example.com', full_name: 'Test User' },
              error: null,
            }),
          }),
        }),
      });

      mockOrgsSelect.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [{ id: 'org-1', name: 'Org One' }], error: null }),
        }),
      });

      let capturedAuth: ReturnType<typeof useAuth> | undefined;
      const TestComponent = () => {
        capturedAuth = useAuth();
        return null;
      };

      await act(async () => {
        render(<AuthProvider><TestComponent /></AuthProvider>);
      });

      await act(async () => {
        capturedCb!('SIGNED_IN', { user: mockUser });
      });

      await waitFor(() => {
        expect(capturedAuth!.profile?.id).toBe('user-1');
        expect(capturedAuth!.organizations).toHaveLength(1);
      });
    });
  });
});
