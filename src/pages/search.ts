import { bindFilterTriggers, injectFilters } from "../features/filters";
import { bindFilterShareButton } from "../features/filters/share";
import { bindListingCards } from "../features/listing-cards";
import { bindMapPins } from "../features/map/pins";
import { bindSavedSearchFilterSave } from "../features/saved-searches";
import { PageMount } from "../shared/platform/router";
import { getSettings } from "../shared/state/settings";

const mountSearchPage: PageMount = async (context) => {
    bindFilterTriggers(
        ['allfilters', 'mode', 'price', 'bedrooms', 'propertyTypes'].map(id => `button#${id}`),
        context,
    );
    void injectFilters(context.logger, context.url);
    bindListingCards(context);
    void bindFilterShareButton();
    bindSavedSearchFilterSave(context);
    if ((await getSettings()).flags.enableMapPins) bindMapPins(context);
};

export default mountSearchPage;
