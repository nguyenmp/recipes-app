import { sql, query as sql_query } from "./sql";
import { DeepRecipe, ShallowAttachment, ShallowNote, ShallowRecipe, StoredAttachment, StoredNote, StoredRecipe, StoredRecipeSearchMatch } from "./definitions";
import { getLinksFromMarkdown, getUrlFromHTMLAnchorElement, get, post, withTimingAsync } from "./utils";
import {sync_content_from_archive} from "../api/archive_webhook/route";
import assert from "assert";

export const ARCHIVE_BOX_API_KEY = process.env.ARCHIVE_BOX_API_KEY!;
export const ARCHIVE_BOX_URL = process.env.ARCHIVE_BOX_URL!;
export const ARCHIVE_BOX_HOST = process.env.ARCHIVE_BOX_HOST!;

/**
 * This is a reasonable guess.  What we do is generate suggested terms from
 * levenshtein distance as well as cosine similarity of word embeddings.
 * Because we search multiple methods, we will very like get duplicates, which
 * need to be reduced in code.  As such, need to query for more words, but not
 * all words to reduce performance issues especially in vector search.
 */
const RELATED_WORDS_LIMIT = 30;

export async function resetDatabaseTables() {
    await sql`DROP TABLE IF EXISTS Recipes CASCADE`;
    await sql`DROP TABLE IF EXISTS Notes CASCADE`;
    await sql`DROP TABLE IF EXISTS Notes CASCADE`;
    await sql`DROP TABLE IF EXISTS Embeddings CASCADE`;
    await sql`DROP TABLE IF EXISTS Attachments CASCADE`;
    await sql`DROP TABLE IF EXISTS Links CASCADE`;
    await sql`DROP TABLE IF EXISTS LinkContents CASCADE`;
    await sql`DROP TABLE IF EXISTS NoteLinks CASCADE`;
    await sql`DROP VIEW IF EXISTS Words`;
    await sql`DROP EXTENSION IF EXISTS fuzzystrmatch`;
    await sql`DROP EXTENSION IF EXISTS vector`;

    // https://vercel.com/docs/storage/vercel-postgres/supported-postgresql-extensions#installing-an-extension
    await sql`CREATE EXTENSION IF NOT EXISTS fuzzystrmatch`
    await sql`CREATE EXTENSION IF NOT EXISTS vector`

    await sql`CREATE TABLE IF NOT EXISTS Recipes (id BIGSERIAL PRIMARY KEY, name VARCHAR(255), embedding VECTOR(384))`
    await sql`CREATE TABLE IF NOT EXISTS Notes (id BIGSERIAL PRIMARY KEY, recipe_id BIGINT NOT NULL REFERENCES Recipes(id), date_epoch_seconds BIGINT, content_markdown TEXT)`
    await sql`CREATE INDEX IF NOT EXISTS Notes_Recipe_Id ON Notes (recipe_id)`;
    await sql`CREATE TABLE IF NOT EXISTS Attachments (id BIGSERIAL PRIMARY KEY, name VARCHAR(255), note_id BIGINT NOT NULL REFERENCES Notes(id))`;

    await sql`CREATE TABLE IF NOT EXISTS Links (id BIGSERIAL PRIMARY KEY, url TEXT UNIQUE)`;
    await sql`CREATE TABLE IF NOT EXISTS NoteLinks (link_id BIGINT NOT NULL REFERENCES Links(id), note_id BIGINT NOT NULL REFERENCES Notes(id), UNIQUE (link_id, note_id))`;
    await sql`CREATE TABLE IF NOT EXISTS LinkContents (link_id BIGINT NOT NULL REFERENCES Links(id), link_content TEXT NOT NULL, content_type TEXT NOT NULL, timestamp_epoch_seconds DOUBLE PRECISION, UNIQUE (link_id, content_type))`;

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


}

export type LevenshteinMatch = {word: string, distance: number};
export type StoredWordEmbedding = {word: string, embedding: number[] | null};
export type EmbeddingMatch<T> = T & {
    distance: number;
}

/**
 * Postgres stores vectors as JSON-ish encoded arrays of numbers (basically strings).
 *
 * When we pull it back out, it's a string, but it's easier to work with an
 * array of numbers so we decode it instead and use this function for consistency.
 */
function fixEmbeddingFromJson<T extends {embedding: number[] | null}>(rows: T[]): T[] {
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

export async function getStoredRecipesNeedingEmbeddings(): Promise<StoredRecipe[]> {
    const result = await sql<StoredRecipe>`
        SELECT *
        FROM Recipes
        WHERE Recipes.embedding IS NULL
        LIMIT 100
    `;
    return fixEmbeddingFromJson(result.rows);
}

export async function countWordsNeedingEmbeddings(): Promise<{missingCount: number, totalCount: number}> {
    const result = await sql<{'totalcount': number, 'missingcount': number}>`
        SELECT COUNT(*) as totalcount, count(*) FILTER (WHERE embedding IS NULL) AS missingcount
        FROM Words
        LEFT JOIN Embeddings
        ON Embeddings.word = Words.word
    `;
    return {
        missingCount: result.rows[0].missingcount,
        totalCount: result.rows[0].totalcount,
    };
}

export async function countRecipesNeedingEmbeddings(): Promise<{missingCount: number, totalCount: number}> {
    const result = await sql<{'totalcount': number, 'missingcount': number}>`
        SELECT COUNT(*) as totalcount, count(*) FILTER (WHERE embedding IS NULL) AS missingcount
        FROM Recipes
    `;
    return {
        missingCount: result.rows[0].missingcount,
        totalCount: result.rows[0].totalcount,
    };
}

/**
 * Similar to getRelatedWordsFromEmbeddings but only requires querying the
 * database so timing can be anywhere from 30ms to 300ms, suitable for initial
 * page load.  The negative of this method is that it only supports words in
 * our database.  Unknown words are not supported.
 */
export async function getRelatedWordsFromTerms(terms: string[]): Promise<EmbeddingMatch<StoredWordEmbedding>[]> {
    const select_union = terms.map((term: string) => `
        SELECT word, embedding, embedding <-> (SELECT embedding FROM Embeddings WHERE word = '${term}' ) as distance
        FROM Embeddings
        WHERE word NOT ILIKE '%${term}%' AND (SELECT embedding FROM Embeddings WHERE word = '${term}') IS NOT NULL
    `).join(' UNION ');
    const query = `${select_union} ORDER BY distance ASC LIMIT ${RELATED_WORDS_LIMIT}`;
    const response = await sql_query<EmbeddingMatch<StoredWordEmbedding>>(query);
    fixEmbeddingFromJson(response.rows);
    return response.rows;
}

export async function getRelatedRecipesFromRecipe(recipe_id: number): Promise<EmbeddingMatch<StoredRecipe>[]> {
    const response = await sql<EmbeddingMatch<StoredRecipe>>`
        SELECT *, embedding <-> (SELECT embedding FROM Recipes WHERE id = ${recipe_id}) as distance
        FROM Recipes
        WHERE id != ${recipe_id}
        ORDER BY distance ASC
        LIMIT 15
    `;
    fixEmbeddingFromJson(response.rows);
    return response.rows;
}

/**
 * Supports searching for semantically similar words to the given embeddings.
 * Compared to getRelatedWordsFromTerms, this function supports arbitrary
 * words because we can generate embeddings for any word, but generating
 * embeddings on Vercel's environment can take up to 3.5s.  It's far
 * perferable to progressively enhance this information rather than block the
 * initial render.
 */
export async function getRelatedWordsFromEmbeddings(embeddings: number[][]): Promise<EmbeddingMatch<StoredWordEmbedding>[]> {
    const select_union = embeddings.map((embedding: number[]) => `SELECT word, embedding, (embedding <-> '${JSON.stringify(embedding)}') AS distance FROM Embeddings`).join(' UNION ')
    const query = `${select_union} ORDER BY distance LIMIT ${RELATED_WORDS_LIMIT}`;
    const result = await sql_query<EmbeddingMatch<StoredWordEmbedding>>(query);
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

export async function getMoreTerms(terms: string[]) : Promise<LevenshteinMatch[]> {
    const select_clauses = terms.map((term) => {
        term = term.toLowerCase();
        const select_clause = `
            SELECT word, levenshtein(Words.word, '${term}') as distance
            FROM Words

            -- Limit levenshtein distance by half of the term, any more than half and it's a stretch...
            WHERE levenshtein(Words.word, '${term}') < char_length('${term}') / 2

            -- don't include self or any superstrings since we match by substring, so superstrings don't add any value
            AND word NOT LIKE '%${term}%'
        `;
        return select_clause;
    });

    const query = select_clauses.join(' UNION ') + ` ORDER BY distance ASC LIMIT ${RELATED_WORDS_LIMIT}`;

    const response = await withTimingAsync("levenshtein query", async () => {
        const request = sql_query<LevenshteinMatch>(query);
        return await request;
    });


    const new_terms = response.rows;

    // Reduce by substrings.  i.e. tomatoes => tomato and tomatos but tomato would cover tomatos
    return new_terms.filter((match: LevenshteinMatch) => {
        for (const other_term of new_terms) {
            if (match.word === other_term.word) continue;
            if (match.word.includes(other_term.word)) {
                return false;
            }
        }
        return true;
    })
}

export async function getRecipes(): Promise<StoredRecipe[]> {
    return await withTimingAsync('data.ts#getRecipes', async () => {
        const result = await sql<StoredRecipe>`SELECT * FROM Recipes ORDER BY RANDOM()`;
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
            SUM(ARRAY_LENGTH(STRING_TO_ARRAY(LOWER(Notes.content_markdown), ${term}), 1)) / COUNT(Notes.id) - 1 as content_markdown_matches,
            SUM(ARRAY_LENGTH(STRING_TO_ARRAY(LOWER(LinkContents.link_content), ${term}), 1)) - COUNT(LinkContents.ctid) as link_content_matches
        FROM Recipes
        LEFT JOIN Notes
        ON Notes.recipe_id = Recipes.id
        LEFT JOIN NoteLinks
        ON Notes.id = NoteLinks.note_id
        LEFT JOIN LinkContents
        ON LinkContents.link_id = NoteLinks.link_id
        WHERE content_markdown ILIKE ${`%${term}%`}
        OR Recipes.name ILIKE ${`%${term}%`}
        OR linkcontents.link_content ILIKE ${`%${term}%`}
        GROUP BY Recipes.id
    `;
    return response.rows;
}

export async function updateRecipeById(id: number, data: ShallowRecipe) {
    await sql`UPDATE Recipes SET name = ${data.name} WHERE id=${id}`
}

export async function updateRecipeEmbeddingById(id: number, embedding: number[]) {
    await sql`UPDATE Recipes SET embedding = ${JSON.stringify(embedding)} WHERE id=${id}`
}

export async function createRecipe(recipe: Omit<ShallowRecipe, 'embedding'>): Promise<number> {
    const result = await sql<{id: number}>`INSERT INTO recipes (name) VALUES (${recipe.name}) RETURNING id;`
    const newRecipeId = result.rows[0]['id'];
    return newRecipeId;
}

export async function getAttachmentsForRecipe(recipeId: number): Promise<Map<number, StoredAttachment[]>> {
    const response = await sql<StoredAttachment>`
        SELECT * FROM Attachments
        WHERE note_id IN (SELECT id FROM Notes WHERE recipe_id = ${recipeId})`;
    const result : Map<number, StoredAttachment[]> = new Map();
    response.rows.forEach((row) => {
        const attachments = result.get(row.note_id) ?? [];
        attachments.push(row);
        result.set(row.note_id, attachments);
    })
    return result;
}

export async function getNotesForRecipe(recipeId: number): Promise<StoredNote[]> {
    const result = await sql<StoredNote>`SELECT * FROM Notes WHERE recipe_id = ${recipeId} ORDER BY date_epoch_seconds ASC`;
    const attachmentsByNote = await getAttachmentsForRecipe(recipeId);
    result.rows.forEach((note) => {
        note.attachments = attachmentsByNote.get(note.id);
    });

    return result.rows;
}

export async function getNoteById(noteId: number): Promise<StoredNote> {
    const result = await sql<StoredNote>`SELECT * FROM Notes WHERE id = ${noteId}`;
    const note = result.rows[0];

    const attachmentsByNote = await getAttachmentsForRecipe(note.recipe_id);
    note.attachments = attachmentsByNote.get(note.id);

    return note;
}

export async function updateNoteById(id: number, data: ShallowNote) {
    await sql`
        UPDATE Notes
        SET date_epoch_seconds = ${data.date_epoch_seconds}, content_markdown = ${data.content_markdown}
        WHERE id=${id}
    `;
    await addLinksForNote(id, data);
}

export async function addAttachmentforNote(note_id: number, attachment: ShallowAttachment) {
    await sql`INSERT INTO Attachments (note_id, name) VALUES (${note_id}, ${attachment.name})`
}

export async function deleteAttachmentForNote(note_id: number, attachment: ShallowAttachment) {
    await sql`DELETE FROM Attachments WHERE note_id = ${note_id} AND name = ${attachment.name}`;
}

export async function createNoteForRecipe(recipeId: number, note: ShallowNote): Promise<number> {
    const result = await sql<{id: number}>`INSERT INTO Notes (recipe_id, date_epoch_seconds, content_markdown) VALUES (${recipeId}, ${note.date_epoch_seconds}, ${note.content_markdown}) RETURNING id;`
    console.log('Handling createNoteForRecipe');
    console.log(JSON.stringify(result.rows));
    const newNoteId = result.rows[0]['id'];

    for (const attachment of note.attachments ?? []) {
        addAttachmentforNote(newNoteId, attachment);
    }

    await addLinksForNote(newNoteId, note);

    return newNoteId;
}

export async function addLinksForNote(note_id: number, note: ShallowNote): Promise<void> {
    const links = getLinksFromMarkdown(note.content_markdown);
    if (links.length === 0) return;
    const urls: string[] = [];

    for (const link of links) {
        const url = getUrlFromHTMLAnchorElement(link);
        urls.push(url);

        const result = await sql<{id: number}>`
            INSERT INTO Links (url)
            VALUES (${url})
            ON CONFLICT (url)
            DO UPDATE SET url = EXCLUDED.url
            RETURNING id
        `;
        const link_id = result.rows[0].id;
        await sql`INSERT INTO NoteLinks (link_id, note_id) VALUES (${link_id}, ${note_id}) ON CONFLICT DO NOTHING`;
    }
}

export async function archiveLinks(): Promise<void> {
    const result = await sql<{url: string}>`SELECT url FROM Links`;
    const urls = result.rows.map((row) => row.url);
    // Also dispatch to archivebox service for archiving the actual content of the link
    // that service will have a webhook to notify us later on
    console.log(`Submitting urls: ${JSON.stringify(urls)}`);
    // Specifically don't await on the post because it's a synchronous submit
    // i.e. it'll block until we fully cache the result
    post(`${ARCHIVE_BOX_URL}/api/v1/cli/add`, {
        urls,
        "tag": "",
        "depth": 0,
        "update": false,
        "update_all": false,
        "index_only": false,
        "overwrite": false,
        "init": false,
        "extractors": "",
        "parser": "auto"
    }, {
        "X-ArchiveBox-API-Key": ARCHIVE_BOX_API_KEY,
        Host: ARCHIVE_BOX_HOST,
    })
}

export async function pullExistingLinks(page: number = 0): Promise<void> {
    console.log('Pulling links from archivebox')
    const response_text = await get(`${ARCHIVE_BOX_URL}/api/v1/core/snapshots?with_archiveresults=false&page=${page}`, {
        "X-ArchiveBox-API-Key": ARCHIVE_BOX_API_KEY,
        Host: ARCHIVE_BOX_HOST,
    });

    const response_json = JSON.parse(response_text);

    for (const item of response_json.items) {
        try {
            await sync_content_from_archive(item.timestamp);
        } catch (err) {
            console.log(err);
        }
    }

    if (response_json.page === response_json.total_pages - 1) return;
    pullExistingLinks(page + 1);
}

export async function addLinkContent(url: string, content: string, extractor_type: string, timestamp: number) {
    const link_id = (await sql<{id: number}>`SELECT id FROM Links WHERE url = ${url}`).rows[0].id;
    await sql`
        INSERT INTO LinkContents (link_content, link_id, content_type, timestamp_epoch_seconds)
        VALUES (${content}, ${link_id}, ${extractor_type}, ${timestamp})
        ON CONFLICT (link_id, content_type) DO UPDATE SET link_content = EXCLUDED.link_content, timestamp_epoch_seconds = EXCLUDED.timestamp_epoch_seconds
        WHERE LinkContents.timestamp_epoch_seconds < EXCLUDED.timestamp_epoch_seconds
    `;
}

export type LinkContent = {
    content_type: string,
    link_id: number,
    link_content: string,
    timestamp_epoch_seconds: number,
}
export async function getLinkContents(url: string): Promise<string[]> {
    const response = await sql<LinkContent>`SELECT * FROM LinkContents INNER JOIN Links on Links.id = LinkContents.link_id WHERE Links.url = ${url}`;
    return response.rows.map((row) => {
        return row.content_type;
    })
}

export function getTermsFromQuery(query: string): string[] {
    const pattern = new RegExp('([a-zA-Z]+|[0-9\\.\\,]+)', 'g');
    const matches = query.matchAll(pattern);
    const terms_set = new Set(Array.from(matches).map((match: RegExpExecArray) => {
      return match[0].toLowerCase();
    }));
    return Array.from(terms_set);
}