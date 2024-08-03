import { sql, db } from "@vercel/postgres";
import { DeepRecipe, ShallowNote, ShallowRecipe, StoredNote, StoredRecipe, StoredRecipeSearchMatch } from "./definitions";
import { withTimingAsync } from "./utils";
import assert from "assert";

export async function resetDatabaseTables() {
    await sql`DROP TABLE IF EXISTS Recipes CASCADE`;
    await sql`DROP TABLE IF EXISTS Notes CASCADE`;
    await sql`DROP TABLE IF EXISTS Notes CASCADE`;
    await sql`DROP TABLE IF EXISTS Embeddings CASCADE`;
    await sql`DROP VIEW IF EXISTS Words`;
    await sql`DROP EXTENSION IF EXISTS fuzzystrmatch`;

    await sql`CREATE TABLE IF NOT EXISTS Recipes (id BIGSERIAL PRIMARY KEY, name VARCHAR(255))`
    await sql`CREATE TABLE IF NOT EXISTS Notes (id BIGSERIAL PRIMARY KEY, recipe_id BIGINT NOT NULL REFERENCES Recipes(id), date_epoch_seconds BIGINT, content_markdown TEXT)`
    await sql`​​CREATE INDEX IF NOT EXISTS Notes_Recipe_Id ON Notes (recipe_id)`;

    // We use 384 because that's what's generated by all-MiniLM-L6-v2 (default for text-embeddings in transformers.js)
    await sql`CREATE TABLE IF NOT EXISTS Embeddings (word TEXT UNIQUE, embedding VECTOR(384))`

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

export type StoredWordEmbedding = {word: string, embedding: number[] | null};
export type EmbeddingMatch = StoredWordEmbedding & {
    distance: number;
}

/**
 * Postgres stores vectors as JSON-ish encoded arrays of numbers (basically strings).
 *
 * When we pull it back out, it's a string, but it's easier to work with an
 * array of numbers so we decode it instead and use this function for consistency.
 */
function fixEmbeddingFromJson(rows: StoredWordEmbedding[]) {
    return rows.map((row) => {
        if (row.embedding && typeof row.embedding === 'string') {
            row.embedding = JSON.parse(row.embedding);
        }

        return row;
    })
}

export async function getStoredWordsNeedingEmbeddings() {
    const result = await sql<StoredWordEmbedding>`
        SELECT Words.word as word, embedding
        FROM Words
        LEFT JOIN Embeddings
        ON Embeddings.word = Words.word
        WHERE Embeddings.embedding IS NULL
        LIMIT 100
    `;
    return fixEmbeddingFromJson(result.rows);
}

export async function getRelatedWords(embedding: number[]): Promise<EmbeddingMatch[]> {
    const result = await sql<EmbeddingMatch>`
        SELECT word, embedding, (embedding <-> ${JSON.stringify(embedding)}) AS distance
        FROM Embeddings
        ORDER BY distance
        LIMIT 10;
    `
    fixEmbeddingFromJson(result.rows);
    return result.rows;
}

export async function putStoredWords(embeddings: StoredWordEmbedding[]) {
    for (const embedding of embeddings) {
        await sql`
            INSERT INTO Embeddings (word, embedding)
            VALUES (${embedding.word}, ${JSON.stringify(embedding.embedding)})
            ON CONFLICT (word)
            DO UPDATE SET embedding = EXCLUDED.embedding
        `;
    }
}

export async function getMoreTerms(terms: string[]) : Promise<string[]> {
    const select_clauses = terms.map((term) => {
        term = term.toLowerCase();
        const select_clause = `
            SELECT word, levenshtein(Words.word, '${term}') as levenshtein
            FROM Words

            -- Limit levenshtein distance by half of the term, any more than half and it's a stretch...
            WHERE levenshtein(Words.word, '${term}') < char_length('${term}') / 2

            -- don't include self or any superstrings since we match by substring, so superstrings don't add any value
            AND word NOT LIKE '%${term}%'
        `;
        return select_clause;
    });

    const query = select_clauses.join(' UNION ') + ' ORDER BY levenshtein ASC LIMIT 10'

    const response = await withTimingAsync("levenshtein query", async () => {
        const client = await db.connect();
        const request = client.query<EmbeddingMatch>(query);
        return await request;
    });


    const new_terms = response.rows.map((row) => row.word);

    // Reduce by substrings.  i.e. tomatoes => tomato and tomatos but tomato would cover tomatos
    return new_terms.filter((new_term: string) => {
        for (const other_term of new_terms) {
            if (new_term === other_term) continue;
            if (new_term.includes(other_term)) {
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
    return await withTimingAsync('data.ts#getRecipes', async () => {
        const result = await sql<StoredRecipe>`SELECT * FROM Recipes ORDER BY RANDOM() LIMIT 20`;
        return result.rows;
    });
}

export async function getRecipeById(id: number): Promise<DeepRecipe> {
    const response = await sql<StoredRecipe>`SELECT * FROM Recipes WHERE id=${id}`;
    const notes = await getNotesForRecipe(id);
    return {...response.rows[0], notes: notes};
}

/**
 * Returns a list of Recipes for a specific term.  This an optimization over
 * loading all notes and doing the counting server side, versus letting the DB
 * handle it.
 */
export async function getRecipesForTerm(term : string): Promise<StoredRecipeSearchMatch[]> {
    const response = await sql<StoredRecipeSearchMatch>`
        SELECT
            Recipes.*,
            ARRAY_LENGTH(STRING_TO_ARRAY(LOWER(Recipes.name), ${term}), 1) - 1 as name_matches,
            SUM(ARRAY_LENGTH(STRING_TO_ARRAY(LOWER(Notes.content_markdown), ${term}), 1)) - 1 as content_markdown_matches
        FROM Notes
        JOIN Recipes
        ON Notes.recipe_id = Recipes.id
        WHERE content_markdown ILIKE ${`%${term}%`}
        OR Recipes.name ILIKE ${`%${term}%`}
        GROUP BY Recipes.id
    `;
    return response.rows;
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
