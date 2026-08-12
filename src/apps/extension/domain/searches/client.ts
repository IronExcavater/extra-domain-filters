import { sendExtensionRequest } from "../../platform/messages";
import type { SharedSearch } from "./model";

export function createSharedSearch(params: string): Promise<SharedSearch> {
    return sendExtensionRequest({ type: "shared-search:create", params });
}

export function getSharedSearch(id: string): Promise<SharedSearch | undefined> {
    return sendExtensionRequest({ type: "shared-search:get", id });
}
