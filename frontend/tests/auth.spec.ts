import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

test.describe('Authentication Flow', () => {
  const username = `testuser_${randomUUID().replace(/-/g, '').substring(0, 8)}`;
  const password = 'password123';

  test('should register, login, and access dashboard', async ({ page }) => {
    // Listen to browser console logs
    page.on('console', msg => console.log('Browser Log:', msg.text()));

    // 1. Register
    await page.goto('/register');
    await page.fill('input[type="text"]', username);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // Debug: Check if error appeared
    const errorMsgLocator = page.locator('.text-red-600');
    if (await errorMsgLocator.isVisible()) {
      console.log('Registration Error:', await errorMsgLocator.textContent());
    }

    // Should redirect to login
    await expect(page).toHaveURL('/login');

    // 2. Login
    await page.fill('input[type="text"]', username);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // Should redirect to home/dashboard (Wallets Page)
    await expect(page).toHaveURL('/');
    
    // Check for Dashboard elements
    await expect(page.getByText(`Hi, ${username}`)).toBeVisible();
    await expect(page.getByText('My Wallets')).toBeVisible();
  });

  test('should redirect unauthenticated user to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });
});
