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
    await expect(page).toHaveURL('http://127.0.0.1:5173/');
  });

  test('should create, list and delete categories', async ({ page }) => {
    await page.click('a:has-text("Categories")');
    await expect(page).toHaveURL('http://127.0.0.1:5173/categories');

    // 1. Create Category
    await page.click('button:has-text("New Category")');
    await page.fill('label:has-text("Name") + input', 'Groceries');
    await page.click('button[type="submit"]:has-text("Create")');

    // 2. Verify List
    await expect(page.getByText('Groceries')).toBeVisible();

    // 3. Create Another
    await page.click('button:has-text("New Category")');
    await page.fill('label:has-text("Name") + input', 'Utilities');
    await page.click('button[type="submit"]:has-text("Create")');
    await expect(page.getByText('Utilities')).toBeVisible();

    // 4. Delete Category
    page.on('dialog', dialog => dialog.accept());
    await page.locator('li').filter({ hasText: 'Groceries' }).getByText('Delete').click();
    
    await expect(page.getByText('Groceries')).not.toBeVisible();
    await expect(page.getByText('Utilities')).toBeVisible();
  });
});
