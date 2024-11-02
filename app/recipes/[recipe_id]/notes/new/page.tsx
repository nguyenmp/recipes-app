
import { saveNote } from "@/app/lib/actions";
import { EditNote, RecipeCard } from "@/app/ui/recipe";
import { has_read_permissions } from "@/auth";



export default async function Page(props: { params: Promise<{ recipe_id: string }> }) {
    await has_read_permissions();
    const params = await props.params;
    const recipe_id = Number(params.recipe_id);
    const formAction = saveNote.bind(null, recipe_id, null);
    return (
        <form action={formAction}>
            <EditNote />
        </form>
    );
}