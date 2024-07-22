import { getRecipeById } from "@/app/lib/data";
import { RecipeCard } from "@/app/ui/recipe";
import Link from "next/link";


export default async function Page({ params }: { params: { recipe_id: string } }) {
    const id = params.recipe_id;
    const recipe = await getRecipeById(Number(id));
    return (
        <div>
            <p><Link href="/recipes">All Recipes</Link></p>
            <p><Link href={`/recipes/${id}/edit`}>Edit Recipe</Link></p>
            {RecipeCard(recipe)}
        </div>
    );
}