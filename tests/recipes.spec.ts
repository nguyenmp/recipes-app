import { test, expect } from '@playwright/test';
import { Page } from '@playwright/test'
import assert from 'assert';
import {createNewRecipe, generateRandomString} from './utils'

const TEST_URL = '/recipes';

test('can load recipes', async ({ page }) => {
  await page.goto(TEST_URL);
});

test('can search recipes', async ({ page }) => {
  await page.goto(TEST_URL);
  await page.getByPlaceholder('Search here...').fill('tomatoes and eggs');
  await page.getByText('Search').click();

  // These are high ranked matches so they should be way up top
  await expect(page.getByText('Deviled Eggs')).toBeInViewport();
  await expect(page.getByText('Boiled Eggs')).toBeInViewport();
  await expect(page.getByText('Eggslut Copy Cat')).toBeInViewport();

  // This is a low ranked match so it should be way near the bottom (off screen)
  await expect(page.getByText('Fried Egg Quesadilla By Sam Sifton')).not.toBeInViewport();
});

test('autoload search results by typing', async ({ page }) => {
  await page.goto(TEST_URL);
  await page.getByPlaceholder('Search here...').fill('tomatoes and eggs');
  await expect(page.getByText('Deviled Eggs')).toBeInViewport();
  await expect(page.getByText('Ramen')).not.toBeInViewport();
  await page.getByPlaceholder('Search here...').fill('ramen');
  await expect(page.getByText('Ramen Salad')).toBeInViewport();
});

test('a very specific almost exact match should rank number one (also capital letters)', async ({ page }) => {
    // Search for Jenny's Dad's Noodle Mix which has 5 images
    await page.goto('recipes');
    await page.getByPlaceholder('Search here...').fill("Jenny's Dad's Noodle Mix");
    await page.getByText('Search').click();
    await expect(page.getByText("Dads Noodle Mix")).toBeInViewport();
    // It should be the top result
    await expect(page.locator(':nth-match(a > h1, 1)')).toContainText('Jenny’s Dads Noodle Mix')
})

test('clicking a recipe goes to the correct recipe', async ({ page }) => {
  await page.goto(TEST_URL);
  for (let index = 1; index < 6; index++) {
    const selector = `:nth-match(a > h1, ${index})`;
    const recipeName = await page.locator(selector).textContent();
    await page.locator(selector).click();
    await page.waitForURL(/recipes\/[\d]+/);
    await expect(page.locator('h1').getByText(recipeName ?? '')).toBeVisible();
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

test.describe('suggested terms', () => {
  async function testForSuggestedTerm(page: Page, term: string, expected_query: string) {
    // We use {force: true} here because this test fails on WebKit almost all the time
    await page.getByText(`+${term}`, {exact: true}).click();
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
});

test('recipes front page is cached between loads, and reset when cache is cleared', async ({page}) => {
  await page.goto(TEST_URL);
  const firstRecipeName = await page.locator('a > h1').first().textContent()
  await page.reload();
  assert(firstRecipeName === await page.locator('a > h1').first().textContent(), 'Recipe changed unexpectedly without cache clearing');
  await page.goto('/admin');
  await page.getByText('Reset Cache').click();
  await page.waitForURL('/');
  await page.goto(TEST_URL);
  assert(firstRecipeName !== await page.locator('a > h1').first().textContent(), 'Recipe did not change after clearing cache');
});

test('create a new recipe, we should be able to find it and the content', async ({ page }) => {
  await page.goto(TEST_URL);

  // Create a new recipe
  const recipe = await createNewRecipe(page);

  // Add a note
  const note_content = generateRandomString(40);
  await page.getByText('Add a new note').click();
  await page.getByLabel('Content').fill(note_content);
  await expect(page.locator('.markdown-container').getByText(note_content)).toBeVisible();
  await page.getByText('Save New Note').click();

  // New note should be visible
  await page.waitForURL(recipe.url);
  await expect(page.getByText(recipe.name)).toBeVisible();
  await expect(page.getByText(note_content)).toBeVisible();

  // Search by that recipe
  await page.goto(TEST_URL);
  await page.getByPlaceholder('Search here...').fill(recipe.name.slice(4, 19));
  await page.getByText('Search').click();
  await expect(page.getByText(recipe.name)).toBeVisible();

  // Search by that note
  await page.goto(TEST_URL);
  await page.getByPlaceholder('Search here...').fill(note_content.slice(14, 30));
  await page.getByText('Search').click();
  await expect(page.getByText(recipe.name)).toBeVisible();
});

test('edit a recipe should invalidate cache and searches', async ({ page }) => {
  await page.goto(TEST_URL);

  // Create a new recipe
  const old_recipe = await createNewRecipe(page);

  // Recipe should be visible in search
  await page.goto(TEST_URL);
  await page.getByPlaceholder('Search here...').fill(old_recipe.name.slice(4, 19));
  await page.getByText('Search').click();
  await expect(page.getByText(old_recipe.name)).toBeVisible();

  // Edit recipe name
  const new_recipe_name = generateRandomString(40);
  await page.getByText(old_recipe.name).click();
  await page.getByText('Edit Recipe').click();
  await page.getByLabel('Name').fill(new_recipe_name);
  await page.getByText('Save Recipe').click();

  // Wait for recipe to save and for us to redirect back to the view
  await expect(page.getByText('Add a new note')).toBeVisible();

  // This is an assertion, we should not see the old recipe name, we should only see the new one
  await expect(page.getByText(old_recipe.name)).toBeVisible({visible: false});
  await expect(page.getByText(new_recipe_name)).toBeVisible();

  // We should be able to serch by the new name
  await page.goto(TEST_URL);
  await page.getByPlaceholder('Search here...').fill(new_recipe_name.slice(4, 19));
  await page.getByText('Search').click();
  await expect(page.getByText(new_recipe_name)).toBeVisible();
  await expect(page.getByText(old_recipe.name)).toBeVisible({visible: false});

  // But not the old one
  await page.goto(TEST_URL);
  await page.getByPlaceholder('Search here...').fill(old_recipe.name);
  await page.getByText('Search').click();
  await expect(page.getByText('No results found')).toBeVisible();
});


test('add and edit a note should invalidate cache and searches', async ({ page }) => {
  await page.goto(TEST_URL);

  // Create a new recipe
  const recipe = await createNewRecipe(page);

  const old_note_content = generateRandomString(40);
  await page.getByText('Add a new note').click();
  await page.getByLabel('Content').fill(old_note_content);
  await page.getByText('Save New Note').click();

  await expect(page.getByText('Edit Note')).toBeVisible();
  await expect(page.getByText(old_note_content)).toBeVisible();

  const new_note_content = generateRandomString(40);
  await page.getByText('Edit Note').click();
  await page.getByLabel('Content').fill(new_note_content);
  await page.getByText('Save Note').click();

  await expect(page.getByText('Edit Note')).toBeVisible();
  await expect(page.getByText(old_note_content)).toBeVisible({visible: false});
  await expect(page.getByText(new_note_content)).toBeVisible();

  // We should be able to serch by the new content
  await page.goto(TEST_URL);
  await page.getByPlaceholder('Search here...').fill(new_note_content.slice(4, 19));
  await page.getByText('Search').click();
  await expect(page.getByText(recipe.name)).toBeVisible();

  // But not the old one
  await page.goto(TEST_URL);
  await page.getByPlaceholder('Search here...').fill(old_note_content);
  await page.getByText('Search').click();
  await expect(page.getByText('No results found')).toBeVisible();
});


test('edit a notes time should change order', async ({ page }) => {
  await page.goto(TEST_URL);

  // Create a new recipe
  const recipe = await createNewRecipe(page);

  // Make a first note some time in the past
  const note_1 = generateRandomString(40);
  await page.getByText('Add a new note').click();
  await page.getByLabel('Content').fill(note_1);
  await page.getByLabel('Date').fill('2023-01-03T00:00');
  await page.getByText('Save New Note').click();

  // Make a second note at a later date
  const note_2 = generateRandomString(40);
  await page.getByText('Add a new note').click();
  await page.getByLabel('Content').fill(note_2);
  await page.getByLabel('Date').fill('2023-02-04T00:00');
  await page.getByText('Save New Note').click();

  // Wait for the save to land
  await expect(page.getByText('Add a new note')).toBeVisible();

  // Ensure the first note was the first one we saved
  expect(await page.locator(':nth-match(.markdown-container, 1)').textContent()).toEqual(note_1)

  // Edit first note to be into the future, changing order
  await page.getByText('Edit Note').first().click();
  await page.getByLabel('Date').fill('2024-02-04T00:00');
  await page.getByText('Save Note').click();

  // Wait for the save to land
  await expect(page.getByText('Add a new note')).toBeVisible();

  // Now the first note should be the second and vice versa
  expect(await page.locator(':nth-match(.markdown-container, 1)').textContent()).toEqual(note_2)
});
