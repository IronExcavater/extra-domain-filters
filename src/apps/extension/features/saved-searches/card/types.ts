import type { SavedSearch } from "../../../domain/searches/savedSearches";

export interface SavedSearchActions {
    onEditAlert?(search: SavedSearch, anchor: HTMLElement): Promise<void> | void;
    onNotify?(message: string): void;
    onRemove?(search: SavedSearch): Promise<void> | void;
    onSave?(search: SavedSearch): Promise<void> | void;
}

export interface SavedSearchCardOptions extends SavedSearchActions {
    density?: "comfortable" | "compact";
    openLinksInNewTab?: boolean;
    selected?: boolean;
    signal: AbortSignal;
    onSelectionChange?(selected: boolean): void;
}
