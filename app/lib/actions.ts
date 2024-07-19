'use server';

import { sql } from "@vercel/postgres";
import { ShallowRecipe } from "./definitions";
import { createRecipe, updateRecipeById } from "./data";
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