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
    attachments?: ShallowAttachment[];
}

export type StoredNote = Omit<ShallowNote, 'attachments'> & {
    id: number;
    recipe_id: number;
    attachments?: StoredAttachment[];
}

export type ShallowAttachment = {
    name: string
}

export type StoredAttachment = ShallowAttachment & {
    id: number,
    note_id: number,
};
