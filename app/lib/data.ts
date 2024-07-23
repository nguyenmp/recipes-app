import { sql } from "@vercel/postgres";
import { DeepRecipe, ShallowNote, ShallowRecipe, StoredNote, StoredRecipe } from "./definitions";

export async function resetDatabaseTables() {
    await sql`DROP TABLE IF EXISTS Recipes CASCADE`;
    await sql`DROP TABLE IF EXISTS Notes CASCADE`;

    await sql`CREATE TABLE IF NOT EXISTS Recipes (id BIGSERIAL PRIMARY KEY, name VARCHAR(255))`
    await sql`CREATE TABLE IF NOT EXISTS Notes (id BIGSERIAL PRIMARY KEY, recipe_id BIGINT NOT NULL REFERENCES Recipes(id), date_epoch_seconds BIGINT, content_markdown TEXT)`
}

export async function searchRecipesAndNotes(query?: string): Promise<StoredRecipe[]> {
    const queryResult = await sql<StoredRecipe>`
        SELECT Recipes.* FROM Notes
        JOIN Recipes
        ON Notes.recipe_id = Recipes.id
        WHERE content_markdown ILIKE ${`%${query}%`}
        OR Recipes.name ILIKE ${`%${query}%`}
    `;

    const map: {[key: number]: StoredRecipe} = {};

    queryResult.rows.map((recipe: StoredRecipe) => {
        map[recipe.id] = recipe;
    });

    return Object.values(map);
}

export async function getRecipes(): Promise<StoredRecipe[]> {
    const result = await sql<StoredRecipe>`SELECT * FROM Recipes`;
    return result.rows;
}

export async function getRecipeById(id: number): Promise<DeepRecipe> {
    const response = await sql<StoredRecipe>`SELECT * FROM Recipes WHERE id=${id}`;
    const notes = await getNotesForRecipe(id);
    return {...response.rows[0], notes: notes};
}

export async function getRecipesWithNotes(query?: string): Promise<DeepRecipe[]> {
    const recipes = query ? await searchRecipesAndNotes(query) : await getRecipes();
    return await Promise.all(recipes.map(async (recipe: StoredRecipe) => {
        const notes = await getNotesForRecipe(recipe.id);
        const result : DeepRecipe = {...recipe, notes: notes};
        return result;
    }))
}

export async function updateRecipeById(id: number, data: ShallowRecipe) {
    await sql`UPDATE Recipes SET name = ${data.name} WHERE id=${id}`
}

export async function createRecipe(recipe: ShallowRecipe): Promise<number> {
    const result = await sql`INSERT INTO recipes (name) VALUES (${recipe.name}) RETURNING id;`
    const newRecipeId = result.rows[0]['id'];
    return newRecipeId;
}

export async function getNotesForRecipe(recipeId: number): Promise<StoredNote[]> {
    const result = await sql<StoredNote>`SELECT * FROM Notes WHERE recipe_id = ${recipeId} ORDER BY date_epoch_seconds ASC`;
    return result.rows;
}

export async function getNoteById(noteId: number): Promise<StoredNote> {
    const result = await sql<StoredNote>`SELECT * FROM Notes WHERE id = ${noteId}`;
    return result.rows[0];
}

export async function updateNoteById(id: number, data: ShallowNote) {
    await sql`
        UPDATE Notes
        SET date_epoch_seconds = ${data.date_epoch_seconds}, content_markdown = ${data.content_markdown}
        WHERE id=${id}
    `
}

export async function createNoteForRecipe(recipeId: number, note: ShallowNote): Promise<number> {
    const result = await sql`INSERT INTO Notes (recipe_id, date_epoch_seconds, content_markdown) VALUES (${recipeId}, ${note.date_epoch_seconds}, ${note.content_markdown}) RETURNING id;`
    const newNoteId = result.rows[0]['id'];
    return newNoteId;
}
