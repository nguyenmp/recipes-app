import { test, expect } from '@playwright/test';
import { Page } from '@playwright/test'
import assert from 'assert';

const TEST_URL = 'admin';

test('can do client side embedding generation (for debugging)', async ({ page }) => {
  await page.goto(TEST_URL);
  await page.getByPlaceholder('Search embeddings').fill('lobsters');

  // It can take a few seconds (~3.5) to load the inference model the first
  // time so this ends up tripping the default 10 second timeout more often
  // than we'd like.  Gently bump this specific situation up to 20 seconds.
  await expect(page.getByText('seafood')).toBeVisible({timeout: 20_000});
  await expect(page.getByText('[-0.03186911344528198,0.03684123605489731,-0.018846208229660988,')).toBeVisible();
});
