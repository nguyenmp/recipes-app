import { DeepRecipe, ShallowRecipe, StoredNote } from "../lib/definitions";
import showdown from "showdown";
import Link from 'next/link';

function getDateStringFromEpochSeconds(epoch_seconds: number): string {
    const date = new Date(epoch_seconds * 1000);
    return date.toLocaleString();
}

export function RecipeCard(recipe: DeepRecipe) {
    return (
        <div className="m-10" key={`recipe-${recipe.id}`}>
            <Link href={`/recipes/${recipe.id}`}><h1 className="text-2xl pt-10">{recipe.name}</h1></Link>
            {recipe.notes.map((note: StoredNote) => {
                return <div key={`note-${note.id}`} className="px-5 hover:bg-stone-200 transition-colors duration-200">
                    <p className="text-xs">{getDateStringFromEpochSeconds(note.date_epoch_seconds)}</p>

                    {/* In Tailwind CSS, how to style elements while using dangerouslySetInnerHTML in ReactJS?
              https://stackoverflow.com/questions/74518155/in-tailwind-css-how-to-style-elements-while-using-dangerouslysetinnerhtml-in-re
              https://stackoverflow.com/questions/69276276/why-tailwind-list-style-type-is-not-working */}
                    <div className="markdown-container" dangerouslySetInnerHTML={{ __html: new showdown.Converter({ simplifiedAutoLink: true }).makeHtml(note.content_markdown) }}></div>
                </div>
            })}
        </div>
    );
}

export function EditRecipe(params: {recipe?: ShallowRecipe}) {
    return (
        <div className="flex flex-col">
            <div className="flex flex-row">
                <label className="p-2" htmlFor="name">Name</label>
                <input className="border bg-slate-200 p-2" type="text" id="name" name="name" defaultValue={params.recipe?.name} placeholder="Recipe Name"/>
            </div>
            <button type="submit">Save {params.recipe ? "" : "New "} Recipe</button>
        </div>
    )
}