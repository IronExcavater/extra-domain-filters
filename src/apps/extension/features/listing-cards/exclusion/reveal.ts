const revealedUrls = new Set<string>();
export const REVEAL_CHANGE_EVENT = "edf:listing-reveal-change";

function normalize(url: string): string {
	return url.replace(/\/+$/, "");
}

function notifyRevealChanged(): void {
	window.dispatchEvent(new Event(REVEAL_CHANGE_EVENT));
}

export function isRevealed(url: string): boolean {
	return revealedUrls.has(normalize(url));
}

export function reveal(url: string): void {
	revealedUrls.add(normalize(url));
	notifyRevealChanged();
}

export function unreveal(url: string): void {
	revealedUrls.delete(normalize(url));
	notifyRevealChanged();
}
