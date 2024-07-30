import { sql } from '@vercel/postgres'
import { ShallowNote } from '../lib/definitions';
import { PlaceholderData, recipes } from '../lib/placeholder-data';
import { createNoteForRecipe, createRecipe, resetDatabaseTables } from '../lib/data';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { GenerateEmbeddings } from '../ui/generate_embeddings';

async function seedDatabase() {
    "use server";
    console.log('Seed Database')

    await resetDatabaseTables();

    await Promise.all(recipes.map(insertRecipe));

    // This invalidates all data
    // https://nextjs.org/docs/app/api-reference/functions/revalidatePath#revalidating-all-data
    revalidatePath('/', 'page');
    revalidatePath('/recipes', 'page');
    revalidatePath('/recipes/[recipe_id]', 'page')
    redirect('/recipes');
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

            <GenerateEmbeddings />

        </main>
    );
}
