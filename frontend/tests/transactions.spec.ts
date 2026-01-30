import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

test.describe('Transactions Flow', () => {
  const username = `txuser_${randomUUID().replace(/-/g, '').substring(0, 8)}`;
  const password = 'password123';

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('Browser:', msg.text()));
    await page.goto('/register');
    await page.fill('input[type="text"]', username);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/login/);

    await page.fill('input[type="text"]', username);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
  });

  test('should record an expense and show it in transaction history', async ({ page }) => {
    const walletName = 'Primary Bank';

    await page.click('button:has-text("New Wallet")');
    await page.fill('label:has-text("Name") + input', walletName);
    await page.fill('label:has-text("Initial Balance") + input', '2000');
    await page.click('button[type="submit"]:has-text("Create")');

    await page.click('button:has-text("- Expense")');
    await page.fill('label:has-text("Amount") + input', '45.50');
    await page.click('button:has-text("Confirm")');

    await page.click('a:has-text("Transactions")');

    await expect(page.locator('table')).toContainText('EXPENSE');
    await expect(page.locator('table')).toContainText('R$ 45.50');
  });
});
