import { sql } from '@vercel/postgres'
import { ShallowNote } from '../lib/definitions';
import { PlaceholderData, recipes } from '../lib/placeholder-data';
import { countRecipesNeedingEmbeddings, countWordsNeedingEmbeddings, createNoteForRecipe, createRecipe, getRecipeById, getStoredRecipesNeedingEmbeddings, getStoredWordsNeedingEmbeddings, getTermsFromQuery, putStoredWords, resetDatabaseTables, updateRecipeById } from '../lib/data';
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
    await rebuildRecipeEmbeddings();

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

    const {missingCount, totalCount} = await countWordsNeedingEmbeddings();
    let handledWords = 0;
    let storedWordEmbeddings = await getStoredWordsNeedingEmbeddings();
    while (storedWordEmbeddings.length != 0) {
        console.log(`Progress: ${handledWords}/${missingCount} ~ ${Math.round(handledWords / missingCount * 100)}%`)
        const output = await classifier(storedWordEmbeddings.map((item) => item.word), {pooling: 'mean', normalize: true});
        storedWordEmbeddings.forEach((wordStruct, index) => {
            wordStruct.embedding = output.tolist()[index];
        });
        await putStoredWords(storedWordEmbeddings);
        handledWords += storedWordEmbeddings.length;
        revalidatePath('/admin')
        storedWordEmbeddings = await getStoredWordsNeedingEmbeddings();
    }
};

async function rebuildRecipeEmbeddings() {
    // Server side version of GenerateEmbeddings
    const classifier = await PipelineSingletonClass.getInstance();

    const {missingCount, totalCount} = await countRecipesNeedingEmbeddings();
    let handledRecipes = 0;
    let storedRecipeEmbeddings = await getStoredRecipesNeedingEmbeddings();
    while (storedRecipeEmbeddings.length != 0) {
        for (let index = 0; index < storedRecipeEmbeddings.length; index += 1) {
            console.log(`Progress: ${handledRecipes}/${missingCount} ~ ${Math.round(handledRecipes / missingCount * 100)}%`)
            const recipe = storedRecipeEmbeddings[index];
            const deepRecipe = await getRecipeById(recipe.id);
            const content = [
                deepRecipe.name,
                ...deepRecipe.notes,
            ].join(' ');
            const output = await classifier(content, {pooling: 'mean', normalize: true});
            recipe.embedding = output.tolist()[0];
            await updateRecipeById(recipe.id, recipe);
            handledRecipes += 1;
        }
        revalidatePath('/admin')
        storedRecipeEmbeddings = await getStoredRecipesNeedingEmbeddings();
    }
}

async function insertRecipe(recipe: PlaceholderData): Promise<Number> {
    const newRecipeId = await createRecipe(recipe);

    recipe.notes.map(insertNoteForRecipe.bind(null, newRecipeId))

    return newRecipeId;
}

async function insertNoteForRecipe(recipeId: Number, note: ShallowNote): Promise<Number> {
    return await createNoteForRecipe(recipeId.valueOf(), note);
}

export default async function AdminPage() {
    const wordEmbeddingsMetadata = await countWordsNeedingEmbeddings();
    const recipeEmbeddingsMetadata = await countRecipesNeedingEmbeddings();
    return (
        <main>
            <h1>Admin Page</h1>

            <form action={seedDatabase}>
                <button type="submit" className="bg-slate-300 rounded p-4 active:bg-slate-600">Reset Database</button>
            </form>

            <form action={resetCache}>
                <button type="submit" className="bg-slate-300 rounded p-4 active:bg-slate-600">Reset Cache</button>
            </form>

            <h1>Embeddings missings</h1>
            <ul>
                <li>{wordEmbeddingsMetadata.missingCount} out of {wordEmbeddingsMetadata.totalCount} words</li>
                <li>{recipeEmbeddingsMetadata.missingCount} out of {recipeEmbeddingsMetadata.totalCount} words</li>
            </ul>

            <GenerateEmbeddings />

            <SearchEmbeddings />

        </main>
    );
}
