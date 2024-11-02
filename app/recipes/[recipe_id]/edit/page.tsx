import { saveRecipe } from "@/app/lib/actions";
import { getRecipeById } from "@/app/lib/data";
import { EditRecipe } from "@/app/ui/recipe";
import { has_write_permissions } from "@/auth";
import { redirect } from "next/navigation";

export default async function Page(props: { params: Promise<{ recipe_id: string }> }) {
    if (!await has_write_permissions()) redirect('/404');
    const params = await props.params;
    const recipe = await getRecipeById(Number(params.recipe_id));
    const formAction = saveRecipe.bind(null, recipe.id);
    return (
        <form action={formAction}>
            <EditRecipe recipe={recipe}/>
        </form>
    );
}