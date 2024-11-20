import { EmbeddingMatch, getRecipeById, getRelatedRecipesFromRecipe } from "@/app/lib/data";
import { StoredRecipe } from "@/app/lib/definitions";
import { RecipeCard } from "@/app/ui/recipe";
import { error_on_read_permissions, has_write_permissions } from "@/auth";
import Link from "next/link";

async function RelatedRecipes(params: {relatedRecipes: EmbeddingMatch<StoredRecipe>[]}) {

  return (
    <div className="max-w-screen overflow-y-auto p-4">
      <ul className="flex flex-row gap-4">
        <p className="flex-shrink-0">Related Recipes:</p>
        {
          params.relatedRecipes.map((recipe) => {
            const link = `/recipes/${recipe.id}/`;
            return <li className="flex-shrink-0" key={recipe.id}><a href={link} data-distance={recipe.distance} title={recipe.name}>{recipe.name}</a></li>
          })
        }
      </ul>
    </div>
  );
}

export default async function Page(props: { params: Promise<{ recipe_id: string }> }) {
    await error_on_read_permissions();
    const render_write_permission_stuff = await has_write_permissions();
    const params = await props.params;
    const id = Number(params.recipe_id);
    const recipe = await getRecipeById(id);
    const relatedRecipes = await getRelatedRecipesFromRecipe(id);
    return (
        <div>
            <p><Link href="/recipes">All Recipes</Link></p>
            {render_write_permission_stuff ? <p><Link href={`/recipes/${id}/edit`}>Edit Recipe</Link></p> : <></>}
            <RelatedRecipes relatedRecipes={relatedRecipes} />
            {RecipeCard(recipe, !render_write_permission_stuff)}
        </div>
    );
}