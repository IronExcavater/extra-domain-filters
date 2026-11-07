const enabled = new WeakSet<HTMLElement>();

/**
 * Row-span masonry on a CSS grid: `.edf-masonry` uses 1px implicit rows and each card
 * spans its own height plus the column gap, so cards pack into the shortest slot while
 * keeping left-to-right order (CSS columns reorder cards top-to-bottom).
 * ponytail: replace with native CSS masonry (`display: grid-lanes`) once Chrome ships it.
 */
export function enableMasonry(grid: HTMLElement): void {
    if (enabled.has(grid)) return;
    enabled.add(grid);
    grid.classList.add("edf-masonry");

    const size = (item: Element): void => {
        if (!(item instanceof HTMLElement) || !item.isConnected) return;
        const gap = Number.parseFloat(getComputedStyle(grid).columnGap) || 0;
        const span = `span ${Math.max(1, Math.ceil(item.offsetHeight + gap))}`;
        if (item.style.gridRowEnd !== span) item.style.gridRowEnd = span;
    };
    const resize = new ResizeObserver(entries => entries.forEach(entry => size(entry.target)));
    const watch = (): void => [...grid.children].forEach(child => resize.observe(child));

    new MutationObserver(watch).observe(grid, { childList: true });
    watch();
}
