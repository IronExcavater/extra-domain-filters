import { defineBackground } from "wxt/utils/define-background";

// All background bootstrap logic (sync loops, chrome.runtime.onMessage handler)
// runs as top-level side effects in ../../background/background -- this import
// is what actually starts the background worker.
import "../../background/background";

export default defineBackground(() => {});
