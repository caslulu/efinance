import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

test.describe('Subscriptions Flow', () => {
  const username = `subuser_${randomUUID().replace(/-/g, '').substring(0, 8)}`;
  const password = 'password123';

  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
    await page.fill('input[type="text"]', username);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/login/);

    await page.fill('input[type="text"]', username);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('http://127.0.0.1:5173/');
  });

  test('should create a subscription and trigger check', async ({ page }) => {
    // 1. Create Wallet
    await page.click('button:has-text("New Wallet")');
    await page.fill('label:has-text("Name") + input', 'Sub Wallet');
    await page.selectOption('label:has-text("Type") + select', 'BANK');
    await page.fill('label:has-text("Initial Balance") + input', '1000');
    await page.click('button[type="submit"]:has-text("Create")');

    // 2. Create Category (Need to navigate to Categories first)
    await page.click('a:has-text("Categories")');
    await page.click('button:has-text("New Category")');
    await page.fill('label:has-text("Name") + input', 'Entertainment');
    await page.click('button[type="submit"]:has-text("Create")');

    // 3. Go to Subscriptions
    await page.click('a:has-text("Subscriptions")');
    await expect(page).toHaveURL('http://127.0.0.1:5173/subscriptions');

    // 4. Create Subscription
    await page.click('button:has-text("New Subscription")');
    await page.fill('label:has-text("Name") + input', 'Netflix');
    await page.fill('label:has-text("Value") + input', '50');
    await page.selectOption('label:has-text("Frequency") + select', 'MONTHLY');
    
    // Set start date to yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await page.fill('label:has-text("Start Date") + input', yesterday.toISOString().split('T')[0]);
    
    // Select Wallet and Category (Use label matching)
    await page.selectOption('label:has-text("Wallet") + select', { label: 'Sub Wallet' });
    await page.selectOption('label:has-text("Category") + select', { label: 'Entertainment' });
    
    await page.click('button[type="submit"]:has-text("Create")');

    // 5. Verify in list
    await expect(page.locator('table')).toContainText('Netflix');
    await expect(page.locator('table')).toContainText('R$ 50.00');

    // 6. Trigger Check
    page.on('dialog', dialog => dialog.accept());
    await page.click('button:has-text("Trigger Check")');

    // 7. Verify Transaction was created
    await page.click('a:has-text("Transactions")');
    await expect(page).toHaveURL('http://127.0.0.1:5173/transactions');
    await expect(page.locator('table')).toContainText('R$ 50.00');
  });
});