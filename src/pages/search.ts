import { PageMount } from "../core/router";
import { bindFilterTriggers, injectFilters } from "../filters";
import { bindListingCards } from "../listing-cards";

const mountSearchPage: PageMount = async (context) => {
    bindFilterTriggers(
        ['allfilters', 'mode', 'price', 'bedrooms', 'propertyTypes'].map(id => `button#${id}`),
        context,
    );
    injectFilters(context.logger, context.url);
    bindListingCards(context);
};

export default mountSearchPage;
