import { bindFilterTriggers, injectFilters } from "../features/filters";
import { bindHomeSearch } from "../features/filters/homeSearch";
import { bindRecentSearches } from "../features/filters/recentSearches";
import { PageMount } from "../shared/platform/router";

const mountHomePage: PageMount = async (context) => {
    bindFilterTriggers(['button[data-testid*="search-filters-button"]'], context);
    bindHomeSearch(context);
    bindRecentSearches(context);
    void injectFilters(context).catch(error => context.logger.warn("Failed to inject home filters", error));
};

export default mountHomePage;
