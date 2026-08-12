export type MaybePromise<T> = T | Promise<T>;

export type OneOrMany<T> = T | T[];

export function toArray<T>(value: OneOrMany<T> | undefined): T[] {
    if (value === undefined) return [];
    return Array.isArray(value) ? value : [value as T];
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isOneOf<const Values extends readonly string[]>(
    value: unknown,
    values: Values,
): value is Values[number] {
    return typeof value === "string" && values.includes(value);
}

export type DeepPartial<T> =
    T extends readonly unknown[]
        ? T
        : T extends object
            ? { [K in keyof T]?: DeepPartial<T[K]> }
            : T;

export function applyPatch<T extends object>(
    current: T,
    patch: DeepPartial<NoInfer<T>>,
): T {
    const result = structuredClone(current);

    function apply(
        target: Record<string, unknown>,
        source: Record<string, unknown>,
    ): void {
        for (const [key, value] of Object.entries(source)) {
            if (value === undefined) continue;

            const existing = target[key];

            if (isPlainObject(existing) && isPlainObject(value)) apply(existing, value);
            else target[key] = structuredClone(value);
        }
    }

    apply(result as Record<string, unknown>, patch as Record<string, unknown>);

    return result;
}
