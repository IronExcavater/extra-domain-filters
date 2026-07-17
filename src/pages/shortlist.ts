import { bindListingCards } from "../features/listing-cards";
import { PageMount } from "../shared/platform/router";

const mountShortlistPage: PageMount = async (context) => {
    bindListingCards(context, { showBlacklistedView: false });
};

export default mountShortlistPage;
