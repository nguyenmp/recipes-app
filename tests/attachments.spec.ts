import { test, expect } from '@playwright/test';
import { Page } from '@playwright/test'
import assert from 'assert';
import { createNewRecipe } from './utils';
import path from 'path';

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

test('we can upload a new attachment to an existing note and it will append', async ({ page }) => {
    await page.goto('recipes');

    // Create a new recipe to test with
    const recipe = await createNewRecipe(page);
    await page.getByText('Add a new note').click();

    // add a single attachment
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('#new_attachment').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(__dirname, '../README.md'));
    await expect(page.getByText('finished - Response for')).toBeVisible();
    await page.getByText('Save New Note').click();
    
    // Wait for saving to finish
    await expect(page.getByText('Edit Recipe')).toBeVisible();

    await expect(page.getByAltText('README.md')).toBeInViewport();

    // Edit the existing attachment and add a new file
    await page.getByText('Edit Note').click();

    const fileChooserPromise2 = page.waitForEvent('filechooser');
    await page.waitForTimeout(5000);
    await page.locator('#new_attachment').click();
    const fileChooser2 = await fileChooserPromise2;
    await fileChooser2.setFiles(path.join(__dirname, '../LICENSE.txt'));
    await expect(page.getByText('finished - Response for')).toBeVisible();
    await page.getByText('Save Note').click();

    // Wait for saving to finish
    await expect(page.getByText('Edit Recipe')).toBeVisible();

    await expect(page.getByAltText('README.md')).toBeInViewport();
    await expect(page.getByAltText('LICENSE.txt')).toBeInViewport();
});