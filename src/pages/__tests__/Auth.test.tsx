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
});
