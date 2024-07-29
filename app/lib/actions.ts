'use server';

import { sql } from "@vercel/postgres";
import { ShallowNote, ShallowRecipe } from "./definitions";
import { createNoteForRecipe, createRecipe, updateNoteById, updateRecipeById } from "./data";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function saveRecipe(recipeId: number | null, formData: FormData) {
    console.log({...formData.keys()})
    const recipeName = formData.get('name')!.toString();

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

    revalidatePath(`/recipes/${recipeId}/notes/${noteId}/edit`);
    const targetPath = `/recipes/${recipeId}`
    revalidatePath(targetPath);
    redirect(targetPath);
}