
import Link from "next/link";
import { EmbeddingMatch, getMoreTerms, getRecipes, getRecipesForTerm, getRelatedWords } from "../lib/data";
import { SearchBar } from "../ui/search";
import { Suspense } from "react";
import { DeepRecipe, StoredNote, StoredRecipe, StoredRecipeSearchMatch } from "../lib/definitions";
import { withTimingAsync } from "../lib/utils";
import PipelineSingleton from "../lib/embeddings_pipeline";
import assert from "assert";

function getTermsFromQuery(query: string): string[] {
  const pattern = new RegExp('([a-zA-Z]+|[0-9\\.\\,]+)', 'g');
  const matches = query.matchAll(pattern);
  const terms_set = new Set(Array.from(matches).map((match: RegExpExecArray) => {
    return match[0];
  }));
  return Array.from(terms_set);
}

function sortRecipesByRelevance(recipes_by_terms: Map<string, StoredRecipeSearchMatch[]>): StoredRecipeSearchMatch[] {

  // Create aggregations that track "term frequency" and "document frequency" for each term
  const recipes_by_id : Map<number, StoredRecipeSearchMatch> = new Map();
  const tf_by_term_by_document : Map<number, {[term: string]: number}> = new Map();
  const documentFrequencies_by_term: Map<string, number> = new Map();
  recipes_by_terms.forEach((recipe_matches: StoredRecipeSearchMatch[], term: string) => {
    recipe_matches.forEach((recipe_match) => {
      recipes_by_id.set(recipe_match.id, recipe_match);

      // Increment document frequency for this term by 1
      documentFrequencies_by_term.set(term, (documentFrequencies_by_term.get(term) ?? 0) + 1);

      const tf_by_term = tf_by_term_by_document.get(recipe_match.id) ?? {};
      if (!(term in tf_by_term)) {
        tf_by_term[term] = 0;
      }

      // 10 pts for each instance of term in title, title matches are high signal
      tf_by_term[term] += 10 * recipe_match.name_matches;

      // 1 pt for each instance of term in note
      tf_by_term[term] += 1 * recipe_match.content_markdown_matches;

      tf_by_term_by_document.set(recipe_match.id, tf_by_term);
    })
  });

  // Now we can calculate "tf-idf" based on the aggregations
  const terms_list = Array.from(recipes_by_terms.keys());
  const num_recipes = tf_by_term_by_document.size;
  const scores : {recipe: StoredRecipeSearchMatch, score: number}[] = Array.from(tf_by_term_by_document.entries()).map(([recipe_id, tf_by_term]) => {
    const recipe = recipes_by_id.get(recipe_id);
    assert(recipe, `No recipe found for id ${recipe_id}`);

    const scores_ = terms_list.map((term: string, term_index: number) => {
      const tf = (term in tf_by_term) ? tf_by_term[term] : 0;
      const df = documentFrequencies_by_term.get(term) ?? 0;
      const idf_offset = 0.1;  // the IDF offset allows IDF to be non-zero allowing single term search to stll sort by document frequency
      const idf = Math.log2((1 + num_recipes) / (1 + df) + idf_offset)
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

async function getSortedRecipesForQuery(query: string): Promise<StoredRecipeSearchMatch[]> {
  const terms_list = getTermsFromQuery(query);

  // Query for each term
  const aggregate_matches = (await Promise.all(terms_list.map(async (term: string) => await getRecipesForTerm(term))))
  const matches_by_term = new Map(terms_list.map<[string, StoredRecipeSearchMatch[]]>((term, index) => [term, aggregate_matches[index]]));

  // Then sort by relevancy
  const sortedRecipes = sortRecipesByRelevance(matches_by_term);

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

async function getSemanticallyRelatedTerms(terms: string[]): Promise<string[]> {
  // Just use the default model, but hard-code it so it doesn't change under us and log too much in our logs
  const classifier = await withTimingAsync('create pipeline', async () => await PipelineSingleton.getInstance());
  const response = await withTimingAsync('get embedding for terms', async () => await classifier(terms, {pooling: 'mean', normalize: true}));
  const embeddings = response.tolist();
  const similar_terms = await withTimingAsync('get related words to embedding', async () => await getRelatedWords(embeddings));
  similar_terms.sort((a, b) => b.distance - a.distance);
  return similar_terms.map((similar_term) => similar_term.word);
}

const getSuggestedTerms = async function (query: string): Promise<string[]> { return await withTimingAsync('getSuggestedTerms', async () => {
  const terms = getTermsFromQuery(query).map((term) => term.toLowerCase());
  if (terms.length === 0) return [];

  // async promise so we parallelize the two operations:
  const getSemanticallyRelatedTermsPromise = getSemanticallyRelatedTerms(terms);

  // Add more terms by levenshtein distance
  const more_terms: string[] = []
  await withTimingAsync('getting more terms from terms', async () => {
    const oyster = await getMoreTerms(terms);
    more_terms.push(...oyster);
  });

  const similar_terms = await getSemanticallyRelatedTermsPromise;

  more_terms.push(...similar_terms.splice(0, 10));
  return more_terms.filter((term) => !terms.includes(term));
})};

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

  // Do this work in parallel
  const suggestedTermsPromise = getSuggestedTerms(query);
  const sortedRecipes = await withTimingAsync('get all suggested recipes high level', async () => query ? await getSortedRecipesForQuery(query) : await getRecipes());
  const suggestedTerms = await suggestedTermsPromise;

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
