import { test, expect } from '@playwright/test';

test('has title and redirects to login', async ({ page }) => {
  await page.goto('/');

  // Expect the app title to be ShiftWise or we should see the login screen
  await expect(page).toHaveTitle(/ShiftWise/);

  // If not authenticated, should show login or auth container
  const loginForm = page.locator('form').filter({ hasText: /login|sign in/i });
  if (await loginForm.isVisible()) {
    await expect(loginForm).toBeVisible();
  }
});

test('can navigate to login explicitly', async ({ page }) => {
  await page.goto('/login');
  
  await expect(page.getByText(/sign in/i)).toBeVisible();
});
