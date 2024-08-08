import { test, expect } from '@playwright/test';
import { Page } from '@playwright/test'
import assert from 'assert';

test('we can load images from an expected recipe', async ({ page }) => {
    // Search for Jenny's Dad's Noodle Mix which has 5 images
    await page.goto('recipes');
    await page.getByPlaceholder('Search here...').fill("Jenny's Dad's noodle mix");
    await page.getByText('Search').click();
    await page.getByText("Dads Noodle Mix").click();
    for (const image_name of ['image10.png', 'image11.png', 'image12.png', 'image13.png', 'image14.png']) {
        const loadingPromise = page.waitForResponse(new RegExp('.*\.png\?.*'));
        await page.getByAltText(image_name).click();
        await expect(page.locator('img')).toBeVisible();
        await loadingPromise
        const url = page.url();
        assert(url.includes('r2.cloudflarestorage.com'), `Unknown URL: ${url}`);
        await page.goBack();
    }
});
