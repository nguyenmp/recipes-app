import { getRecipeById, getRelatedRecipesFromRecipe } from "@/app/lib/data";
import { RecipeCard } from "@/app/ui/recipe";
import Link from "next/link";


export default async function Page({ params }: { params: { recipe_id: string } }) {
    const id = Number(params.recipe_id);
    const recipe = await getRecipeById(id);
    const relatedRecipes = await getRelatedRecipesFromRecipe(id);
    return (
        <div>
            <p><Link href="/recipes">All Recipes</Link></p>
            <p><Link href={`/recipes/${id}/edit`}>Edit Recipe</Link></p>
            {RecipeCard(recipe)}
            <p>Related Recipes:</p>
            {relatedRecipes.map((relatedRecipe) => {
                return <li className="list-disc list-inside m-2 p-2"><Link href={`/recipes/${relatedRecipe.id}`} title={`${relatedRecipe.distance}`}>{relatedRecipe.name}</Link></li>
            })}
        </div>
    );
}