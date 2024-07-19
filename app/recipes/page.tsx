
import { getRecipesWithNotes } from "../lib/data";
import { Recipe as RecipeUI } from "../ui/recipe";

export default async function Recipes() {
  const recipes = await getRecipesWithNotes();
  return (
    <main>
      {recipes.map((recipe) => {
        return RecipeUI(recipe)
      })}
    </main>
  );
}
