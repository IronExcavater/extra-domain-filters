import { PageMount } from "../core/router";
import { bindFilterTriggers, injectFilters } from "../filters";

const mountHomePage: PageMount = async (context) => {
    bindFilterTriggers(['button[data-testid*="search-filters-button"]'], context);
    injectFilters(context.logger, context.url);
};

export default mountHomePage;
