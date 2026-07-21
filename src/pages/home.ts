import { bindFilterTriggers, injectFilters } from "../features/filters";
import { PageMount } from "../shared/platform/router";

const mountHomePage: PageMount = async (context) => {
    bindFilterTriggers(['button[data-testid*="search-filters-button"]'], context);
    injectFilters(context.logger, context.url);
};

export default mountHomePage;
