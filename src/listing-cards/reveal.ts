// Session-only: a plain in-memory set, never written to chrome.storage. Reloading the page or
// revisiting the search later loses every override and filtered listings go back to being
// filtered — this is intentional (see design spec's "Session-only reveal tracking" section).
const revealedUrls = new Set<string>();

function normalize(url: string): string {
	return url.replace(/\/+$/, "");
}

export function isRevealed(url: string): boolean {
	return revealedUrls.has(normalize(url));
}

export function reveal(url: string): void {
	revealedUrls.add(normalize(url));
}

export function unreveal(url: string): void {
	revealedUrls.delete(normalize(url));
}
