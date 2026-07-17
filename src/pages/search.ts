import { PageMount } from "../core/router";
import { bindListingCards } from "../features/listing-cards";
import { bindFilterTriggers, injectFilters } from "../filters";

const mountSearchPage: PageMount = async (context) => {
    bindFilterTriggers(
        ['allfilters', 'mode', 'price', 'bedrooms', 'propertyTypes'].map(id => `button#${id}`),
        context,
    );
    injectFilters(context.logger, context.url);
    bindListingCards(context);
};

export default mountSearchPage;
