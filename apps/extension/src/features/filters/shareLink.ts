import { createSharedSearch } from "../../domain/searches/client";
import { createLogger } from "../../platform/logging";
import {
    HOSTED_SHARE_PARAM,
    LEGACY_HOSTED_SHARE_PARAM,
    removeSharedFilterParams,
} from "./searchParams";

const logger = createLogger("Share Link");

export async function createSearchShareUrl(
    baseUrl: string,
    filterParams: URLSearchParams,
): Promise<string> {
    const selfContained = new URL(baseUrl);
    selfContained.searchParams.delete(HOSTED_SHARE_PARAM);
    selfContained.searchParams.delete(LEGACY_HOSTED_SHARE_PARAM);
    removeSharedFilterParams(selfContained.searchParams);
    for (const [key, value] of filterParams) selfContained.searchParams.set(key, value);

    try {
        const hosted = await createSharedSearch(filterParams.toString());
        const hostedUrl = new URL(selfContained);
        removeSharedFilterParams(hostedUrl.searchParams);
        hostedUrl.searchParams.set(HOSTED_SHARE_PARAM, hosted.id);
        return hostedUrl.href;
    } catch (error) {
        logger.warn("Could not create a hosted share link, falling back to a self-contained URL", error);
        return selfContained.href;
    }
}
