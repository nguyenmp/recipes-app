
import { saveNote } from "@/app/lib/actions";
import { EditNote, RecipeCard } from "@/app/ui/recipe";



export default async function Page({ params }: { params: { recipe_id: string } }) {
    const recipe_id = Number(params.recipe_id);
    const formAction = saveNote.bind(null, recipe_id, null);
    return (
        <form action={formAction}>
            <EditNote />
        </form>
    );
}