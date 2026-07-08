// Tracks which values have already been handled, so repeated passes over the same DOM (or any
// other object) can skip what's already done. Each call gets its own independent WeakSet, so
// unrelated contexts (e.g. "have we cloned this section" vs "have we wired this dialog's buttons")
// never collide by sharing one global registry.
export function createClaimTracker<T extends object>(): (value: T) => boolean {
    const claimed = new WeakSet<T>();

    return value => {
        if (claimed.has(value)) return false;
        claimed.add(value);
        return true;
    };
}
