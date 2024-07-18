import Image from "next/image";

import { Note, Recipe, StoredNote } from "../lib/definitions";

import showdown from "showdown";
import { getRecipes, getRecipesWithNotes } from "../lib/data";

function getDateStringFromEpochSeconds(epoch_seconds: number): string {
  const date = new Date(epoch_seconds * 1000);
  return date.toLocaleString();
}

export default async function Recipes() {
  const recipes = await getRecipesWithNotes();
  return (
    <main>
      {recipes.map((recipe) => {
        return <div className="m-10" key={`recipe-${recipe.id}`}>
          <h1 className="text-2xl pt-10">{recipe.name}</h1>
          {recipe.notes.map((note: StoredNote) => {
            return <div key={`note-${note.id}`} className="px-5 hover:bg-stone-200 transition-colors duration-200">
              <p className="text-xs">{getDateStringFromEpochSeconds(note.date_epoch_seconds)}</p>

              {/* In Tailwind CSS, how to style elements while using dangerouslySetInnerHTML in ReactJS?
              https://stackoverflow.com/questions/74518155/in-tailwind-css-how-to-style-elements-while-using-dangerouslysetinnerhtml-in-re
              https://stackoverflow.com/questions/69276276/why-tailwind-list-style-type-is-not-working */}
              <div className="markdown-container" dangerouslySetInnerHTML={{ __html: new showdown.Converter({simplifiedAutoLink: true}).makeHtml(note.content_markdown) }}></div>
            </div>
          })}
        </div>
      })}
    </main>
  );
}
