import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

test.describe('Categories Flow', () => {
  const username = `catuser_${randomUUID().replace(/-/g, '').substring(0, 8)}`;
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

  test('should create, list and delete categories', async ({ page }) => {
    await page.click('a:has-text("Categories")');

    await page.click('button:has-text("New Category")');
    await page.fill('label:has-text("Name") + input', 'Groceries');
    await page.click('button[type="submit"]:has-text("Create")');

    await expect(page.getByText('Groceries')).toBeVisible();

    await page.click('button:has-text("New Category")');
    await page.fill('label:has-text("Name") + input', 'Utilities');
    await page.click('button[type="submit"]:has-text("Create")');
    await expect(page.getByText('Utilities')).toBeVisible();

    page.on('dialog', dialog => dialog.accept());
    await page.locator('li').filter({ hasText: 'Groceries' }).getByText('Delete').click();
    
    await expect(page.getByText('Groceries')).not.toBeVisible();
    await expect(page.getByText('Utilities')).toBeVisible();
  });
});
