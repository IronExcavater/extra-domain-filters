export type DomainPageFailure = "cancelled" | "changed-markup" | "rejected" | "timed-out" | "unavailable";

export type DomainPageResult<T extends object = object> =
    | ({ ok: true } & T)
    | { message: string; ok: false; reason: DomainPageFailure };

export function isDomainPageResult(value: unknown): value is DomainPageResult {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<DomainPageResult>;
    return candidate.ok === true
        || (candidate.ok === false
            && typeof candidate.message === "string"
            && typeof candidate.reason === "string");
}
