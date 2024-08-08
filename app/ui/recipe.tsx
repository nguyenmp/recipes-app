import { DeepRecipe, ShallowAttachment, ShallowNote, ShallowRecipe, StoredAttachment, StoredNote } from "../lib/definitions";
import showdown from "showdown";
import Link from 'next/link';
import { constants } from "zlib";
import assert from "assert";
import { MarkdownPreview } from "./markdown";
import { MarkdownEditorWithPreview } from "./markdown_editor";
import { getImageSrcForKeyOfUserUploadedAttachment } from "../lib/s3";
import { AttachmentsEditor, MaterializedAttachment } from "./attachments_editor";


function getDateStringFromEpochSeconds(epoch_seconds: number): string {
    const date = new Date(epoch_seconds * 1000);
    return date.toLocaleString();
}

async function materializeAttachmentsForRecipe(recipe: DeepRecipe): Promise<Map<number, MaterializedAttachment[]>> {
    const materializedAttachmentsByNoteId : Map<number, MaterializedAttachment[]> = new Map();
    for (const note of recipe.notes) {
        const materializedAttachments = await materializedAttachmentsForNote(note);
        materializedAttachmentsByNoteId.set(note.id, materializedAttachments);
    }
    return materializedAttachmentsByNoteId;
}

async function materializedAttachmentsForNote(note: ShallowNote): Promise<MaterializedAttachment[]> {
    const materializedAttachments : MaterializedAttachment[] = [];
    for (const attachment of note.attachments ?? []) {
        materializedAttachments.push({...attachment, img_src: await getImageSrcForKeyOfUserUploadedAttachment(attachment.name)});
    }
    return materializedAttachments;
}

export async function RecipeCard(recipe: DeepRecipe) {
    const materializedAttachmentsByNoteId = await materializeAttachmentsForRecipe(recipe);

    return (
        <div className="m-10" key={`recipe-${recipe.id}`}>
            <Link href={`/recipes/${recipe.id}`}><h1 className="text-2xl pt-10">{recipe.name}</h1></Link>
            {recipe.notes.map((note: StoredNote) => {
                return <div key={`note-${note.id}`} className="px-5 hover:bg-stone-200 transition-colors duration-200">
                    <div className="flex flex-row space-x-4">
                        <p className="text-xs">{getDateStringFromEpochSeconds(note.date_epoch_seconds)}</p>
                        <Link className="text-xs" href={`/recipes/${recipe.id}/notes/${note.id}/edit`}>Edit Note</Link>
                    </div>
                    <MarkdownPreview content_markdown={note.content_markdown} />
                    <AttachmentsEditor attachments={materializedAttachmentsByNoteId.get(note.id)} />
                </div>
            })}
            <Link href={`/recipes/${recipe.id}/notes/new`}>Add a new note</Link>
        </div>
    );
}

/**
 * Repeats the `filler` on the left of `input` until we reach the desired length.
 * @param input The main content, like `123`
 * @param length The minimum length of the target string, like `5`
 * @param filler What to pad left with, like `0`
 * @returns A padded string with the given params, like `00123`
 */
function leftPad(input: string, length: number, filler: string): string {
    const paddingLength = length - input.length;
    var repeatCount = Math.ceil(paddingLength / filler.length);
    const leftPad = Array(repeatCount).fill(filler).join('');
    const result = leftPad + input;
    assert(result.length >= length, "Left pad failed to make target length string");
    return result;
}

/**
 * Converts epoch in seconds to a string for the input datetime-local field.
 * @param epoch_seconds epoch measured in seconds
 * @returns A string like '2018-06-12T19:30'
 */
function getDateTimeFieldValueFromEpochSeconds(epoch_seconds: number): string {
    const date = new Date(epoch_seconds * 1000);
    const year = date.getFullYear()
    const month = leftPad((date.getMonth() + 1).toString(), 2, '0');
    const day = leftPad(date.getDate().toString(), 2, '0');
    const hours = leftPad(date.getHours().toString(), 2, '0');
    const minutes = leftPad(date.getMinutes().toString(), 2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export async function EditNote(params: { note?: ShallowNote }) {
    const maybe_note = params.note;
    const epoch_seconds = maybe_note ? maybe_note.date_epoch_seconds : Date.now() / 1000;
    const dateFieldValue = getDateTimeFieldValueFromEpochSeconds(epoch_seconds);
    const materializedattachments = maybe_note ? await materializedAttachmentsForNote(maybe_note) : [];
    return (
        <div className="flex flex-col space-y-4">
            <p>{dateFieldValue}</p>
            <div className="flex flex-row">
                <label className="p-2" htmlFor="datetime">Date</label>
                <input className="border bg-slate-200 p-2" type="datetime-local" id="datetime" name="datetime" defaultValue={dateFieldValue} />
            </div>
            <MarkdownEditorWithPreview content_markdown={params.note?.content_markdown} />
            <AttachmentsEditor attachments={materializedattachments} />
            <button type="submit">Save {params.note ? "" : "New "} Note</button>
        </div>
    );
}

export function EditRecipe(params: { recipe?: ShallowRecipe }) {
    return (
        <div className="flex flex-col">
            <div className="flex flex-row">
                <label className="p-2" htmlFor="name">Name</label>
                <input className="border bg-slate-200 p-2" type="text" id="name" name="name" defaultValue={params.recipe?.name} placeholder="Recipe Name" />
            </div>
            <button type="submit">Save {params.recipe ? "" : "New "} Recipe</button>
        </div>
    )
}