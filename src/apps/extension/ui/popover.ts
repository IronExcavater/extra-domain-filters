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
    let closed = false;

    element.className = "edf-popover";
    element.role = "dialog";
    element.ariaLabel = options.label;
    element.append(options.content);
    document.body.append(element);

    const place = (): void => {
        if (closed || !element.isConnected) return;

        const anchor = options.anchor.getBoundingClientRect();
        const popover = element.getBoundingClientRect();
        const spaceBelow = window.innerHeight - anchor.bottom - EDGE_GAP;
        const placeBelow = spaceBelow >= popover.height || spaceBelow >= anchor.top - EDGE_GAP;
        const top = placeBelow
            ? anchor.bottom + POPOVER_GAP
            : anchor.top - popover.height - POPOVER_GAP;
        const left = Math.min(
            window.innerWidth - popover.width - EDGE_GAP,
            Math.max(EDGE_GAP, anchor.left + (anchor.width - popover.width) / 2),
        );

        element.dataset.placement = placeBelow ? "bottom" : "top";
        element.style.left = `${Math.max(EDGE_GAP, left)}px`;
        element.style.top = `${Math.max(EDGE_GAP, top)}px`;
    };

    const close = (): void => {
        if (closed) return;
        closed = true;
        document.removeEventListener("pointerdown", onDocumentPointerDown, true);
        document.removeEventListener("keydown", onDocumentKeyDown, true);
        window.removeEventListener("resize", place);
        window.removeEventListener("scroll", place, true);
        options.signal?.removeEventListener("abort", close);
        element.remove();
        if (activePopover === handle) activePopover = undefined;
        if (options.anchor.isConnected) options.anchor.focus({ preventScroll: true });
        options.onClose?.();
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
