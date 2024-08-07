import { test, expect } from '@playwright/test';

const TEST_URL = 'http://localhost:3000/recipes';

test('can load recipes', async ({ page }) => {
  await page.goto(TEST_URL);
});

test('can search recipes', async ({ page }) => {
  await page.goto(TEST_URL);
  await page.getByPlaceholder('Search here...').fill('tomatoes and eggs');
  await page.getByText('Search').click();
  await expect(page.getByText('Deviled Eggs')).toBeVisible();
  await expect(page.getByText('Boiled Eggs')).toBeVisible();
  await expect(page.getByText('Eggslut Copy Cat')).toBeVisible();
});