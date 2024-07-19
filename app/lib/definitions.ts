export type DeepRecipe = StoredRecipe & {
    notes: StoredNote[];
}

export type ShallowRecipe = {
    name: string;
}

export type StoredRecipe = ShallowRecipe & {
    id: number;
}

export type ShallowNote = {
    date_epoch_seconds: number;
    content_markdown: string;
}

export type StoredNote = ShallowNote & {
    id: number;
    recipe_id: number;
}
