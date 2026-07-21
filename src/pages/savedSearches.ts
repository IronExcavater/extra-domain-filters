import { bindSavedSearchEntries } from "../features/saved-searches";
import type { PageMount } from "../shared/platform/router";

const mountSavedSearchesPage: PageMount = context => {
    bindSavedSearchEntries(context);
};

export default mountSavedSearchesPage;
