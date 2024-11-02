
import Link from "next/link";
import { EmbeddingMatch, LevenshteinMatch, StoredWordEmbedding, getMoreTerms, getRecipes, getRecipesForTerm, getRelatedWordsFromEmbeddings, getRelatedWordsFromTerms, getTermsFromQuery } from "../lib/data";
import { SearchBar } from "../ui/search";
import { Suspense } from "react";
import { DeepRecipe, SearchMatch, StoredNote, StoredRecipe, StoredRecipeSearchMatch } from "../lib/definitions";
import { withTimingAsync } from "../lib/utils";
import PipelineSingleton from "../lib/embeddings_pipeline";
import assert from "assert";
import { FeatureExtractionPipeline } from "@xenova/transformers";
import { has_read_permissions, has_write_permissions } from "@/auth";

type ScoredRecipeMatch = StoredRecipe & {
  matches_by_term: {[term: string]: SearchMatch & {term_score: number}};
  total_score: number;
}

function sortRecipesByRelevance(recipes_by_terms: Map<string, StoredRecipeSearchMatch[]>): ScoredRecipeMatch[] {

  // Create aggregations that track "term frequency" and "document frequency" for each term
  const all_recipes_by_id : Map<number, StoredRecipe> = new Map();
  const recipes_by_id_by_term : Map<string, Map<number, StoredRecipeSearchMatch>> = new Map();
  const tf_by_term_by_document : Map<number, {[term: string]: number}> = new Map();
  const documentFrequencies_by_term: Map<string, number> = new Map();
  recipes_by_terms.forEach((recipe_matches: StoredRecipeSearchMatch[], term: string) => {
    const recipes_by_id = recipes_by_id_by_term.get(term) ?? new Map<number, StoredRecipeSearchMatch>();
    recipes_by_id_by_term.set(term, recipes_by_id);

    recipe_matches.forEach((recipe_match) => {
      all_recipes_by_id.set(recipe_match.id, recipe_match);
      recipes_by_id.set(recipe_match.id, recipe_match);

      const tf_by_term = tf_by_term_by_document.get(recipe_match.id) ?? {};
      if (!(term in tf_by_term)) {
        tf_by_term[term] = 0;
      }

      // 10 pts for each instance of term in title, title matches are high signal
      const name_increment = 10 * recipe_match.name_matches;
      tf_by_term[term] += name_increment;

      // 1 pt for each instance of term in note
      const note_increment = 1 * recipe_match.content_markdown_matches;
      tf_by_term[term] += note_increment;

      // 0.1 pt for each instance of term in note
      const link_increment =  0.1 * recipe_match.link_content_matches;
      tf_by_term[term] += link_increment;

      tf_by_term_by_document.set(recipe_match.id, tf_by_term);

      // Increment document frequency for this term by 1
      const df_increment = name_increment + note_increment + link_increment;
      documentFrequencies_by_term.set(term, (documentFrequencies_by_term.get(term) ?? 0) + df_increment);
    })
  });

  // Now we can calculate "tf-idf" based on the aggregations
  const terms_list = Array.from(recipes_by_terms.keys());
  const num_recipes = tf_by_term_by_document.size;
  console.log('documentFrequencies_by_term.values');
  console.log(documentFrequencies_by_term.values());
  const total_df = Array.from(documentFrequencies_by_term.values()).reduce((prev, curr) => prev + curr, 0);
  const scores : ScoredRecipeMatch[] = Array.from(tf_by_term_by_document.entries()).map(([recipe_id, tf_by_term]) => {

    const matches_by_term : {[term: string]: SearchMatch & {term_score: number}} = {};
    const scores_ = terms_list.map((term: string, term_index: number) => {
      // Locate the recipe match object for this recipe / term combo
      const recipes_by_id = recipes_by_id_by_term.get(term);
      const recipe = recipes_by_id?.get(recipe_id);

      // calculate TF-IDF score
      const tf = (term in tf_by_term) ? tf_by_term[term] : 0;
      const df = documentFrequencies_by_term.get(term) ?? 0;
      const idf_offset = 0.1;  // the IDF offset allows IDF to be non-zero allowing single term search to stll sort by document frequency
      const idf = Math.log2((1 + total_df) / (1 + df) + idf_offset)
      const score = tf*idf*idf; // Note I square IDF because I really want document frequency to deminish term values
      console.log(`For ${term}: tf = ${tf}, df = ${df}, idf = ${idf}, score = ${score}`)

      // Return score object
      matches_by_term[term] = {
        name_matches: recipe?.name_matches ?? 0,
        content_markdown_matches: recipe?.content_markdown_matches ?? 0,
        link_content_matches: recipe?.link_content_matches ?? 0,
        term_score: score,
      };
      return score;
    });

    return {
      ...all_recipes_by_id.get(recipe_id)!,
      matches_by_term,
      total_score: scores_.reduce((cum, val) => cum + val, 0)
    };
  });

  return scores.toSorted((a, b) => b.total_score - a.total_score);
}

async function getSortedRecipesFrontpage(): Promise<ScoredRecipeMatch[]> {
  const recipes = await getRecipes();
  return recipes.map((recipe) => {
    return {
      ...recipe,
      matches_by_term: {},
      total_score: 0,
    }
  });
}

async function RecipesList(params: {recipes: ScoredRecipeMatch[], debug?: string}) {
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
              <h1 className="text-2xl m-10">{recipe.name + (params.debug ? ` - ${recipe.total_score}` : '')}</h1>
              { params.debug ? 
                <div>
                  <code className="whitespace-pre">{JSON.stringify(recipe.matches_by_term, null, '    ')}</code>
                </div> : <></>
              }
            </Link>
          );
        })
      }
    </div>
  )
}

async function getSortedRecipesForQuery(query: string): Promise<ScoredRecipeMatch[]> {
  const terms_list = getTermsFromQuery(query);

  // Query for each term
  const aggregate_matches = (await Promise.all(terms_list.map(async (term: string) => await getRecipesForTerm(term))))

  // Zip them together into Map<term, matches>
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

const getSuggestedTerms = async function (query: string): Promise<{levenshtein: LevenshteinMatch[], db_embeddings: EmbeddingMatch<StoredWordEmbedding>[]}> { return await withTimingAsync('getSuggestedTerms', async () => {
  const terms = getTermsFromQuery(query).map((term) => term.toLowerCase());
  if (terms.length === 0) return {levenshtein: [], db_embeddings: []};

  // More terms by saved embeddings, only works for words we've seen already
  const getSemanticallyRelatedTermsPromise = withTimingAsync('get related words from terms', async () => getRelatedWordsFromTerms(terms));

  // More terms by levenshtein distance
  const getLexicallySimilarTermsPromise = await withTimingAsync('getting more terms from terms via levenshtein', async () => await getMoreTerms(terms));

  // Async kick off both tasks and then await for both so it's parallel, since each can take a bit of time
  const [levenshtein, db_embeddings] = await Promise.all([getLexicallySimilarTermsPromise, getSemanticallyRelatedTermsPromise]);

  return {levenshtein, db_embeddings};
})};

async function SuggestedTerms(params: {levenshtein: LevenshteinMatch[], db_embeddings: EmbeddingMatch<StoredWordEmbedding>[], generate_realtime_embeddings?: boolean, query: string, searchParams: Record<string, string>}) {
  const realtime_embeddings : EmbeddingMatch<StoredWordEmbedding>[] = [];
  const terms = getTermsFromQuery(params.query);
  if (params.generate_realtime_embeddings && terms.length > 0) {
    await withTimingAsync('generate realtime embeddings for suggested terms', async () => {
      const classifier : FeatureExtractionPipeline = await withTimingAsync('PipelineSingleton.getInstance', async () => PipelineSingleton.getInstance());
      const embeddings = await withTimingAsync('generate embeddings in realtime', async () => classifier(terms, {pooling: 'mean', normalize: true}));

      const matches = await withTimingAsync('query for related words from embeddings', async () => getRelatedWordsFromEmbeddings(embeddings.tolist()));
      realtime_embeddings.push(...matches);
    });
  }

  const word_scores : Map<string, {levenshtein?: number, db_embedding?: number}> = new Map();
  for (const match of params.levenshtein) {
    const scores = word_scores.get(match.word) ?? {};
    scores.levenshtein = match.distance;
    word_scores.set(match.word, scores);
  }
  for (const match of [...params.db_embeddings, ...realtime_embeddings]) {
    const scores = word_scores.get(match.word) ?? {};
    scores.db_embedding = match.distance;
    word_scores.set(match.word, scores);
  }

  word_scores.forEach((word_score, word) => {
    for (const term of terms) {
      // Our existing search term would find a superset of the matching word, so don't show it as an option
      if (word.includes(term)) word_scores.delete(word);
    }
  });

  const suggested_words = Array.from(word_scores.entries()).toSorted(([_a_word, a], [_b_word, b]) => {return (((a.levenshtein ?? 200) - (b.levenshtein ?? 200)) + ((a.db_embedding ?? 100) - (b.db_embedding ?? 100)))});

  return (
    <div className="max-w-screen overflow-y-auto py-4">
      <ul className="flex flex-row gap-4">
        <p className="flex-shrink-0">Suggested Terms:</p>
        {
          suggested_words.map(([word, score]) => {
            const urlparams = new URLSearchParams(params.searchParams);
            urlparams.set('query', queryWithOysterTerm(params.query, word));
            const link = `?${urlparams.toString()}`;
            return <li data-score-levenshtein={score.levenshtein} data-score-embedding={score.db_embedding} key={word}><a href={link} title={JSON.stringify(score)}>+{word}</a></li>
          })
        }
      </ul>
    </div>
  );
}

export default async function Recipes(props: {searchParams: Promise<{query?: string, debug?: string}>}) {
  await has_read_permissions();
  const render_write_permission_stuff = await has_write_permissions();
  const searchParams = await props.searchParams;
  const query = searchParams.query || '';

  // Do this work in parallel
  const suggestedTermsPromise = getSuggestedTerms(query);
  const sortedRecipes: ScoredRecipeMatch[] = await withTimingAsync('get all suggested recipes high level', async () => query ? await getSortedRecipesForQuery(query) : await getSortedRecipesFrontpage());
  const {levenshtein, db_embeddings} = await suggestedTermsPromise;

  return (
    <main>
      {render_write_permission_stuff ? <Link href="/recipes/new">Create New Recipe</Link> : <></>}
      <Suspense>
        <SearchBar />
      </Suspense>
      <Suspense key={query + '-suggestions'} fallback={<SuggestedTerms levenshtein={levenshtein} db_embeddings={db_embeddings} query={query} searchParams={searchParams} />}>
        <SuggestedTerms levenshtein={levenshtein} db_embeddings={db_embeddings} query={query} generate_realtime_embeddings={true} searchParams={searchParams} />
      </Suspense>
      <Suspense key={query + '-recipes'} fallback={<p>Loading...</p>}>
        <RecipesList recipes={sortedRecipes} debug={searchParams.debug} />
      </Suspense>
    </main>
  );
}
