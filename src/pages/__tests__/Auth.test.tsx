import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Auth from '../Auth';

const { mockSignIn, mockSignUp, mockNavigate } = vi.hoisted(() => ({
  mockSignIn: vi.fn().mockResolvedValue({ error: null }),
  mockSignUp: vi.fn().mockResolvedValue({ error: null }),
  mockNavigate: vi.fn(),
}));

vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    signUp: mockSignUp,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('Auth — Sign In mode (default)', () => {
  beforeEach(() => {
    mockSignIn.mockReset();
    mockSignIn.mockResolvedValue({ error: null });
    mockSignUp.mockReset();
    mockSignUp.mockResolvedValue({ error: null });
  });

  it('renders "Welcome back" heading', () => {
    render(<Auth />);
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
  });

  it('renders Email input', () => {
    render(<Auth />);
    expect(screen.getByPlaceholderText('you@company.com')).toBeInTheDocument();
  });

  it('renders Password input', () => {
    render(<Auth />);
    expect(screen.getByPlaceholderText('Minimum 6 characters')).toBeInTheDocument();
  });

  it('renders "Sign in" submit button', () => {
    render(<Auth />);
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeInTheDocument();
  });

  it('renders Sentinel AI brand', () => {
    render(<Auth />);
    expect(screen.getByText('Sentinel AI')).toBeInTheDocument();
  });

  it('shows error message on auth failure', async () => {
    mockSignIn.mockResolvedValue({ error: 'Invalid email or password' });
    render(<Auth />);
    fireEvent.change(screen.getByPlaceholderText('you@company.com'), { target: { value: 'bad@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Minimum 6 characters'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));
    await waitFor(() =>
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument(),
    );
  });

  it('calls signIn with email and password on form submit', async () => {
    render(<Auth />);
    fireEvent.change(screen.getByPlaceholderText('you@company.com'), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Minimum 6 characters'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith('user@test.com', 'password123'));
  });
});

describe('Auth — Sign Up mode', () => {
  it('switches to "Create your account" when Create one is clicked', () => {
    render(<Auth />);
    fireEvent.click(screen.getByText('Create one'));
    expect(screen.getByText('Create your account')).toBeInTheDocument();
  });

  it('shows "Full name" input in signup mode', () => {
    render(<Auth />);
    fireEvent.click(screen.getByText('Create one'));
    expect(screen.getByPlaceholderText('Jane Doe')).toBeInTheDocument();
  });

  it('renders "Create account" button in signup mode', () => {
    render(<Auth />);
    fireEvent.click(screen.getByText('Create one'));
    expect(screen.getByRole('button', { name: /Create account/i })).toBeInTheDocument();
  });

  it('calls signUp with email, password, fullName on submit', async () => {
    render(<Auth />);
    fireEvent.click(screen.getByText('Create one'));
    fireEvent.change(screen.getByPlaceholderText('Jane Doe'), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByPlaceholderText('you@company.com'), { target: { value: 'jane@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Minimum 6 characters'), { target: { value: 'Pass1234!' } });
    fireEvent.click(screen.getByRole('button', { name: /Create account/i }));
    await waitFor(() =>
      expect(mockSignUp).toHaveBeenCalledWith('jane@test.com', 'Pass1234!', 'Jane Doe'),
    );
  });

  it('shows error message on sign up failure', async () => {
    mockSignUp.mockResolvedValue({ error: 'Email already registered' });
    render(<Auth />);
    fireEvent.click(screen.getByText('Create one'));
    fireEvent.change(screen.getByPlaceholderText('Jane Doe'), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByPlaceholderText('you@company.com'), { target: { value: 'exists@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Minimum 6 characters'), { target: { value: 'Pass1234!' } });
    fireEvent.click(screen.getByRole('button', { name: /Create account/i }));
    await waitFor(() =>
      expect(screen.getByText('Email already registered')).toBeInTheDocument(),
    );
  });

  it('shows password strength bar in signup mode', () => {
    render(<Auth />);
    fireEvent.click(screen.getByText('Create one'));
    fireEvent.change(screen.getByPlaceholderText('Minimum 6 characters'), { target: { value: 'abc' } });
    expect(screen.getByText(/At least 8 characters/i)).toBeInTheDocument();
  });

  it('shows "weak" level for short password', () => {
    render(<Auth />);
    fireEvent.click(screen.getByText('Create one'));
    fireEvent.change(screen.getByPlaceholderText('Minimum 6 characters'), { target: { value: 'abc' } });
    expect(screen.getByText('weak')).toBeInTheDocument();
  });

  it('shows "fair" level for moderate password', () => {
    render(<Auth />);
    fireEvent.click(screen.getByText('Create one'));
    fireEvent.change(screen.getByPlaceholderText('Minimum 6 characters'), { target: { value: 'Abcdefgh1' } });
    expect(screen.getByText('fair')).toBeInTheDocument();
  });

  it('shows "strong" level for strong password', () => {
    render(<Auth />);
    fireEvent.click(screen.getByText('Create one'));
    fireEvent.change(screen.getByPlaceholderText('Minimum 6 characters'), { target: { value: 'Abcdef12!@' } });
    expect(screen.getByText('strong')).toBeInTheDocument();
  });

  it('checks "Uppercase letter" indicator when uppercase present', () => {
    render(<Auth />);
    fireEvent.click(screen.getByText('Create one'));
    fireEvent.change(screen.getByPlaceholderText('Minimum 6 characters'), { target: { value: 'Abcdefgh' } });
    expect(screen.getByText('Uppercase letter')).toBeInTheDocument();
  });

  it('checks "Number" indicator when digit present', () => {
    render(<Auth />);
    fireEvent.click(screen.getByText('Create one'));
    fireEvent.change(screen.getByPlaceholderText('Minimum 6 characters'), { target: { value: 'abcdef1' } });
    expect(screen.getByText('Number')).toBeInTheDocument();
  });

  it('switches back to sign in mode when "Sign in" link clicked in signup', () => {
    render(<Auth />);
    fireEvent.click(screen.getByText('Create one'));
    expect(screen.getByText('Create your account')).toBeInTheDocument();
    // In signup mode there's a "Sign in" link to switch back
    fireEvent.click(screen.getByText('Sign in'));
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
  });
});

describe('Auth — password visibility toggle', () => {
  it('toggles password field to text when Show password clicked', () => {
    render(<Auth />);
    const pwdInput = screen.getByPlaceholderText('Minimum 6 characters');
    expect(pwdInput).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(pwdInput).toHaveAttribute('type', 'text');
  });

  it('toggles back to password type when Hide password clicked', () => {
    render(<Auth />);
    fireEvent.click(screen.getByRole('button', { name: /show password/i }));
    fireEvent.click(screen.getByRole('button', { name: /hide password/i }));
    expect(screen.getByPlaceholderText('Minimum 6 characters')).toHaveAttribute('type', 'password');
  });
});

describe('Auth — navigation', () => {
  it('navigates to /landing when Back button clicked', () => {
    render(<Auth />);
    fireEvent.click(screen.getByText('Back'));
    expect(mockNavigate).toHaveBeenCalledWith('/landing');
  });

  it('renders security badges: AES-256, Zero-knowledge, SOC 2', () => {
    render(<Auth />);
    expect(screen.getByText('AES-256 encrypted')).toBeInTheDocument();
    expect(screen.getByText('Zero-knowledge')).toBeInTheDocument();
    expect(screen.getByText('SOC 2 compliant')).toBeInTheDocument();
  });
});
