
import Link from "next/link";
import { getRecipesWithNotes } from "../lib/data";
import { RecipeCard } from "../ui/recipe";
import { SearchBar } from "../ui/search";
import { Suspense } from "react";

export async function RecipesList(params: {query?: string}) {
  const recipes = await getRecipesWithNotes(params.query);

  if (recipes.length == 0) {
    return (<p>No results found</p>);
  }

  return (
    <div>
      {
        recipes.map((recipe) => {
          return RecipeCard(recipe);
        })
      }
    </div>
  )
}

export default async function Recipes({searchParams}: {searchParams: {query?: string}}) {
  const query = searchParams.query || '';

  return (
    <main>
      <Link href="/recipes/new">Create New Recipe</Link>
      <SearchBar />
      <Suspense key={query} fallback={<p>Loading...</p>}>
        <RecipesList query={query} />
      </Suspense>
    </main>
  );
}
