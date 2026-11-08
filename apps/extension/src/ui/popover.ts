import { markOwned } from "../dom/ownership";

export interface PopoverHandle {
    close(): void;
    element: HTMLElement;
    place(): void;
}

export interface PopoverOptions {
    anchor: HTMLElement;
    content: HTMLElement;
    label: string;
    onClose?(): void;
    signal?: AbortSignal;
}

const EDGE_GAP = 8;
const POPOVER_GAP = 8;
let activePopover: PopoverHandle | undefined;

export function openPopover(options: PopoverOptions): PopoverHandle {
    activePopover?.close();

    const element = markOwned(document.createElement("section"), "popover");
    let closing = false;
    let removed = false;

    element.className = "edf-popover";
    element.role = "dialog";
    element.ariaLabel = options.label;
    element.append(options.content);
    document.body.append(element);

    const place = (): void => {
        if (closing || removed || !element.isConnected) return;

        // Layout size, not the (possibly mid-animation, scaled) bounding box. Anchors can be
        // fixed to the viewport bottom (Domain's floating "Create alert"), so clamp to it too.
        const anchor = options.anchor.getBoundingClientRect();
        const height = element.offsetHeight;
        const width = element.offsetWidth;
        const spaceBelow = window.innerHeight - anchor.bottom - EDGE_GAP;
        const placeBelow = spaceBelow >= height || spaceBelow >= anchor.top - EDGE_GAP;
        const top = placeBelow
            ? anchor.bottom + POPOVER_GAP
            : anchor.top - height - POPOVER_GAP;
        const left = Math.min(
            window.innerWidth - width - EDGE_GAP,
            Math.max(EDGE_GAP, anchor.left + (anchor.width - width) / 2),
        );

        element.dataset.placement = placeBelow ? "bottom" : "top";
        element.style.left = `${Math.max(EDGE_GAP, left)}px`;
        element.style.top = `${Math.max(EDGE_GAP, Math.min(top, window.innerHeight - height - EDGE_GAP))}px`;
    };

    const finishClose = (): void => {
        if (removed) return;
        removed = true;
        element.remove();
        if (options.anchor.isConnected) options.anchor.focus({ preventScroll: true });
        options.onClose?.();
    };
    const close = (): void => {
        if (closing || removed) return;
        closing = true;
        document.removeEventListener("pointerdown", onDocumentPointerDown, true);
        document.removeEventListener("keydown", onDocumentKeyDown, true);
        window.removeEventListener("resize", place);
        resizeObserver.disconnect();
        window.removeEventListener("scroll", place, true);
        options.signal?.removeEventListener("abort", close);
        if (activePopover === handle) activePopover = undefined;
        element.dataset.state = "closing";
        element.inert = true;
        element.setAttribute("aria-hidden", "true");
        void element.offsetWidth;
        const animations = element.getAnimations();
        if (animations.length === 0) {
            queueMicrotask(finishClose);
            return;
        }
        void Promise.allSettled(animations.map(animation => animation.finished)).then(finishClose);
    };
    const onDocumentPointerDown = (event: PointerEvent): void => {
        const target = event.target;
        if (!(target instanceof Node)) return;
        if (!element.contains(target) && !options.anchor.contains(target)) close();
    };
    const onDocumentKeyDown = (event: KeyboardEvent): void => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        close();
    };
    const handle: PopoverHandle = { close, element, place };
    const resizeObserver = new ResizeObserver(place);
    resizeObserver.observe(element);

    activePopover = handle;
    document.addEventListener("pointerdown", onDocumentPointerDown, true);
    document.addEventListener("keydown", onDocumentKeyDown, true);
    window.addEventListener("resize", place, { passive: true });
    window.addEventListener("scroll", place, { capture: true, passive: true });
    place();
    if (options.signal?.aborted) close();
    else options.signal?.addEventListener("abort", close, { once: true });

    return handle;
}
