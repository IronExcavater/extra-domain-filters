import type { SavedSearch } from "../../../domain/searches/savedSearches";

export interface SavedSearchActions {
    compactAlertModal?: boolean;
    onNotify?(message: string): void;
    onRemove?(search: SavedSearch): Promise<void> | void;
    onSave?(search: SavedSearch): Promise<void> | void;
}

export interface SavedSearchCardOptions extends SavedSearchActions {
    openLinksInNewTab?: boolean;
    selected?: boolean;
    signal: AbortSignal;
    onSelectionChange?(selected: boolean): void;
}
