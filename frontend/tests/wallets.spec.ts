import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

test.describe('Wallets Flow', () => {
  const username = `walletuser_${randomUUID().replace(/-/g, '').substring(0, 8)}`;
  const password = 'password123';

  test.beforeEach(async ({ page }) => {
    // 1. Register and Login to be ready
    await page.goto('/register');
    await page.fill('input[type="text"]', username);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/login');

    await page.fill('input[type="text"]', username);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('should create a wallet and manage balance', async ({ page }) => {
    const walletName = 'Test Wallet';

    // 1. Create Wallet
    await page.click('button:has-text("New Wallet")');
    await page.fill('label:has-text("Name") + input', walletName);
    await page.selectOption('label:has-text("Type") + select', 'BANK');
    await page.fill('label:has-text("Initial Balance") + input', '1000');
    await page.click('button[type="submit"]:has-text("Create")');

    // 2. Verify Wallet Card
    await expect(page.getByText(walletName)).toBeVisible();
    await expect(page.getByText('R$ 1000.00')).toBeVisible();

    // 3. Add Funds
    await page.click('button:has-text("+ Add Funds")');
    await page.fill('label:has-text("Amount") + input', '500');
    await page.click('button:has-text("Confirm")');
    
    // 4. Verify Updated Balance
    await expect(page.getByText('R$ 1500.00')).toBeVisible();

    // 5. Add Expense
    await page.click('button:has-text("- Expense")');
    await page.fill('label:has-text("Amount") + input', '200');
    await page.click('button:has-text("Confirm")');

    // 6. Verify Final Balance
    await expect(page.getByText('R$ 1300.00')).toBeVisible();
  });
});
