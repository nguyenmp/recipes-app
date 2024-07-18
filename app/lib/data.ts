import { sql } from "@vercel/postgres";
import { StoredNote, StoredRecipe } from "./definitions";

export async function getRecipes(): Promise<StoredRecipe[]> {
    const result = await sql<StoredRecipe>`SELECT * FROM Recipes`;
    return result.rows;
}

export async function getRecipesWithNotes(): Promise<StoredRecipe[]> {
    const recipes = await getRecipes();
    return await Promise.all(recipes.map(async (recipe: StoredRecipe) => {
        const notes = await getNotesForRecipe(recipe.id);
        recipe.notes = notes;
        return recipe;
    }))
}

export async function getNotesForRecipe(recipeId: number): Promise<StoredNote[]> {
    const result = await sql<StoredNote>`SELECT * FROM Notes WHERE recipe_id = ${recipeId}`;
    return result.rows;
}