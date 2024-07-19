import { sql } from "@vercel/postgres";
import { DeepRecipe, ShallowRecipe, StoredNote, StoredRecipe } from "./definitions";

export async function getRecipes(): Promise<StoredRecipe[]> {
    const result = await sql<StoredRecipe>`SELECT * FROM Recipes`;
    return result.rows;
}

export async function getRecipeById(id: number): Promise<DeepRecipe> {
    const response = await sql<StoredRecipe>`SELECT * FROM Recipes WHERE id=${id}`;
    const notes = await getNotesForRecipe(id);
    return {...response.rows[0], notes: notes};
}

export async function getRecipesWithNotes(): Promise<DeepRecipe[]> {
    const recipes = await getRecipes();
    return await Promise.all(recipes.map(async (recipe: StoredRecipe) => {
        const notes = await getNotesForRecipe(recipe.id);
        const result : DeepRecipe = {...recipe, notes: notes};
        return result;
    }))
}

export async function updateRecipeById(id: number, data: ShallowRecipe) {
    await sql`UPDATE Recipes SET name = ${data.name} WHERE id=${id}`
}

export async function createRecipe(recipe: ShallowRecipe): Promise<number> {
    const result = await sql`INSERT INTO recipes (name) VALUES (${recipe.name}) RETURNING id;`
    const newRecipeId = result.rows[0]['id'];
    return newRecipeId;
}

export async function getNotesForRecipe(recipeId: number): Promise<StoredNote[]> {
    const result = await sql<StoredNote>`SELECT * FROM Notes WHERE recipe_id = ${recipeId}`;
    return result.rows;
}