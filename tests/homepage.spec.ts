import { test, expect } from '@playwright/test';

export const TEST_URL = 'http://localhost:3000/'

test('can load and navigate to recipes', async ({ page }) => {
  await page.goto(TEST_URL);

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Recipes App/);
  await page.getByText('Get Started').click();
  await expect(page).toHaveURL(TEST_URL + 'recipes');
  await expect(page.getByText('Create New Recipe')).toBeInViewport();
});