import Image from "next/image";

import { recipes } from "./lib/placeholderr-data";
import { Note, Recipe } from "./lib/definitions";

import showdown from "showdown";

function getDateStringFromEpochSeconds(epoch_seconds: number): string {
  const date = new Date(epoch_seconds * 1000);
  return date.toLocaleString();
}

export default function Home() {
  return (
    <main>
      {recipes.map((recipe: Recipe) => {
        return <div className="p-10">
          <h1 className="text-2xl">{recipe.name}</h1>
          {recipe.notes.map((note: Note) => {
            return <div>
              <p className="text-xs">{getDateStringFromEpochSeconds(note.date_epoch_seconds)}</p>

              {/* In Tailwind CSS, how to style elements while using dangerouslySetInnerHTML in ReactJS?
              https://stackoverflow.com/questions/74518155/in-tailwind-css-how-to-style-elements-while-using-dangerouslysetinnerhtml-in-re */}
              <div className="[&>*]:py-3" dangerouslySetInnerHTML={{ __html: new showdown.Converter().makeHtml(note.content_markdown) }}></div>
            </div>
          })}
        </div>
      })}
    </main>
  );
}
