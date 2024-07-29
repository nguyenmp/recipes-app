
import { saveNote } from "@/app/lib/actions";
import { getNoteById } from "@/app/lib/data";
import { ShallowNote } from "@/app/lib/definitions";
import { EditNote } from "@/app/ui/recipe";



export default async function Page({ params, searchParams }: { params: { recipe_id: string, note_id: string }, searchParams: Partial<ShallowNote> }) {
    // Load note from DB first
    const note = await getNoteById(Number(params.note_id))

    // Then overwrite parts of the note with the searchParams (query segment of the URL)
    // to support server side rendering when client side javascript is disabled
    if (searchParams.content_markdown !== undefined) {
        note.content_markdown = searchParams.content_markdown;
    }
    if (searchParams.date_epoch_seconds !== undefined) {
        note.date_epoch_seconds = searchParams.date_epoch_seconds;
    }

    // Then render!
    const formAction = saveNote.bind(null, Number(params.recipe_id), note.id);
    return (
        <form action={formAction}>
            <EditNote note={note}/>
        </form>
    );
}