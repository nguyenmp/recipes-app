'use server';

import { sql } from "@vercel/postgres";
import { ShallowNote, ShallowRecipe } from "./definitions";
import { addAttachmentforNote, createNoteForRecipe, createRecipe, deleteAttachmentForNote, getRelatedWordsFromEmbeddings, getStoredWordsNeedingEmbeddings, putStoredWords, StoredWordEmbedding, updateNoteById, updateRecipeById } from "./data";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function getRelatedWordsFromEmbedding(embedding: number[]) {
    return getRelatedWordsFromEmbeddings([embedding]);
}

export async function putWordEmbeddings(embeddings: StoredWordEmbedding[]) {
    return await putStoredWords(embeddings);
}

export async function getWordsNeedingEmbeddings() {
    return await getStoredWordsNeedingEmbeddings();
}

export async function saveRecipe(recipeId: number | null, formData: FormData) {
    const recipeName = formData.get('name')!.toString();
    const rawEmbedding = formData.get('embedding')?.toString();

    const recipe : ShallowRecipe = {
        name: recipeName,
    }

    if (recipeId === null) {
        recipeId = await createRecipe(recipe);
    } else {
        await updateRecipeById(recipeId, recipe);
    }

    const targetPath = `/recipes/${recipeId}`
    revalidatePath(targetPath);
    redirect(targetPath);
}

export async function saveNote(recipeId: number, noteId: number | null, formData: FormData) {
    const dateTimeString = formData.get('datetime');
    console.log(dateTimeString!.toString());
    const date = new Date(dateTimeString!.toString());
    const note : ShallowNote = {
        date_epoch_seconds: date.getTime() / 1000,
        content_markdown: formData.get('content_markdown')?.toString() || 'No content',
    }

    if (noteId == null) {
        noteId = await createNoteForRecipe(recipeId, note);
    } else {
        await updateNoteById(noteId, note);
    }

    const new_attachment_names = formData.getAll('new_attachment');
    for (const new_attachment_name of new_attachment_names) {
        await addAttachmentforNote(noteId, {name: new_attachment_name.toString()});
    }

    const remove_attachment_names = formData.getAll('remove_attachment');
    for (const remove_attachment_name of remove_attachment_names) {
        await deleteAttachmentForNote(noteId, {name: remove_attachment_name.toString()});
    }

    revalidatePath(`/recipes/${recipeId}/notes/${noteId}/edit`);
    const targetPath = `/recipes/${recipeId}`
    revalidatePath(targetPath);
    redirect(targetPath);
}