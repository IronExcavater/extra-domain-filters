import { onBodyMutations } from "../../dom/bodyMutations";
import { markOwned } from "../../dom/ownership";
import type { PageContext } from "../../platform/router";
import {
    findNavigationMenus,
    findStickyNavigationBar,
    observeNavigationMenu,
} from "../../site-dom/navigation";

const boundMenus = new WeakMap<HTMLElement, AbortSignal>();
const menuVisualStates = new WeakMap<HTMLElement, { chevron: SVGElement; open: boolean }>();

export function enableNavigationChevronAnimation(context: PageContext): void {
    const syncCarrier = (carrier: HTMLElement): void => {
        const current = findNavigationMenus().find(binding => binding.carrier === carrier);
        if (!current) return;
        const open = current.isOpen();
        const previous = menuVisualStates.get(carrier);
        current.chevron.dataset.edfNavigationChevron = "true";
        if (previous && previous.chevron !== current.chevron) {
            // React occasionally replaces the SVG at the same time as it closes a
            // menu. Transfer the old visual angle to that new node for one frame so
            // the close transition has a real starting point instead of snapping.
            current.chevron.style.transition = "none";
            current.chevron.style.transform = `rotate(${previous.open ? 180 : 0}deg)`;
            requestAnimationFrame(() => {
                if (context.signal.aborted || !current.chevron.isConnected) return;
                current.chevron.style.removeProperty("transition");
                current.chevron.style.removeProperty("transform");
                current.carrier.dataset.edfNavigationOpen = String(open);
            });
        } else {
            current.carrier.dataset.edfNavigationOpen = String(open);
        }
        menuVisualStates.set(carrier, { chevron: current.chevron, open });
    };
    const bind = (): void => {
        for (const binding of findNavigationMenus()) {
            // Domain's React can swap the trigger's inner <svg> (e.g. on hover/focus
            // state) while keeping the same carrier element. Re-mark and re-sync the
            // chevron on every pass so a replaced node picks the animation back up,
            // independent of whether this carrier's listeners are already bound below.
            syncCarrier(binding.carrier);

            const existingSignal = boundMenus.get(binding.carrier);
            if (existingSignal && !existingSignal.aborted) continue;
            boundMenus.set(binding.carrier, context.signal);
            observeNavigationMenu(binding, () => syncCarrier(binding.carrier), context.signal);
            requestAnimationFrame(() => {
                if (!context.signal.aborted && binding.carrier.isConnected) {
                    binding.carrier.dataset.edfNavigationReady = "true";
                }
            });
            context.scope.add(() => {
                if (boundMenus.get(binding.carrier) === context.signal) {
                    boundMenus.delete(binding.carrier);
                }
                menuVisualStates.delete(binding.carrier);
                delete binding.carrier.dataset.edfNavigationOpen;
                delete binding.carrier.dataset.edfNavigationReady;
                binding.carrier.querySelectorAll<SVGElement>(
                    '[data-edf-navigation-chevron="true"]',
                ).forEach(chevron => delete chevron.dataset.edfNavigationChevron);
            });
        }
    };

    bind();
    onBodyMutations(bind, context.signal);
}

export function enableStickyHeader(context: PageContext): void {
    document.documentElement.dataset.edfStickyHeader = "true";
    let navigation: HTMLElement | undefined;
    let stickyHost: HTMLElement | undefined;
    let sentinel: HTMLSpanElement | undefined;
    let placeholder: HTMLSpanElement | undefined;
    let observer: IntersectionObserver | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let layoutFrame: number | undefined;
    const secondaryBars = new Set<HTMLElement>();

    const clearSecondaryBars = (): void => {
        for (const bar of secondaryBars) delete bar.dataset.edfSecondaryStickyBar;
        secondaryBars.clear();
        delete document.documentElement.dataset.edfSecondarySticky;
    };
    const setSecondaryBars = (nextBars: Set<HTMLElement>): void => {
        for (const bar of secondaryBars) {
            if (!nextBars.has(bar)) delete bar.dataset.edfSecondaryStickyBar;
        }
        for (const bar of nextBars) {
            if (!secondaryBars.has(bar)) bar.dataset.edfSecondaryStickyBar = "true";
        }
        secondaryBars.clear();
        nextBars.forEach(bar => secondaryBars.add(bar));
        if (secondaryBars.size > 0) {
            if (document.documentElement.dataset.edfSecondarySticky !== "true") {
                document.documentElement.dataset.edfSecondarySticky = "true";
            }
        } else {
            delete document.documentElement.dataset.edfSecondarySticky;
        }
    };
    const findStickyAncestor = (element: Element): HTMLElement | undefined => {
        for (
            let candidate = element instanceof HTMLElement ? element : element.parentElement;
            candidate && candidate !== document.body;
            candidate = candidate.parentElement
        ) {
            if (candidate === stickyHost || candidate.closest('[data-edf-sticky-header-root="true"]')) {
                return undefined;
            }
            const position = getComputedStyle(candidate).position;
            if (position === "sticky" || position === "fixed") return candidate;
        }
        return undefined;
    };
    const syncLayout = (): void => {
        layoutFrame = undefined;
        if (!stickyHost) return;
        const height = Math.ceil(stickyHost.getBoundingClientRect().height);
        document.documentElement.style.setProperty("--edf-sticky-header-height", `${height}px`);
        if (placeholder && stickyHost.dataset.edfStuck === "true") {
            placeholder.style.height = `${height}px`;
        }

        const candidates = new Set<HTMLElement>();
        const agencyBar = document.querySelector<HTMLElement>(
            '[data-testid="listing-details__agency-sticky-header"]',
        );
        if (agencyBar) candidates.add(agencyBar);
        for (const seed of document.querySelectorAll<HTMLElement>(
            '[role="tablist"], [data-testid*="sticky" i]',
        )) {
            const bar = findStickyAncestor(seed);
            if (bar) candidates.add(bar);
        }
        const nextSecondaryBars = new Set<HTMLElement>();
        for (const bar of candidates) {
            const rect = bar.getBoundingClientRect();
            if (rect.width < Math.min(480, window.innerWidth * 0.55)) continue;
            nextSecondaryBars.add(bar);
        }
        setSecondaryBars(nextSecondaryBars);
    };
    const scheduleLayoutSync = (): void => {
        if (layoutFrame !== undefined) return;
        layoutFrame = requestAnimationFrame(syncLayout);
    };

    const clear = (): void => {
        observer?.disconnect();
        resizeObserver?.disconnect();
        sentinel?.remove();
        placeholder?.remove();
        if (navigation) {
            delete navigation.dataset.edfStuck;
            delete navigation.dataset.edfStickyNavigation;
        }
        if (stickyHost) {
            delete stickyHost.dataset.edfStuck;
            delete stickyHost.dataset.edfStickyHeaderRoot;
        }
        observer = undefined;
        resizeObserver = undefined;
        sentinel = undefined;
        placeholder = undefined;
        navigation = undefined;
        stickyHost = undefined;
    };
    const reconcile = (): void => {
        const nextNavigation = findStickyNavigationBar();
        // Stick the outermost wrapper that holds only the header, so Domain's own centered
        // header keeps its max-width while the white bar and rule span the viewport. Older
        // templates without a full-width shell fall back to the semantic header.
        let nextHost: HTMLElement | undefined =
            nextNavigation?.closest<HTMLElement>('header[role="banner"]') ?? nextNavigation;
        const headerHeight = nextHost?.getBoundingClientRect().height ?? 0;
        const fullWidth = document.documentElement.clientWidth;
        for (let parent = nextHost?.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
            const rect = parent.getBoundingClientRect();
            if (rect.height > headerHeight + 8) break;
            nextHost = parent;
            if (rect.width >= fullWidth * 0.9) break;
        }
        if (!nextNavigation || !nextHost) return;
        if (nextNavigation === navigation && nextHost === stickyHost) return;

        clear();
        navigation = nextNavigation;
        stickyHost = nextHost;
        sentinel = markOwned(document.createElement("span"), "sticky-sentinel");
        placeholder = markOwned(document.createElement("span"), "sticky-placeholder");
        navigation.dataset.edfStickyNavigation = "true";
        stickyHost.dataset.edfStickyHeaderRoot = "true";
        sentinel.ariaHidden = "true";
        sentinel.style.cssText = "display:block;height:1px;margin:0;pointer-events:none;";
        placeholder.ariaHidden = "true";
        placeholder.style.cssText = "display:block;height:0;margin:0;pointer-events:none;";
        stickyHost.before(sentinel);
        sentinel.after(placeholder);
        const observedNavigation = navigation;
        const observedHost = stickyHost;
        observer = new IntersectionObserver(([entry]) => {
            const stuck = String(!entry.isIntersecting);
            observedNavigation.dataset.edfStuck = stuck;
            observedHost.dataset.edfStuck = stuck;
            if (placeholder) {
                placeholder.style.height = stuck === "true"
                    ? `${Math.ceil(observedHost.getBoundingClientRect().height)}px`
                    : "0";
            }
            scheduleLayoutSync();
        });

        observer.observe(sentinel);
        resizeObserver = new ResizeObserver(scheduleLayoutSync);
        resizeObserver.observe(stickyHost);
        scheduleLayoutSync();
    };

    reconcile();
    onBodyMutations(() => {
        reconcile();
        scheduleLayoutSync();
    }, context.signal);
    window.addEventListener("resize", scheduleLayoutSync, { passive: true, signal: context.signal });
    context.scope.add(() => {
        clear();
        clearSecondaryBars();
        if (layoutFrame !== undefined) cancelAnimationFrame(layoutFrame);
        document.documentElement.style.removeProperty("--edf-sticky-header-height");
        delete document.documentElement.dataset.edfStickyHeader;
    });
}
