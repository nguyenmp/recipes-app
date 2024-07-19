import { saveRecipe } from "@/app/lib/actions";
import { getRecipeById } from "@/app/lib/data";
import { EditRecipe } from "@/app/ui/recipe";

export default async function Page() {
    const recipeId = null;
    const formAction = saveRecipe.bind(null, recipeId);
    return (
        <form action={formAction}>
            <EditRecipe/>
        </form>
    );
}