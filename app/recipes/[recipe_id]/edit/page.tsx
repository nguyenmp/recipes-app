import { saveRecipe } from "@/app/lib/actions";
import { getRecipeById } from "@/app/lib/data";
import { EditRecipe } from "@/app/ui/recipe";
import { has_read_permissions } from "@/auth";

export default async function Page(props: { params: Promise<{ recipe_id: string }> }) {
    await has_read_permissions();
    const params = await props.params;
    const recipe = await getRecipeById(Number(params.recipe_id));
    const formAction = saveRecipe.bind(null, recipe.id);
    return (
        <form action={formAction}>
            <EditRecipe recipe={recipe}/>
        </form>
    );
}