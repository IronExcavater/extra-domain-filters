export function createClaimTracker<T extends object>(): (value: T) => boolean {
    const claimed = new WeakSet<T>();

    return value => {
        if (claimed.has(value)) return false;
        claimed.add(value);
        return true;
    };
}
