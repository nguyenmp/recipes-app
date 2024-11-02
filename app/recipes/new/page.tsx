import { saveRecipe } from "@/app/lib/actions";
import { getRecipeById } from "@/app/lib/data";
import { EditRecipe } from "@/app/ui/recipe";
import { has_read_permissions } from "@/auth";

export default async function Page() {
    await has_read_permissions();
    const recipeId = null;
    const formAction = saveRecipe.bind(null, recipeId);
    return (
        <form action={formAction}>
            <EditRecipe/>
        </form>
    );
}