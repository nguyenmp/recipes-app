import { getRecipeById, getRelatedRecipesFromRecipe } from "@/app/lib/data";
import { RecipeCard } from "@/app/ui/recipe";
import { has_read_permissions } from "@/auth";
import Link from "next/link";


export default async function Page(props: { params: Promise<{ recipe_id: string }> }) {
    await has_read_permissions();
    const params = await props.params;
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
                return <li key={relatedRecipe.id} className="list-disc list-inside m-2 p-2"><Link href={`/recipes/${relatedRecipe.id}`} title={`${relatedRecipe.distance}`}>{relatedRecipe.name}</Link></li>
            })}
        </div>
    );
}