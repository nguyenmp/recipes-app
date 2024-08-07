import { test, expect } from '@playwright/test';
import { Page } from '@playwright/test'
import assert from 'assert';

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

test('clicking a recipe goes to the correct recipe', async ({ page }) => {
  await page.goto(TEST_URL);
  for (let index = 1; index < 6; index++) {
    const selector = `:nth-match(a > h1, ${index})`;
    const recipeName = await page.locator(selector).textContent();
    assert(recipeName, 'No recipe name found');
    await page.locator(selector).click();
    await page.waitForURL(/recipes\/[\d]+/);
    await expect(page.locator('h1').getByText(recipeName)).toBeVisible();
    await expect(page.getByText('Add a new note')).toBeAttached();
    await page.goBack();
  }
});

test('clicking a specific recipe goes to the correct recipe', async ({ page }) => {
  await page.goto(TEST_URL);
  await page.getByPlaceholder('Search here...').fill('blue corn waffle');
  await page.getByText('Search', {exact: true}).click();
  await page.getByText('Blue Corn Waffles / Pancakes').click();
  await expect(page.getByText('https://www.eatingwell.com/recipe/7902149/blue-corn-waffles-rancheros/')).toBeVisible();
  await expect(page.getByText('Note, it uses cornmeal instead')).toBeVisible();
});

async function testForSuggestedTerm(page: Page, term: string, expected_query: string) {
  // We use {force: true} here because this test fails on WebKit almost all the time
  await page.getByText(`+${term}`, {exact: true}).click({force: true});
  await expect(page).toHaveURL(new RegExp(`[=+]${term}[+]?`));
  await expect(page.getByPlaceholder('Search here...')).toHaveValue(expected_query);
}

test('levenshtein suggestions work and we reduce query supersets', async ({ page }) => {
  await page.goto(TEST_URL);
  await page.getByPlaceholder('Search here...').fill('tomatoes and eggs');
  await page.getByText('Search', {exact: true}).click();
  await testForSuggestedTerm(page, 'tomato', 'tomato and eggs');
});

test('stored embeddings suggestions work', async ({ page }) => {
  await page.goto(TEST_URL);
  await page.getByPlaceholder('Search here...').fill('wrapper');
  await page.getByText('Search').click();
  await testForSuggestedTerm(page, 'blanket', 'wrapper blanket');
});

test('dynamic (realtime) embeddings suggestions work', async ({ page }) => {
  await page.goto(TEST_URL);
  await page.getByPlaceholder('Search here...').fill('lobsters');
  await page.getByText('Search').click();

  // It is crucial that lobsters does not resolve to a page, meaning it won't
  // be a known word in our db thus we are finding this related terms through
  // dynamic (realtime) embedding generation
  await expect(page.getByText('No results found')).toBeVisible();
  await testForSuggestedTerm(page, 'lobster', 'lobster');
});

test('recipes front page is cached between loads, and reset when cache is cleared', async ({page}) => {
  await page.goto(TEST_URL);
  const firstRecipeName = await page.locator('a > h1').first().textContent()
  await page.reload();
  assert(firstRecipeName === await page.locator('a > h1').first().textContent(), 'Recipe changed unexpectedly without cache clearing');
  await page.goto('http://localhost:3000/admin');
  await page.getByText('Reset Cache').click();
  await page.waitForURL('http://localhost:3000/');
  await page.goto(TEST_URL);
  assert(firstRecipeName !== await page.locator('a > h1').first().textContent(), 'Recipe did not change after clearing cache');
});