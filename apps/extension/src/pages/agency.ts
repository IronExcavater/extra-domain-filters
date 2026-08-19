import { bindListingCards } from "../features/listing-cards";
import { enableStickyHeader } from "../features/navigation";
import { PageMount } from "../platform/router";

const mountAgencyPage: PageMount = context => {
    enableStickyHeader(context);
    bindListingCards(context, { showBlacklistedView: false });
};

export default mountAgencyPage;
