import { PageMount } from "../core/router";
import { bindListingCards } from "../listing-cards";

const mountShortlistPage: PageMount = async (context) => {
    bindListingCards(context);
};

export default mountShortlistPage;
