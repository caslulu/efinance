import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

test.describe('Transactions Flow', () => {
  const username = `txuser_${randomUUID().replace(/-/g, '').substring(0, 8)}`;
  const password = 'password123';

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') {
      }
    });

    await page.goto('/register');
    await page.fill('input[type="text"]', username);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/login/);

    await page.fill('input[type="text"]', username);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
  });

  test('should full flow: create wallet -> category -> transaction', async ({ page }) => {
    const walletName = 'Primary Bank';
    const categoryName = 'Food';

    await page.click('button:has-text("New Wallet")');
    await page.fill('label:has-text("Name") + input', walletName);
    await page.fill('label:has-text("Initial Balance") + input', '2000');
    await page.click('button[type="submit"]:has-text("Create")');
    await expect(page.getByText(walletName)).toBeVisible();

    await page.click('a:has-text("Categories")');
    await page.click('button:has-text("New Category")');
    await page.fill('label:has-text("Name") + input', categoryName);
    await page.click('button[type="submit"]:has-text("Create")');
    await expect(page.getByText(categoryName)).toBeVisible();

    await page.click('a:has-text("Wallets")');

    await page.click('button:has-text("- Expense")');
    
    await expect(page.getByText('Record Expense')).toBeVisible();
    
    await page.fill('label:has-text("Amount") + input', '45.50');
    
    await page.selectOption('label:has-text("Category") + select', { label: categoryName });
    
    await page.click('button:has-text("Confirm")');

    await expect(page.getByText('R$ 1954.50')).toBeVisible();

    await page.click('a:has-text("Transactions")');
    await expect(page.locator('table')).toContainText('EXPENSE');
    await expect(page.locator('table')).toContainText(categoryName);
    await expect(page.locator('table')).toContainText('R$ 45.50');
  });
});
