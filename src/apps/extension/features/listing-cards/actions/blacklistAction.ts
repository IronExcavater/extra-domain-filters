import { markOwned } from "../../../dom/ownership";
import { createUiButton } from "../../../ui/elements";
import { replaceWithBinIcon, replaceWithUnbinIcon } from "../../../ui/icons";
import { setTooltipText } from "../../../ui/tooltip";

export type BlacklistActionAppearance = "card" | "carousel" | "listing-detail" | "project" | "shortlist";

export interface BlacklistActionState {
    active: boolean;
    busy?: boolean;
    label?: string;
}

export interface BlacklistActionOptions extends BlacklistActionState {
    appearance: BlacklistActionAppearance;
    onToggle(button: HTMLButtonElement): Promise<void> | void;
    signal: AbortSignal;
}

function getActionLabel(active: boolean, label?: string): string {
    if (active) {
        const subject = label?.match(/^blacklist\s+(.+)$/i)?.[1];
        return subject ? `Remove ${subject} from blacklist` : "Remove from blacklist";
    }
    return label ?? "Add to blacklist";
}

export function setBlacklistActionState(
    button: HTMLButtonElement,
    state: BlacklistActionState,
): void {
    const label = state.label ?? button.dataset.edfLabel;
    const actionLabel = getActionLabel(state.active, label);
    const icon = button.querySelector<SVGSVGElement>("svg");

    button.dataset.active = String(state.active);
    if (label) button.dataset.edfLabel = label;
    button.disabled = state.busy ?? false;
    button.setAttribute("aria-busy", String(state.busy ?? false));
    button.setAttribute("aria-pressed", String(state.active));
    button.ariaLabel = actionLabel;
    if (icon) (state.active ? replaceWithUnbinIcon : replaceWithBinIcon)(icon);
    setTooltipText(button, actionLabel);
}

export function createBlacklistAction(options: BlacklistActionOptions): HTMLButtonElement {
    const button = createUiButton({
        ariaLabel: getActionLabel(options.active, options.label),
        icon: options.active ? replaceWithUnbinIcon : replaceWithBinIcon,
        label: options.appearance === "listing-detail" ? (options.label ?? "Blacklist") : undefined,
        signal: options.signal,
        tooltip: getActionLabel(options.active, options.label),
        variant: options.appearance === "listing-detail" ? "secondary" : "icon",
    });

    button.classList.add("edf-blacklist-action", `edf-blacklist-action-${options.appearance}`);
    button.dataset.blacklistScope = options.appearance === "listing-detail"
        ? "listing-details"
        : options.appearance;
    button.dataset.testid = "listing-card-blacklist";
    setBlacklistActionState(button, options);
    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (button.disabled) return;

        const active = button.getAttribute("aria-pressed") === "true";
        setBlacklistActionState(button, { active, busy: true, label: options.label });
        try {
            await options.onToggle(button);
            setBlacklistActionState(button, { active: !active, label: options.label });
        } catch (error) {
            setBlacklistActionState(button, { active, label: options.label });
            throw error;
        }
    }, { capture: true, signal: options.signal });

    return markOwned(button, "listing-blacklist-action");
}
