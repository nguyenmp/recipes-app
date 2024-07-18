export type Recipe = {
    name: string;
    notes: Note[];
}

export type StoredRecipe = Recipe & {
    id: number;
    notes: StoredNote[];
}

export type Location = {
    label: string;
    gps: {
        longitude: number;
        latitude: number;
    }
}

export type Note = {
    date_epoch_seconds: number;
    locations: Location[];
    content_markdown: string;
    assets: ExternalAsset[];
}

export type StoredNote = Note & {
    id: number;
    recipe_id: number;
}

export type ExternalAsset =
    | Photo
    | URL;

export type URL = {
    url: string;
}

export type Photo = {
    url: string;
    ocr: string;
}
