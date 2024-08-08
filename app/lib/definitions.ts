export type DeepRecipe = StoredRecipe & {
    notes: StoredNote[];
}

export type ShallowRecipe = {
    name: string;
}

export type StoredRecipe = ShallowRecipe & {
    id: number;
}

export type StoredRecipeSearchMatch = StoredRecipe & {
    name_matches: number;
    content_markdown_matches: number;
}

export type ShallowNote = {
    date_epoch_seconds: number;
    content_markdown: string;
    attachments?: {name: string}[];
}

export type StoredNote = ShallowNote & {
    id: number;
    recipe_id: number;
}
