export const SECOND_MS = 1_000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export function exponentialBackoff(
    attempt: number,
    initialDelayMs: number,
    maximumDelayMs: number,
): number {
    return Math.min(maximumDelayMs, initialDelayMs * 2 ** attempt);
}
