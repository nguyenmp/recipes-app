
import { saveNote } from "@/app/lib/actions";
import { EditNote, RecipeCard } from "@/app/ui/recipe";
import { has_read_permissions, has_write_permissions } from "@/auth";
import { redirect } from "next/navigation";



export default async function Page(props: { params: Promise<{ recipe_id: string }> }) {
    if (!await has_write_permissions()) redirect('/404');
    const params = await props.params;
    const recipe_id = Number(params.recipe_id);
    const formAction = saveNote.bind(null, recipe_id, null);
    return (
        <form action={formAction}>
            <EditNote />
        </form>
    );
}