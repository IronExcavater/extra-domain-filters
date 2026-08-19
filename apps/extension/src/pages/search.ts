import { bindFilterTriggers } from "../features/filters";
import { bindRecentSearchCapture } from "../features/filters/recentSearches";
import { applySharedFilterParams } from "../features/filters/searchParams";
import { bindSearchShareButton } from "../features/filters/share";
import { bindListingCards } from "../features/listing-cards";
import { bindMapPins } from "../features/map/pins";
import { enableStickyHeader } from "../features/navigation";
import { PageMount } from "../platform/router";
import { getSettings } from "../state/settings";

const mountSearchPage: PageMount = async (context) => {
    enableStickyHeader(context);

    await applySharedFilterParams(context.url);
    bindFilterTriggers(
        ['allfilters', 'mode', 'price', 'bedrooms', 'propertyTypes'].map(id => `button#${id}`),
        context,
    );
    bindRecentSearchCapture(context);
    bindListingCards(context);
    void bindSearchShareButton(context).catch(error => context.logger.warn("Failed to bind search share button", error));
    if ((await getSettings()).flags.enableMapPins) bindMapPins(context);
};

export default mountSearchPage;
