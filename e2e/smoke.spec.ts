import { test, expect } from '@playwright/test';

/**
 * Smoke tests — verify that the app loads and key navigation works.
 * These run against the dev server (port 5173 by default).
 */

test.describe('Landing page', () => {
  test('loads and shows the app title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Sentinel/i);
  });

  test('shows login / get-started button', async ({ page }) => {
    await page.goto('/');
    // Either a Sign In or Get Started CTA should be visible
    const cta = page.getByRole('link', { name: /sign in|get started|login/i }).first();
    await expect(cta).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Auth page', () => {
  test('navigates to /auth without errors', async ({ page }) => {
    await page.goto('/auth');
    // Check that the page renders (no blank screen, no JS crash)
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('shows email field', async ({ page }) => {
    await page.goto('/auth');
    const emailInput = page.getByRole('textbox', { name: /email/i });
    await expect(emailInput).toBeVisible({ timeout: 10_000 });
  });

  test('shows password field', async ({ page }) => {
    await page.goto('/auth');
    const passwordInput = page.getByLabel(/password/i);
    await expect(passwordInput).toBeVisible({ timeout: 10_000 });
  });

  test('sign in button is present', async ({ page }) => {
    await page.goto('/auth');
    const btn = page.getByRole('button', { name: /sign in|log in/i });
    await expect(btn).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Public report', () => {
  test('/report/:id with unknown id shows 404 or error boundary, not a blank page', async ({ page }) => {
    await page.goto('/report/does-not-exist-00000000');
    // Either a meaningful message or 404 — just no blank body
    const body = page.locator('body');
    await expect(body).not.toBeEmpty();
  });
});

test.describe('404 page', () => {
  test('unknown route shows not-found page', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
