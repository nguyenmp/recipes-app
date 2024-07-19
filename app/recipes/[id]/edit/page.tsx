import { saveRecipe } from "@/app/lib/actions";
import { getRecipeById } from "@/app/lib/data";
import { EditRecipe } from "@/app/ui/recipe";

export default async function Page({ params }: { params: { id: string } }) {
    const recipe = await getRecipeById(Number(params.id));
    const formAction = saveRecipe.bind(null, recipe.id);
    return (
        <form action={formAction}>
            <EditRecipe recipe={recipe}/>
        </form>
    );
}