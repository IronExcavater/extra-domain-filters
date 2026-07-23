import { enableStickyHeader } from "../features/navigation";
import { mountProfileSettings } from "../features/settings/profile";
import type { PageMount } from "../shared/platform/router";

const mountProfilePage: PageMount = context => {
    enableStickyHeader(context);
    return mountProfileSettings(context);
};

export default mountProfilePage;
