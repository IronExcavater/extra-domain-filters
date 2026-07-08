import { bindFilterTriggers, injectFilters } from "../features/filters";
import { bindListingCards } from "../features/listing-cards";
import { PageMount } from "../shared/router";

const mountSearchPage: PageMount = async (context) => {
    bindFilterTriggers(
        ['allfilters', 'mode', 'price', 'bedrooms', 'propertyTypes'].map(id => `button#${id}`),
        context,
    );
    injectFilters(context.logger, context.url);
    bindListingCards(context);
};

export default mountSearchPage;
