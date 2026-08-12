import { isPlainObject } from "../../utils/types";

export interface SharedSearch {
    createdAt: number;
    expiresAt: number;
    id: string;
    params: string;
}

export interface CreateSharedSearchInput {
    params: string;
}

export function isCreateSharedSearchInput(value: unknown): value is CreateSharedSearchInput {
    return isPlainObject(value) &&
        typeof value.params === "string" &&
        value.params.length <= 8_000;
}

export function isSharedSearchId(value: unknown): value is string {
    return typeof value === "string" && /^[A-Za-z0-9]{1,128}$/.test(value);
}
