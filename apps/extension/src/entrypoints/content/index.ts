import { defineContentScript } from "wxt/utils/define-content-script";

import "../../content/tokens.css";
import "../../ui/domainControls.css";
import "../../ui/popover.css";
import "../../ui/collection.css";
import "../../ui/sort.css";
import "../../ui/toast.css";
import "../../ui/tooltip.css";
import "../../features/filters/styles.css";
import "../../features/blacklist/styles.css";
import "../../features/saved-searches/card/card.css";
import "../../features/saved-searches/alertPopover.css";
import "../../features/listing-cards/styles.css";
import "../../features/listing-cards/exclusion/styles.css";
import "../../features/listing-cards/carousel.css";
import "../../features/navigation/styles.css";
import "../../features/account/styles.css";
import "../../features/settings/settings.css";
import "../../features/user-listings/styles.css";

// The content-script bootstrap (router, lifecycle scope, message listener)
// runs as top-level side effects in ../../content/main.
import "../../content/main";

export default defineContentScript({
    matches: ["*://domain.com.au/*", "*://www.domain.com.au/*"],
    cssInjectionMode: "manifest",
    runAt: "document_idle",
    main() {},
});
