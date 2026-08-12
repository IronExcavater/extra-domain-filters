export function normalizeListingUrl(url: string): string {
    return url.replace(/\/+$/, "");
}
