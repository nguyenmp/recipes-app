
import Link from "next/link";
import { getMoreTerms, getRecipesWithNotes } from "../lib/data";
import { SearchBar } from "../ui/search";
import { Suspense } from "react";
import { DeepRecipe, StoredNote } from "../lib/definitions";

function getTermsFromQuery(query: string): string[] {
  const pattern = new RegExp('([a-zA-Z]+|[0-9\\.\\,]+)', 'g');
  const matches = query.matchAll(pattern);
  const terms_set = new Set(Array.from(matches).map((match: RegExpExecArray) => {
    return match[0];
  }));
  return Array.from(terms_set);
}

function sortRecipesByRelevance(terms_list: string[], recipes: DeepRecipe[]): DeepRecipe[] {
  const tf_by_term_by_document : {[term: string]: number}[] = new Array(recipes.length);

  const documentFrequencies: number[] = new Array(terms_list.length).fill(0);
  recipes.forEach((recipe: DeepRecipe, recipe_index: number) => {
    terms_list.forEach((term: string, term_index: number) => {
      const all_notes = recipe.notes.map((note: StoredNote) => note.content_markdown)
      const content = [
        recipe.name,
        ...all_notes,
      ].join(' ');
      const term_matches = Array.from(content.matchAll(new RegExp(term, 'gi')));
      if (term_matches.length > 0) {
        documentFrequencies[term_index] += 1;

        if (!(recipe_index in tf_by_term_by_document)) {
          tf_by_term_by_document[recipe_index] = {};
        }
        const tf_by_term = tf_by_term_by_document[recipe_index];
        if (!(term in tf_by_term)) {
          tf_by_term[term] = 0;
        }

        // 10 pts for each instance of term in title, title matches are high signal
        tf_by_term[term] += 10 * (recipe.name.toLowerCase().split(term).length - 1);

        // 1 pt for each instance of term in note
        tf_by_term[term] += 1 * (all_notes.join(' ').toLowerCase().split(term).length - 1);
      }
    })
  });

  const scores : {recipe: DeepRecipe, score: number}[] = recipes.map((recipe: DeepRecipe, recipe_index: number) => {
    const tf_by_term = tf_by_term_by_document[recipe_index] || {};
    const scores_ = terms_list.map((term: string, term_index: number) => {
      const tf = (term in tf_by_term) ? tf_by_term[term] : 0;
      const df = documentFrequencies[term_index];
      const idf_offset = 0.1;  // the IDF offset allows IDF to be non-zero allowing single term search to stll sort by document frequency
      const idf = Math.log2((1 + recipes.length) / (1 + df) + idf_offset)
      const score = tf*idf;
      return score;
    });
    recipe.name = recipe.name + ' ' + JSON.stringify(scores_);
    return {
      recipe,
      score: scores_.reduce((cum, val) => cum + val, 0)
    };
  });

  const sorted = scores.toSorted((a, b) => b.score - a.score);

  return sorted.map((item) => item.recipe);
}

async function RecipesList(params: {recipes: DeepRecipe[]}) {
  const recipes = params.recipes;

  if (recipes.length == 0) {
    return (<p>No results found</p>);
  }

  return (
    <div>
      {
        recipes.map((recipe) => {
          return (
            <Link href={`/recipes/${recipe.id}`} key={recipe.id} className="hover:underline">
              <h1 className="text-2xl m-10">{recipe.name}</h1>
            </Link>
          );
        })
      }
    </div>
  )
}

async function getSortedRecipesForQuery(query: string): Promise<DeepRecipe[]> {
  const terms_list = getTermsFromQuery(query);

  // Query for each term and reduce by duplicate matches
  const recipes_by_id: {[recipe_id: number]: DeepRecipe} = {};
  (await Promise.all(terms_list.map(async (term: string) => await getRecipesWithNotes(term)))).forEach(
    (recipes: DeepRecipe[]) => {
      recipes.forEach((recipe: DeepRecipe) => recipes_by_id[recipe.id] = recipe)
    }
  )
  const recipes = Object.values(recipes_by_id);

  // Then sort by relevancy
  const sortedRecipes = sortRecipesByRelevance(terms_list, recipes);

  return sortedRecipes;
}

export default async function Recipes({searchParams}: {searchParams: {query?: string}}) {
  const query = searchParams.query || '';

  let sortedRecipes = query ? await getSortedRecipesForQuery(query) : await getRecipesWithNotes();

  const terms = getTermsFromQuery(query);
  const more_terms: string[] = [];
  for (const term of terms) {
    const oyster = await getMoreTerms(term);
    console.log('Oyster' + oyster);
    oyster.forEach((new_term: string) => {
      if (terms.includes(new_term)) return;
      more_terms.push(new_term);
    });
  }
  console.log(terms);
  console.log(more_terms);

  return (
    <main>
      <Link href="/recipes/new">Create New Recipe</Link>
      <SearchBar />
      <p>{more_terms.join(' ')}</p>
      <Suspense key={query} fallback={<p>Loading...</p>}>
        <RecipesList recipes={sortedRecipes} />
      </Suspense>
      {/* {words.join(' ')} */}
    </main>
  );
}
