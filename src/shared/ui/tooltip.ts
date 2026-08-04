import { markOwned } from "../dom/ownership";

interface TooltipHandle {
    destroy(): void;
    setText(text: string): void;
}

const TOOLTIP_OFFSET_PX = 8;
const TOOLTIP_HANDLES = new WeakMap<HTMLElement, TooltipHandle>();

function placeTooltip(target: HTMLElement, tooltip: HTMLElement): void {
    const rect = target.getBoundingClientRect();
    const width = tooltip.offsetWidth;
    const left = Math.min(
        window.innerWidth - width - TOOLTIP_OFFSET_PX,
        Math.max(TOOLTIP_OFFSET_PX, rect.left + (rect.width - width) / 2),
    );

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(TOOLTIP_OFFSET_PX, rect.top - tooltip.offsetHeight - TOOLTIP_OFFSET_PX)}px`;
}

export function attachTooltip(target: HTMLElement, initialText: string): TooltipHandle {
    const existing = TOOLTIP_HANDLES.get(target);
    if (existing) {
        existing.setText(initialText);
        return existing;
    }

    const id = `edf-tooltip-${crypto.randomUUID()}`;
    let text = initialText;
    let tooltip: HTMLElement | undefined;

    const hide = (): void => {
        tooltip?.remove();
        tooltip = undefined;
    };
    const show = (): void => {
        if (tooltip || !text) return;

        tooltip = document.createElement("div");
        tooltip.className = "edf-tooltip";
        tooltip.id = id;
        tooltip.role = "tooltip";
        tooltip.textContent = text;
        document.body.append(markOwned(tooltip, "tooltip"));
        placeTooltip(target, tooltip);
    };
    const onViewportChange = (): void => {
        if (tooltip) placeTooltip(target, tooltip);
    };

    target.removeAttribute("title");
    target.setAttribute("aria-describedby", id);
    target.addEventListener("focus", show);
    target.addEventListener("blur", hide);
    target.addEventListener("pointerenter", show);
    target.addEventListener("pointerleave", hide);
    target.addEventListener("pointerdown", hide);
    window.addEventListener("resize", onViewportChange, { passive: true });
    window.addEventListener("scroll", onViewportChange, { capture: true, passive: true });

    const handle: TooltipHandle = {
        destroy: () => {
            hide();
            target.removeAttribute("aria-describedby");
            target.removeEventListener("focus", show);
            target.removeEventListener("blur", hide);
            target.removeEventListener("pointerenter", show);
            target.removeEventListener("pointerleave", hide);
            target.removeEventListener("pointerdown", hide);
            window.removeEventListener("resize", onViewportChange);
            window.removeEventListener("scroll", onViewportChange, true);
            TOOLTIP_HANDLES.delete(target);
        },
        setText: nextText => {
            text = nextText;
            if (tooltip) {
                tooltip.textContent = text;
                placeTooltip(target, tooltip);
            }
        },
    };
    TOOLTIP_HANDLES.set(target, handle);
    return handle;
}

export function setTooltipText(target: HTMLElement, text: string): void {
    attachTooltip(target, text).setText(text);
}
