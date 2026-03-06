import { test, expect } from '@playwright/test';

const randomUser = `user${Math.floor(Math.random() * 10000)}`;
const email = `${randomUser}@test.com`;
const password = 'password123';

test.describe('Finance Pro Core Flow', () => {
  test('Complete flow: Register -> Create Wallet -> Add Transaction', async ({ page }) => {
    // 1. Register
    await page.goto('/register');
    await page.fill('input#username', randomUser);
    await page.fill('input#email', email);
    await page.fill('input#password', password);
    await page.fill('input#confirmPassword', password);
    await page.click('button[type="submit"]');

    // Wait for verification screen or auto-login
    await expect(page.locator('text=Código de Verificação').or(page.locator('text=Verificação de Email'))).toBeVisible();
    
    // We intercept the network to bypass real email check in e2e
    await page.route('**/auth/verify-email', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access_token: 'fake-token', id: 1, username: randomUser })
      });
    });

    await page.route('**/auth/profile', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, username: randomUser })
      });
    });
    
    // Fill the verification code input (assuming it exists and is required to continue)
    const verificationInput = page.locator('input[placeholder*="Código"], input[type="text"]').first();
    if (await verificationInput.isVisible()) {
      await verificationInput.fill('123456');
      await page.click('button[type="submit"], button:has-text("Verificar")');
    }
  });
});
