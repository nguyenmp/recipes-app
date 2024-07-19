
import Link from "next/link";
import { getRecipesWithNotes } from "../lib/data";
import { RecipeCard } from "../ui/recipe";

export default async function Recipes() {
  const recipes = await getRecipesWithNotes();
  return (
    <main>
      <Link href="/recipes/new">Create New Recipe</Link>
      {recipes.map((recipe) => {
        return RecipeCard(recipe)
      })}
    </main>
  );
}
