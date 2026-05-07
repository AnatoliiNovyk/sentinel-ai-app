import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

	const { mockGetSession, mockHttpPost, mockAuthState, mockAuthProfile } = vi.hoisted(() => ({
	mockGetSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test-token' } } }),
	mockHttpPost: vi.fn(),
	mockAuthState: {
		user: { id: 'user-1' } as { id: string } | null,
	},
	mockAuthProfile: {
		id: 'user-1',
		email: 'test@example.com',
		full_name: 'Jane Doe',
		company: 'Acme Corp',
		plan: 'basic' as string | null,
		sla_config: null,
		avatar_url: null,
		created_at: '2026-01-01T00:00:00Z',
		sla_warned_at: null,
	},
}));

vi.mock('../../lib/supabase', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/supabase')>();
	return {
		...actual,
		supabase: {
			auth: {
				getSession: mockGetSession,
			},
			from: vi.fn(() => ({
				select: vi.fn(() => ({
					eq: vi.fn(() => ({
						order: vi.fn(() => ({
							limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
						})),
					})),
				})),
			})),
		},
	};
});

vi.mock('../../lib/httpClient', () => ({
	httpPost: mockHttpPost,
}));

vi.mock('../../context/useAuth', () => ({
	useAuth: () => ({
		user: mockAuthState.user,
		profile: mockAuthProfile,
	}),
}));

vi.mock('../../components/ApiRateLimitsPanel', () => ({
	ApiRateLimitsPanel: ({ userId, planId }: { userId: string; planId: string }) => (
		<div>API Rate Limits {userId} {planId}</div>
	),
}));

async function renderSubscription() {
	const mod = await import('../Settings');
	await act(async () => {
		render(<mod.default />);
	});
}

describe('SettingsSubscription env-dependent branches', () => {
	afterEach(() => {
		vi.clearAllMocks();
		vi.unstubAllEnvs();
		vi.resetModules();
		mockAuthState.user = { id: 'user-1' };
		mockAuthProfile.plan = 'basic';
		mockGetSession.mockResolvedValue({ data: { session: { access_token: 'test-token' } } });
	});

	it('opens configured Stripe billing portal URL when env is present', async () => {
		vi.stubEnv('VITE_STRIPE_PORTAL_URL', 'https://billing.stripe.test/portal');
		const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

		await renderSubscription();
		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: /manage billing/i }));
		});

		expect(openSpy).toHaveBeenCalledWith('https://billing.stripe.test/portal', '_blank');
		openSpy.mockRestore();
	});

	it('renders ApiRateLimitsPanel when user and profile are present with fallback free plan id', async () => {
		mockAuthProfile.plan = null;

		await renderSubscription();

		expect(screen.getByText((content) => content.includes('API Rate Limits user-1 free'))).toBeInTheDocument();
	});

	it('falls back to mailto when Stripe checkout succeeds without url', async () => {
		vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_123');
		vi.stubEnv('VITE_STRIPE_PRO_PRICE_ID', 'price_pro_123');
		vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co');
		mockHttpPost.mockResolvedValueOnce({});
		const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

		await renderSubscription();
		const upgradeBtn = screen.getAllByRole('button', { name: /upgrade/i })[1];

		await act(async () => {
			fireEvent.click(upgradeBtn);
		});

		await waitFor(() => {
			expect(mockHttpPost).toHaveBeenCalled();
			expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('mailto:'), '_blank');
		});

		openSpy.mockRestore();
	});

	it('shows processing state during in-flight Stripe checkout request', async () => {
		vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_123');
		vi.stubEnv('VITE_STRIPE_PRO_PRICE_ID', 'price_pro_123');
		vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co');

		let resolveRequest: ((value: { url?: string }) => void) | null = null;
		mockHttpPost.mockImplementationOnce(
			() => new Promise((resolve) => {
				resolveRequest = resolve;
			})
		);
		const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

		await renderSubscription();
		const upgradeBtn = screen.getAllByRole('button', { name: /upgrade/i })[1];

		await act(async () => {
			fireEvent.click(upgradeBtn);
		});

		await waitFor(() => {
			expect(screen.getByText(/Processing/i)).toBeInTheDocument();
		});

		await act(async () => {
			resolveRequest?.({});
		});

		await waitFor(() => {
			expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('mailto:'), '_blank');
		});

		openSpy.mockRestore();
	});
});
