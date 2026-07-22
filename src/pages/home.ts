import { bindFilterTriggers, injectFilters } from "../features/filters";
import { PageMount } from "../shared/platform/router";

const mountHomePage: PageMount = async (context) => {
    bindFilterTriggers(['button[data-testid*="search-filters-button"]'], context);
    void injectFilters(context);
};

export default mountHomePage;
