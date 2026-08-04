import type { EnrichmentPace } from "../../shared/state/settings";
import { DAY_MS, HOUR_MS, MINUTE_MS, SECOND_MS } from "../../shared/utils/time";

export interface EnrichmentQueueLimits {
    concurrency: number;
    maxRetries: number;
    minSpacingMs: number;
    timeoutMs: number;
}

export const ENRICHMENT_QUEUE_CAPACITY = 100;
export const ENRICHMENT_BLOCKLIST_CAPACITY = 250;
export const ENRICHMENT_BLOCK_DURATION_MS = 7 * DAY_MS;
export const ENRICHMENT_PAUSE_DURATION_MS = 6 * HOUR_MS;
export const ENRICHMENT_ALARM_DELAY_MS = 30 * SECOND_MS;

const ENRICHMENT_LIMITS = {
    efficient: { concurrency: 1, maxRetries: 1, minSpacingMs: 1_500, timeoutMs: 6_000 },
    balanced: { concurrency: 1, maxRetries: 2, minSpacingMs: 900, timeoutMs: 7_000 },
    fast: { concurrency: 2, maxRetries: 2, minSpacingMs: 500, timeoutMs: 7_000 },
} satisfies Record<EnrichmentPace, EnrichmentQueueLimits>;

export function getEnrichmentLimits(pace: EnrichmentPace): EnrichmentQueueLimits {
    return ENRICHMENT_LIMITS[pace];
}

export function getRetryDelay(status: "failed" | "throttled", attempts: number): number {
    return status === "throttled"
        ? Math.min(DAY_MS, 15 * MINUTE_MS * 2 ** attempts)
        : Math.min(6 * HOUR_MS, MINUTE_MS * 2 ** attempts);
}
