import { sql } from '@vercel/postgres'
import { ShallowNote } from '../lib/definitions';
import { PlaceholderData, recipes } from '../lib/placeholder-data';
import { countWordsNeedingEmbeddings, createNoteForRecipe, createRecipe, getStoredWordsNeedingEmbeddings, putStoredWords, resetDatabaseTables } from '../lib/data';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { GenerateEmbeddings } from '../ui/generate_embeddings';
import { SearchEmbeddings } from '../ui/search_embeddings';
import PipelineSingletonClass from '../lib/embeddings_pipeline';

async function seedDatabase() {
    "use server";
    console.log('Seed Database')

    await resetDatabaseTables();

    await Promise.all(recipes.map(insertRecipe));

    await rebuildWordsEmbeddings();

    // This invalidates all data
    // https://nextjs.org/docs/app/api-reference/functions/revalidatePath#revalidating-all-data
    revalidatePath('/', 'layout')
    redirect('/recipes');
}

async function resetCache() {
    "use server";
    // https://nextjs.org/docs/app/api-reference/functions/revalidatePath#revalidating-all-data
    revalidatePath('/', 'layout')
    redirect('/');
}

async function rebuildWordsEmbeddings() {
    // Server side version of GenerateEmbeddings
    const classifier = await PipelineSingletonClass.getInstance();

    const totalWords = await countWordsNeedingEmbeddings();
    let handledWords = 0;
    let storedWordEmbeddings = await getStoredWordsNeedingEmbeddings();
    while (storedWordEmbeddings.length != 0) {
        console.log(`Progress: ${handledWords}/${totalWords} ~ ${Math.round(handledWords / totalWords * 100)}%`)
        const output = await classifier(storedWordEmbeddings.map((item) => item.word), {pooling: 'mean', normalize: true});
        storedWordEmbeddings.forEach((wordStruct, index) => {
            wordStruct.embedding = output.tolist()[index];
        });
        await putStoredWords(storedWordEmbeddings);
        handledWords += storedWordEmbeddings.length;
        storedWordEmbeddings = await getStoredWordsNeedingEmbeddings();
    }
};

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

            <form action={resetCache}>
                <button type="submit" className="bg-slate-300 rounded p-4 active:bg-slate-600">Reset Cache</button>
            </form>

            <GenerateEmbeddings />

            <SearchEmbeddings />

        </main>
    );
}
