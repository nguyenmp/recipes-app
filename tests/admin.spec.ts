import { test, expect } from '@playwright/test';
import { Page } from '@playwright/test'
import assert from 'assert';

const TEST_URL = 'http://localhost:3000/admin';

test('can do client side embedding generation (for debugging)', async ({ page }) => {
  await page.goto(TEST_URL);
  await page.getByPlaceholder('Search embeddings').fill('lobsters');
  await expect(page.getByText('seafood')).toBeVisible();
  await expect(page.getByText('[-0.03186911344528198,0.03684123605489731,-0.018846208229660988,')).toBeVisible();
});
