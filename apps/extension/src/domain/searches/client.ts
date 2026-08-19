import { sendExtensionMessage } from "../../platform/messaging";
import type { SharedSearch } from "./model";

export function createSharedSearch(params: string): Promise<SharedSearch> {
    return sendExtensionMessage("shared-search:create", { params });
}

export function getSharedSearch(id: string): Promise<SharedSearch | undefined> {
    return sendExtensionMessage("shared-search:get", { id });
}
