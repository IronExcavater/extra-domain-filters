import { mountProfileSettings } from "../features/settings/profile";
import type { PageMount } from "../shared/platform/router";

const mountProfilePage: PageMount = context => mountProfileSettings(context);

export default mountProfilePage;
