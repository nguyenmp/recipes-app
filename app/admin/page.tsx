import { ShallowNote } from '../lib/definitions';
import { PlaceholderData, recipes } from '../lib/placeholder-data';
import { archiveLinks, countRecipesNeedingEmbeddings, countWordsNeedingEmbeddings, createNoteForRecipe, createRecipe, getRecipeById, getRecipes, getStoredRecipesNeedingEmbeddings, getStoredWordsNeedingEmbeddings, getTermsFromQuery, pullExistingLinks, putStoredWords, resetDatabaseTables, updateRecipeById, updateRecipeEmbeddingById, updateRecipeEmbeddingForRecipeId } from '../lib/data';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { GenerateEmbeddings } from '../ui/generate_embeddings';
import { SearchEmbeddings } from '../ui/search_embeddings';
import PipelineSingletonClass from '../lib/embeddings_pipeline';
import showdown from "showdown";
import {DOMParser, HTMLAnchorElement} from 'linkedom';
import { withTiming, withTimingAsync } from '../lib/utils';
import { sql } from '../lib/sql';
import { ErrorBoundary } from '../ui/error_boundary';
import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { auth, Role } from '@/auth';
import { NextResponse } from 'next/server';
import { ListBucketInventoryConfigurationsOutputFilterSensitiveLog } from '@aws-sdk/client-s3';

const SERIAL_OPERATIONS = false;

async function seedDatabase() {
    "use server";
    const session = await auth();
    if (session?.user.role !== Role.admin) return redirect('/404');
    console.log('Seed Database')

    await archiveLinks();
    await pullExistingLinks();
    await rebuildWordsEmbeddings();
    await rebuildRecipeEmbeddings();

    // This invalidates all data
    // https://nextjs.org/docs/app/api-reference/functions/revalidatePath#revalidating-all-data
    revalidatePath('/', 'layout')
    redirect('/recipes');
}

async function resetCache() {
    "use server";
    const session = await auth();
    if (session?.user.role !== Role.admin) return redirect('/404');
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
    let storedRecipeEmbeddings = await getRecipes();
    for (let index = 0; index < storedRecipeEmbeddings.length; index += 1) {
        console.log(`Progress: ${handledRecipes}/${totalCount} ~ ${Math.round(handledRecipes / totalCount * 100)}%`)
        const recipe = storedRecipeEmbeddings[index];
        await updateRecipeEmbeddingForRecipeId(recipe.id, classifier);
        handledRecipes += 1;
    }
    revalidatePath('/admin')
}

async function insertRecipe(recipe: PlaceholderData): Promise<Number> {
    const newRecipeId = await createRecipe(recipe);

    if (SERIAL_OPERATIONS) {
        for (const note of recipe.notes) {
            await insertNoteForRecipe(newRecipeId, note);
        }
    } else {
        recipe.notes.map(insertNoteForRecipe.bind(null, newRecipeId));
    }

    return newRecipeId;
}

async function insertNoteForRecipe(recipeId: Number, note: ShallowNote): Promise<Number> {
    return await createNoteForRecipe(recipeId.valueOf(), note);
}

async function EmbeddingsMetadata() {return await withTimingAsync('EmbeddingsMetadata', async () => {
    const cookieStore = await cookies(); // Do this to prevent SSR because below code can break.
    const wordEmbeddingsMetadata = await countWordsNeedingEmbeddings();
    const recipeEmbeddingsMetadata = await countRecipesNeedingEmbeddings();
    return (
        <div>
            <h1>Embeddings missings</h1>
            <ul>
                <li>{wordEmbeddingsMetadata.missingCount} out of {wordEmbeddingsMetadata.totalCount} words</li>
                <li>{recipeEmbeddingsMetadata.missingCount} out of {recipeEmbeddingsMetadata.totalCount} recipes</li>
            </ul>
        </div>
    );
})};

async function AllTheLinks() {return await withTimingAsync('AllTheLinks', async () => {
    const cookieStore = await cookies(); // Do this to prevent SSR because below code can break.
    const contents = await sql<{content_markdown: string}>`SELECT content_markdown FROM Notes`;
    const links = contents.rows.flatMap((row) => {
        const markdown_converter = new showdown.Converter({ simplifiedAutoLink: true });
        const html = markdown_converter.makeHtml(row.content_markdown);
        const document = (new DOMParser).parseFromString(html, 'text/html');
        return (Array.from(document.querySelectorAll("a")) as HTMLAnchorElement[]).map((anchor) => {
            return anchor.href;
        });
    });

    return (
        <div>
            {links.map((link, index) => {
                return <p key={index}><a href={link}>{link}</a></p>
            })}
        </div>
    );
})};

export default async function AdminPage() {
    const session = await auth();
    if (session?.user.role !== Role.admin) return redirect('/404');
    return (
        <main>
            <h1>Admin Page</h1>

            <form action={seedDatabase}>
                <button type="submit" className="bg-slate-300 rounded p-4 active:bg-slate-600">Reset Database but don&apos; delete notes or recipes</button>
            </form>

            <form action={resetCache}>
                <button type="submit" className="bg-slate-300 rounded p-4 active:bg-slate-600">Reset Cache</button>
            </form>

            <ErrorBoundary fallback={<p>Something went wrong with Embeddings Metadata</p>}><Suspense fallback={<p>Loading Embeddings Metadata</p>}><EmbeddingsMetadata /></Suspense></ErrorBoundary>

            <GenerateEmbeddings />

            <SearchEmbeddings />

            <ErrorBoundary fallback={<p>Something went wrong with All The Links</p>}><Suspense fallback={<p>Loading All The Links</p>}><AllTheLinks /></Suspense></ErrorBoundary>

        </main>
    );
}
