import { markOwned } from "../../../dom/ownership";
import { createSvgIcon } from "../../../ui/elements";
import { replaceWithBinIcon, replaceWithFilledBinIcon } from "../../../ui/icons";
import { showToast } from "../../../ui/toast";
import { attachTooltip, removeTooltip, setTooltipText } from "../../../ui/tooltip";

export type BlacklistActionAppearance =
    | "card"
    | "carousel"
    | "listing-gallery"
    | "listing-lightbox"
    | "listing-sticky"
    | "popup"
    | "project"
    | "shortlist";

export interface BlacklistActionState {
    active: boolean;
    busy?: boolean;
    label?: string;
}

export interface BlacklistActionOptions extends BlacklistActionState {
    appearance: BlacklistActionAppearance;
    onToggle(button: HTMLButtonElement, nextActive: boolean): Promise<void> | void;
    signal?: AbortSignal;
    /** The nearby Domain action, retained for callers that use it to locate the insertion point. */
    template?: HTMLButtonElement;
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
    const visibleLabel = button.querySelector<HTMLElement>(".edf-ui-button-label");

    button.dataset.active = String(state.active);
    if (label) button.dataset.edfLabel = label;
    button.disabled = state.busy ?? false;
    button.setAttribute("aria-busy", String(state.busy ?? false));
    button.setAttribute("aria-pressed", String(state.active));
    button.ariaLabel = actionLabel;
    if (visibleLabel) visibleLabel.textContent = state.active ? "Blacklisted" : (label ?? "Blacklist");
    // Domain's shortlist control keeps one glyph and communicates state through colour/fill.
    // Swapping to a second "restore" glyph made the same action jump between two silhouettes,
    // particularly in the popup where the control is shown beside a compact card heading.
    if (icon) (state.active ? replaceWithFilledBinIcon : replaceWithBinIcon)(icon);
    // Labelled detail-page controls already expose the action in visible text. Tooltips on
    // those buttons duplicate the label and obscure the toolbar; keep them for icon-only
    // card, project-card, carousel, and popup controls only.
    if (visibleLabel) removeTooltip(button);
    else setTooltipText(button, actionLabel);
}

function createFromScratch(options: BlacklistActionOptions): HTMLButtonElement {
    const actionLabel = getActionLabel(options.active, options.label);
    const icon = replaceWithBinIcon;

    const button = document.createElement("button");
    button.type = "button";
    button.ariaLabel = actionLabel;

    // Listing detail toolbars mirror Domain's labelled primitive: a 24px icon box holding an
    // 18px glyph, then the label. Cards use a bare 24px glyph inside a transparent button.
    if (options.appearance.startsWith("listing-")) {
        const iconBox = document.createElement("span");
        iconBox.className = "edf-blacklist-action-icon";
        iconBox.append(createSvgIcon(icon));
        const label = document.createElement("span");
        label.className = "edf-ui-button-label";
        label.textContent = options.label ?? "Blacklist";
        button.append(iconBox, label);
        return button;
    }

    button.append(createSvgIcon(icon));
    attachTooltip(button, actionLabel, { signal: options.signal });
    return button;
}

export function createBlacklistAction(options: BlacklistActionOptions): HTMLButtonElement {
    const button = createFromScratch(options);

    // Keep our semantic state separate from Domain's generated classes: copying those classes
    // also copies the native shortlist yellow, which is the wrong state colour for blacklist.
    button.classList.add("edf-blacklist-action", `edf-blacklist-action-${options.appearance}`);
    button.dataset.blacklistScope = options.appearance.startsWith("listing-")
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
        const nextActive = !active;
        setBlacklistActionState(button, { active, busy: true, label: options.label });
        try {
            await options.onToggle(button, nextActive);
            setBlacklistActionState(button, { active: nextActive, label: options.label });
            showToast(
                nextActive ? "Added to blacklist" : "Removed from blacklist",
                options.appearance === "popup" ? "popup" : "page",
                {
                    action: {
                        label: "Undo",
                        onClick: async () => {
                            setBlacklistActionState(button, {
                                active: nextActive,
                                busy: true,
                                label: options.label,
                            });
                            await options.onToggle(button, active);
                            setBlacklistActionState(button, { active, label: options.label });
                        },
                    },
                },
            );
        } catch (error) {
            setBlacklistActionState(button, { active, label: options.label });
            showToast(
                error instanceof Error ? error.message : "Could not update blacklist",
                options.appearance === "popup" ? "popup" : "page",
            );
        }
    }, { capture: true, signal: options.signal });

    return markOwned(button, "listing-blacklist-action");
}
