import { bindListingCards } from "../features/listing-cards";
import { PageMount } from "../shared/platform/router";

const mountAgencyPage: PageMount = context => {
    bindListingCards(context, { showBlacklistedView: false });
};

export default mountAgencyPage;
