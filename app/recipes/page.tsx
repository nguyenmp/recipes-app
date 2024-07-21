
import Link from "next/link";
import { getRecipesWithNotes } from "../lib/data";
import { RecipeCard } from "../ui/recipe";
import { SearchBar } from "../ui/search";

export default async function Recipes({searchParams}: {searchParams: {query?: string}}) {
  const recipes = await getRecipesWithNotes();
  return (
    <main>
      <Link href="/recipes/new">Create New Recipe</Link>
      <SearchBar />
      {recipes.map((recipe) => {
        return RecipeCard(recipe)
      })}
    </main>
  );
}
