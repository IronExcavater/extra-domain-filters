import { PageMount } from "../core/router";
import { bindListingCards } from "../features/listing-cards";

const mountShortlistPage: PageMount = async (context) => {
    bindListingCards(context, { showBlacklistedView: false });
};

export default mountShortlistPage;
