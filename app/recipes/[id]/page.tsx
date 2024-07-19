import { getRecipeById, getRecipesWithNotes } from "@/app/lib/data";
import { Recipe } from "@/app/ui/recipe";


export default async function Page({ params }: { params: { id: string } }) {
    const id = params.id;
    const recipe = await getRecipeById(Number(id));
    return Recipe(recipe);
}