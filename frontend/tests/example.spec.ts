import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {

  await expect(page).toHaveTitle(/Playwright/);
});

test('get started link', async ({ page }) => {

  await page.getByRole('link', { name: 'Get started' }).click();

  await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
});
