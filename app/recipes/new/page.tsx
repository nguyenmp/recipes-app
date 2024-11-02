import { saveRecipe } from "@/app/lib/actions";
import { getRecipeById } from "@/app/lib/data";
import { EditRecipe } from "@/app/ui/recipe";
import { has_read_permissions, has_write_permissions } from "@/auth";
import { redirect } from "next/navigation";

export default async function Page() {
    if (!await has_write_permissions()) redirect('/404');
    const recipeId = null;
    const formAction = saveRecipe.bind(null, recipeId);
    return (
        <form action={formAction}>
            <EditRecipe/>
        </form>
    );
}