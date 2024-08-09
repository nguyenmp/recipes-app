import { expect, Page } from "@playwright/test";

export const RECIPES_LINK = '/recipes'

/**
 * Note, we don't use uuid because it contains numbers and dashes, which
 * results in a highly likely string that is broken into many small queries
 */
export function generateRandomString(length: number): string {
    return Array.from(Array(length), () => {
      const low = 'a'.charCodeAt(0);
      const high = 'z'.charCodeAt(0);
      const result = String.fromCharCode(Math.round((Math.random() * (high - low)) + low));
      if (Math.random() < 0.5) return result.toUpperCase();
      return result;
    }).join('');
}

export async function createNewRecipe(page: Page): Promise<{name: string, id: number, url: string}> {
    await page.goto(RECIPES_LINK);

    // Create a new recipe
    const name = generateRandomString(40);
    await page.getByText('Create New Recipe').click();
    await page.waitForURL('/recipes/new');
    await page.getByLabel('Name').fill(name);

    await page.getByText('Save New Recipe').click();

    const pattern = new RegExp('/recipes/(?<recipe_id>[0-9]+)');
    await page.waitForURL(pattern);
    const url = page.url();
    const id = new Number(url.match(pattern)!.groups!.recipe_id).valueOf()

    await expect(page.getByText('Add a new note')).toBeVisible();

    return {name, id, url};
}