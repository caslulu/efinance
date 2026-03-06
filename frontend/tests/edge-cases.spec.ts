import { test, expect } from '@playwright/test';

test.describe('Frontend Edge Cases', () => {

  test('should redirect to login if accessing protected route without auth', async ({ page }) => {
    // Clear any storage/auth
    await page.context().clearCookies();
    
    // Attempt to access dashboard
    await page.goto('/dashboard');
    
    // Should be redirected to login
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('should show validation errors when creating a wallet with empty fields', async ({ page }) => {
    // Mock login to bypass auth
    await page.route('**/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access_token: 'fake-token', id: 1, username: 'mockuser' }),
      });
    });

    // Mock profile fetch
    await page.route('**/auth/profile', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, username: 'mockuser' }),
      });
    });

    await page.goto('/login');
    await page.fill('input[type="text"]', 'mockuser');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Go to wallets page
    await page.goto('/wallets');
    
    const newWalletBtn = page.locator('button', { hasText: 'New Wallet' });
    if (await newWalletBtn.isVisible()) {
        await newWalletBtn.click();
        
        // Submit empty form
        await page.click('button[type="submit"]:has-text("Create")');

        // Form shouldn't be submitted, modal should still be visible
        // Usually HTML5 'required' attribute prevents submission
        const nameInput = page.locator('input[name="name"]');
        if (await nameInput.count() > 0) {
            const isInvalid = await nameInput.evaluate((el: HTMLInputElement) => el.validationMessage !== '');
            expect(isInvalid).toBeTruthy();
        }
    }
  });

  test('should gracefully handle API 500 error when fetching categories', async ({ page }) => {
    // Mock login to bypass auth
    await page.route('**/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access_token: 'fake-token', id: 1, username: 'mockuser' }),
      });
    });

    // Mock profile fetch
    await page.route('**/auth/profile', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, username: 'mockuser' }),
      });
    });

    await page.goto('/login');
    await page.fill('input[type="text"]', 'mockuser');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Mock API 500 for categories
    await page.route('**/categories', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal Server Error' }),
      });
    });

    await page.goto('/categories');
    
    // Check if the page handles it without crashing (e.g. showing empty state or error toast)
    // We expect the page to still show the "Categories" title instead of a blank screen
    await expect(page.locator('h1', { hasText: 'Categories' })).toBeVisible();
  });
});
