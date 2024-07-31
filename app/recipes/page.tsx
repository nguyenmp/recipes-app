
import Link from "next/link";
import { EmbeddingMatch, getMoreTerms, getRecipesWithNotes, getRecipes, getRelatedWords } from "../lib/data";
import { SearchBar } from "../ui/search";
import { Suspense } from "react";
import { DeepRecipe, StoredNote, StoredRecipe } from "../lib/definitions";
import { withTimingAsync } from "../lib/utils";
import PipelineSingleton from "../lib/embeddings_pipeline";

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

async function RecipesList(params: {recipes: StoredRecipe[]}) {
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

function queryWithOysterTerm(query: string, oysterTerm: string) {
  if (query.toLowerCase().includes(oysterTerm)) {
    // If oyster term is a subset of existing terms, we're growing by reducing our specificity, so remove the overly specific term
    // e.g. "Tomatos" + "Tomato" => "Tomato" because "tomato" includes "tomatos"
    return query.replaceAll(new RegExp(`[a-zA-Z]*${oysterTerm}[a-zA-Z]*`, 'gi'), oysterTerm);
  } else {
    // If oyster term is not covered by existing query at all, just append it
    // e.g. "Mexico" + "Mexican" => "Mexico Mexican"
    return query + ' ' + oysterTerm;
  }
}

async function getSuggestedTerms(query: string): Promise<string[]> {
  const terms = getTermsFromQuery(query).map((term) => term.toLowerCase());
  if (terms.length === 0) return [];

  // Add more terms by levenshtein distance
  const more_terms: string[] = []
  await withTimingAsync('getting more terms from terms', async () => {
    for (const term of terms) {
      const oyster = await getMoreTerms(term);
      more_terms.push(...oyster);
    }
  });

  // Add more terms by cosine similarity of word embeddings (semantic meaning)
  const similar_terms: EmbeddingMatch[] = [];

  // Just use the default model, but hard-code it so it doesn't change under us and log too much in our logs
  const classifier = await withTimingAsync('create pipeline', async () => await PipelineSingleton.getInstance());
  for (const term of terms) {
    const response = await withTimingAsync('get embedding for term', async () => await classifier(term));
    const embedding = response.tolist()[0][0];
    const matches = await withTimingAsync('get related words to embedding', async () => await getRelatedWords(embedding));
    similar_terms.push(...matches);
  }
  similar_terms.sort((a, b) => b.distance - a.distance);
  more_terms.push(...similar_terms.map((similar_term) => similar_term.word).splice(0, 10));
  return more_terms.filter((term) => !terms.includes(term));
}

async function SuggestedTerms(params: {terms: string[], query: string}) {

  return (
    <ul className="flex flex-row gap-4">
      {
        params.terms.map((term: string) => {
          const urlparams = new URLSearchParams();
          urlparams.set('query', queryWithOysterTerm(params.query, term));
          const link = `?${urlparams.toString()}`;
          return <li key={term}><Link href={link}>+{term}</Link></li>
        })
      }
    </ul>
  );
}

export default async function Recipes({searchParams}: {searchParams: {query?: string}}) {
  const query = searchParams.query || '';

  const sortedRecipes = await withTimingAsync('get all suggested recipes high level', async () => query ? await getSortedRecipesForQuery(query) : await getRecipes());

  const suggestedTerms = await withTimingAsync('get all suggested terms high level', async () => await getSuggestedTerms(query));

  return (
    <main>
      <Link href="/recipes/new">Create New Recipe</Link>
      <SearchBar />
      <Suspense key={query + '-suggestions'} fallback={<p>Loading...</p>}>
        <SuggestedTerms terms={suggestedTerms} query={query} />
      </Suspense>
      <Suspense key={query + '-recipes'} fallback={<p>Loading...</p>}>
        <RecipesList recipes={sortedRecipes} />
      </Suspense>
    </main>
  );
}
