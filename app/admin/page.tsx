import {sql} from '@vercel/postgres'
import { ShallowNote } from '../lib/definitions';
import { PlaceholderData, recipes } from '../lib/placeholder-data';
import { createNoteForRecipe, createRecipe, resetDatabaseTables } from '../lib/data';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

async function seedDatabase() {
    "use server";
    console.log('Seed Database')

    await resetDatabaseTables();

    await Promise.all(recipes.map(insertRecipe));

    const targetPath = '/recipes'
    revalidatePath(targetPath);
    redirect(targetPath);
}

async function insertRecipe(recipe: PlaceholderData): Promise<Number> {
    const newRecipeId = await createRecipe(recipe);

    recipe.notes.map(insertNoteForRecipe.bind(null, newRecipeId))

    return newRecipeId;
}

async function insertNoteForRecipe(recipeId: Number, note: ShallowNote): Promise<Number> {
    return await createNoteForRecipe(recipeId.valueOf(), note);
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
