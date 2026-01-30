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
  });

  test('should create a subscription and trigger check', async ({ page }) => {
    await page.click('button:has-text("New Wallet")');
    await page.fill('label:has-text("Name") + input', 'Sub Wallet');
    await page.fill('label:has-text("Initial Balance") + input', '1000');
    await page.click('button[type="submit"]:has-text("Create")');

    await page.evaluate(async () => {
        const token = localStorage.getItem('token');
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: 'Entertainment' })
        });
    });

    await page.click('a:has-text("Subscriptions")');

    await page.click('button:has-text("New Subscription")');
    await page.fill('label:has-text("Name") + input', 'Netflix');
    await page.fill('label:has-text("Value") + input', '50');
    await page.selectOption('label:has-text("Frequency") + select', 'MONTHLY');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await page.fill('label:has-text("Start Date") + input', yesterday.toISOString().split('T')[0]);
    
    await page.selectOption('label:has-text("Wallet") + select', { label: 'Sub Wallet' });
    await page.selectOption('label:has-text("Category") + select', { label: 'Entertainment' });
    
    await page.click('button[type="submit"]:has-text("Create")');

    await expect(page.locator('table')).toContainText('Netflix');
    await expect(page.locator('table')).toContainText('R$ 50.00');

    await page.click('button:has-text("Trigger Check")');

    await page.click('a:has-text("Transactions")');
    await expect(page.locator('table')).toContainText('R$ 50.00');
  });
});
