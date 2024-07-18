import {sql} from '@vercel/postgres'
import { Note, Recipe } from '../lib/definitions';
import { recipes } from '../lib/placeholder-data';

async function seedDatabase() {
    "use server";
    console.log('Seed Database')

    await sql`DROP TABLE IF EXISTS Recipes CASCADE`;
    await sql`DROP TABLE IF EXISTS Notes CASCADE`;

    await sql`CREATE TABLE IF NOT EXISTS Recipes (id BIGSERIAL PRIMARY KEY, name VARCHAR(255))`
    await sql`CREATE TABLE IF NOT EXISTS Notes (id BIGSERIAL PRIMARY KEY, recipe_id BIGINT NOT NULL REFERENCES Recipes(id), date_epoch_seconds BIGINT, content_markdown TEXT)`

    recipes.map(insertRecipe);
}

async function insertRecipe(recipe: Recipe): Promise<Number> {
    const result = await sql`INSERT INTO recipes (name) VALUES (${recipe.name}) RETURNING id;`
    const newRecipeId = result.rows[0]['id'];

    recipe.notes.map(insertNoteForRecipe.bind(null, newRecipeId))

    return newRecipeId;
}

async function insertNoteForRecipe(recipeId: Number, note: Note): Promise<Number> {
    const result = await sql`INSERT INTO notes (date_epoch_seconds, content_markdown, recipe_id) VALUES (${note.date_epoch_seconds}, ${note.content_markdown}, ${recipeId.valueOf()}) RETURNING id;`
    const newNoteId = result.rows[0]['id'];
    return newNoteId;
}

export default function AdminPage() {
  return (
    <main>
        <h1>Admin Page</h1>

<form action={seedDatabase}>
    <button type="submit" className="bg-slate-300 rounded p-4 active:bg-slate-600">Reset Database</button>
</form>

    </main>
  );
}
