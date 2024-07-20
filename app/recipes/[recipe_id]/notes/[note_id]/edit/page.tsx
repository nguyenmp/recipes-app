
import { saveNote } from "@/app/lib/actions";
import { getNoteById } from "@/app/lib/data";
import { EditNote } from "@/app/ui/recipe";



export default async function Page({ params }: { params: { recipe_id: string, note_id: string } }) {
    const note = await getNoteById(Number(params.note_id))
    const formAction = saveNote.bind(null, Number(params.recipe_id), note.id);
    return (
        <form action={formAction}>
            <EditNote note={note}/>
        </form>
    );
}