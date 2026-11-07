import type { AccountState } from "../domain/account/model";
import type { BlacklistEntry } from "../domain/matching";
import type { SavedSearch } from "../domain/searches/savedSearches";
import type { DomainSessionState } from "../platform/domainPageClient";

export type PopupView = "blacklist" | "login" | "preferences" | "saved-searches";

export interface PopupData {
    account?: AccountState;
    blacklist: BlacklistEntry[];
    domainSession: DomainSessionState;
    savedSearches: SavedSearch[];
}
