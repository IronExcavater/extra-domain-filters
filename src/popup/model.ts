import type { AccountState } from "../domain/account/model";
import type { BlacklistEntry } from "../domain/matching";
import type { SavedSearch } from "../domain/searches/savedSearches";

export type PopupView = "blacklist" | "preferences" | "saved-searches" | "sign-in";

export interface PopupData {
    account?: AccountState;
    blacklist: BlacklistEntry[];
    savedSearches: SavedSearch[];
}
