import { sql } from "@vercel/postgres";
import { DeepRecipe, ShallowNote, ShallowRecipe, StoredNote, StoredRecipe } from "./definitions";

export async function resetDatabaseTables() {
    await sql`DROP TABLE IF EXISTS Recipes CASCADE`;
    await sql`DROP TABLE IF EXISTS Notes CASCADE`;
    await sql`DROP VIEW Words`;

    await sql`CREATE TABLE IF NOT EXISTS Recipes (id BIGSERIAL PRIMARY KEY, name VARCHAR(255))`
    await sql`CREATE TABLE IF NOT EXISTS Notes (id BIGSERIAL PRIMARY KEY, recipe_id BIGINT NOT NULL REFERENCES Recipes(id), date_epoch_seconds BIGINT, content_markdown TEXT)`

    await sql`
        CREATE OR REPLACE VIEW Words (word) AS
            SELECT DISTINCT unnest(regexp_matches(LOWER(Recipes.name),'([a-zA-Z]+|[0-9\\.\\,]+)', 'g'))
            FROM Recipes
            UNION
            SELECT DISTINCT unnest(regexp_matches(LOWER(Notes.content_markdown),'([a-zA-Z]+|[0-9\\.\\,]+)', 'g'))
            FROM Notes
    `

    // https://vercel.com/docs/storage/vercel-postgres/supported-postgresql-extensions#installing-an-extension
    await sql`CREATE EXTENSION IF NOT EXISTS fuzzystrmatch`
}

export async function getMoreTerms(term: string) : Promise<string[]> {
    const response = await sql<{word: string, levenshtein: number}>`
        SELECT word, levenshtein(Words.word, ${term}) as levenshtein
        FROM Words

        -- Limit levenshtein distance by half of the term, any more than half and it's a stretch...
        WHERE levenshtein(Words.word, ${term}) < char_length(${term}) / 2

        -- don't include self or any superstrings since we match by substring, so superstrings don't add any value
        AND word NOT LIKE ${`%${term}%`}
        ORDER BY levenshtein(Words.word, ${term}) ASC
    `;


    const new_terms = response.rows.map((row) => row.word);

    // Reduce by substrings.  i.e. tomatoes => tomato and tomatos but tomato would cover tomatos
    return new_terms.filter((new_term: string) => {
        for (const other_term of new_terms) {
            if (new_term === other_term) continue;
            if (new_term.includes(other_term)) {
                console.log('Ignoring ' + new_term + ' because its covered by ' + other_term)
                return false;
            }
        }
        return true;
    })
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
