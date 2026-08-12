import type { AccountState } from "../domain/account/model";
import type { BlacklistEntry } from "../domain/matching";
import type { SavedSearch } from "../domain/searches/savedSearches";

export type PopupView = "blacklist" | "login" | "preferences" | "saved-searches";

export interface PopupData {
    account?: AccountState;
    blacklist: BlacklistEntry[];
    savedSearches: SavedSearch[];
}
