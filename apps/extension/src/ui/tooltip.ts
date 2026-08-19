import { markOwned } from "../dom/ownership";

export interface TooltipHandle {
    destroy(): void;
    setText(text: string): void;
}

export interface TooltipOptions {
    placement?: "auto" | "bottom" | "top";
    signal?: AbortSignal;
}

const EDGE_GAP = 8;
const TOOLTIP_GAP = 8;
const TOOLTIP_HANDLES = new WeakMap<HTMLElement, InternalTooltipHandle>();

interface InternalTooltipHandle extends TooltipHandle {
    setPlacement(placement: NonNullable<TooltipOptions["placement"]>): void;
}

function isUnavailable(target: HTMLElement): boolean {
    return (target instanceof HTMLButtonElement && target.disabled)
        || target.getAttribute("aria-busy") === "true";
}

function setDescription(target: HTMLElement, id: string, original: string | null): void {
    const ids = new Set((original ?? "").split(/\s+/).filter(Boolean));
    ids.add(id);
    target.setAttribute("aria-describedby", [...ids].join(" "));
}

function restoreDescription(target: HTMLElement, id: string, original: string | null): void {
    const ids = (target.getAttribute("aria-describedby") ?? "")
        .split(/\s+/)
        .filter(value => value && value !== id);
    if (original) original.split(/\s+/).filter(Boolean).forEach(value => ids.push(value));
    const unique = [...new Set(ids)];
    if (unique.length > 0) target.setAttribute("aria-describedby", unique.join(" "));
    else target.removeAttribute("aria-describedby");
}

function placeTooltip(
    target: HTMLElement,
    tooltip: HTMLElement,
    requested: NonNullable<TooltipOptions["placement"]>,
): void {
    const targetRect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const topCandidate = targetRect.top - tooltipRect.height - TOOLTIP_GAP;
    const bottomCandidate = targetRect.bottom + TOOLTIP_GAP;
    const topFits = topCandidate >= EDGE_GAP;
    const bottomFits = bottomCandidate + tooltipRect.height <= window.innerHeight - EDGE_GAP;
    const placement = requested === "top"
        ? (topFits || !bottomFits ? "top" : "bottom")
        : requested === "bottom"
            ? (bottomFits || !topFits ? "bottom" : "top")
            : topFits ? "top" : "bottom";
    const desiredTop = placement === "top" ? topCandidate : bottomCandidate;
    const desiredLeft = targetRect.left + (targetRect.width - tooltipRect.width) / 2;

    tooltip.dataset.placement = placement;
    tooltip.style.left = `${Math.min(
        window.innerWidth - tooltipRect.width - EDGE_GAP,
        Math.max(EDGE_GAP, desiredLeft),
    )}px`;
    tooltip.style.top = `${Math.min(
        window.innerHeight - tooltipRect.height - EDGE_GAP,
        Math.max(EDGE_GAP, desiredTop),
    )}px`;
}

export function attachTooltip(
    target: HTMLElement,
    initialText: string,
    options: TooltipOptions = {},
): TooltipHandle {
    const existing = TOOLTIP_HANDLES.get(target);
    if (existing) {
        existing.setText(initialText);
        existing.setPlacement(options.placement ?? "auto");
        if (options.signal?.aborted) existing.destroy();
        else options.signal?.addEventListener("abort", existing.destroy, { once: true });
        return existing;
    }

    const id = `edf-tooltip-${crypto.randomUUID()}`;
    const originalDescribedBy = target.getAttribute("aria-describedby");
    let destroyed = false;
    let placement = options.placement ?? "auto";
    let text = initialText;
    let tooltip: HTMLElement | undefined;

    const hide = (): void => {
        tooltip?.remove();
        tooltip = undefined;
        restoreDescription(target, id, originalDescribedBy);
    };
    const show = (): void => {
        if (destroyed || tooltip || !text || isUnavailable(target)) return;

        tooltip = markOwned(document.createElement("div"), "tooltip");
        tooltip.className = "edf-tooltip";
        tooltip.id = id;
        tooltip.role = "tooltip";
        tooltip.textContent = text;
        document.body.append(tooltip);
        setDescription(target, id, originalDescribedBy);
        placeTooltip(target, tooltip, placement);
    };
    const onViewportChange = (): void => {
        if (!tooltip) return;
        if (isUnavailable(target)) hide();
        else placeTooltip(target, tooltip, placement);
    };
    const destroy = (): void => {
        if (destroyed) return;
        destroyed = true;
        hide();
        target.removeEventListener("focus", show);
        target.removeEventListener("blur", hide);
        target.removeEventListener("pointerenter", show);
        target.removeEventListener("pointerleave", hide);
        target.removeEventListener("pointerdown", hide);
        window.removeEventListener("resize", onViewportChange);
        window.removeEventListener("scroll", onViewportChange, true);
        options.signal?.removeEventListener("abort", destroy);
        TOOLTIP_HANDLES.delete(target);
    };
    const handle: InternalTooltipHandle = {
        destroy,
        setPlacement: value => {
            placement = value;
            if (tooltip) placeTooltip(target, tooltip, placement);
        },
        setText: value => {
            text = value;
            if (!text) hide();
            else if (tooltip) {
                tooltip.textContent = text;
                placeTooltip(target, tooltip, placement);
            }
        },
    };

    target.removeAttribute("title");
    target.addEventListener("focus", show);
    target.addEventListener("blur", hide);
    target.addEventListener("pointerenter", show);
    target.addEventListener("pointerleave", hide);
    target.addEventListener("pointerdown", hide);
    window.addEventListener("resize", onViewportChange, { passive: true });
    window.addEventListener("scroll", onViewportChange, { capture: true, passive: true });
    TOOLTIP_HANDLES.set(target, handle);
    if (options.signal?.aborted) destroy();
    else options.signal?.addEventListener("abort", destroy, { once: true });
    return handle;
}

export function setTooltipText(target: HTMLElement, text: string): void {
    attachTooltip(target, text).setText(text);
}
