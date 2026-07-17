import { replaceWithBinIcon, replaceWithChevronIcon, replaceWithEyeIcon } from "../../../shared/ui/icons";
import { getListingUrl, getTitle, TOP_LEVEL_CARD_SELECTOR } from "../dom/card";
import { resolveExclusionAction } from "./row";

const GROUP_SELECTOR = '[data-testid="extra-domain-filters-exclusion-group"]';
const GROUP_MEMBER_HIDDEN_STYLE_PROP = "display";
let nextGroupId = 0;
let nextMemberId = 0;

type ActiveReason = "blacklisted" | "filtered";

interface GroupMember {
    card: HTMLElement;
    url: string;
    reason: ActiveReason;
}

function findTopLevelCards(): HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>(TOP_LEVEL_CARD_SELECTOR)];
}

function getActiveReason(card: HTMLElement): ActiveReason | undefined {
    const reason = card.dataset.exclusionReason;
    return reason === "blacklisted" || reason === "filtered" ? reason : undefined;
}

function getMemberUrl(card: HTMLElement): string | undefined {
    const button = card.querySelector<HTMLButtonElement>('[data-testid="listing-card-blacklist"]');
    if (!button) return undefined;

    return getListingUrl(button, card);
}

function createMemberRow(member: GroupMember): HTMLElement {
    const row = document.createElement("div");
    row.className = "edf-exclusion-group-member";

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("width", "16");
    icon.setAttribute("height", "16");
    (member.reason === "blacklisted" ? replaceWithBinIcon : replaceWithEyeIcon)(icon);

    const address = document.createElement("span");
    address.className = "edf-exclusion-group-member-address";
    address.textContent = getTitle(member.card);

    const chevron = document.createElement("button");
    const detailId = `edf-exclusion-group-detail-${nextMemberId++}`;
    chevron.type = "button";
    chevron.className = "edf-exclusion-group-chevron";
    chevron.setAttribute("aria-expanded", "false");
    chevron.setAttribute("aria-controls", detailId);
    chevron.ariaLabel = "Show options";
    const chevronIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    chevronIcon.setAttribute("aria-hidden", "true");
    chevronIcon.setAttribute("width", "16");
    chevronIcon.setAttribute("height", "16");
    replaceWithChevronIcon(chevronIcon);
    chevron.append(chevronIcon);

    const detail = document.createElement("div");
    detail.className = "edf-exclusion-group-detail";
    detail.id = detailId;
    detail.hidden = true;

    const actionButton = document.createElement("button");
    actionButton.type = "button";
    actionButton.className = "edf-exclusion-row-button";
    actionButton.textContent = member.reason === "blacklisted" ? "Unblacklist" : "Show anyway";
    actionButton.ariaLabel = `${actionButton.textContent} ${getTitle(member.card)}`;
    actionButton.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        await resolveExclusionAction(member.url, member.reason);
    });
    detail.append(actionButton);

    chevron.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const expanded = chevron.getAttribute("aria-expanded") === "true";
        chevron.setAttribute("aria-expanded", String(!expanded));
        chevron.ariaLabel = expanded ? "Show options" : "Hide options";
        detail.hidden = expanded;
    });

    row.append(icon, address, chevron, detail);
    return row;
}

function createGroupElement(run: GroupMember[]): HTMLElement {
    const group = document.createElement("div");
    const listId = `edf-exclusion-group-list-${nextGroupId++}`;
    group.className = "edf-exclusion-group";
    group.setAttribute("data-testid", "extra-domain-filters-exclusion-group");

    const summary = document.createElement("div");
    summary.className = "edf-exclusion-row edf-exclusion-group-summary";
    summary.role = "button";
    summary.tabIndex = 0;
    summary.setAttribute("aria-expanded", "false");
    summary.setAttribute("aria-controls", listId);
    summary.ariaLabel = `${run.length} listings hidden`;
    const label = document.createElement("span");
    label.className = "edf-exclusion-row-text";
    label.textContent = `${run.length} listings hidden`;
    summary.append(label);

    const list = document.createElement("div");
    list.id = listId;
    list.className = "edf-exclusion-group-list";
    for (const member of run) list.append(createMemberRow(member));

    group.append(summary, list);

    let closeTimer: number | undefined;
    const clearCloseTimer = (): void => {
        if (closeTimer !== undefined) {
            window.clearTimeout(closeTimer);
            closeTimer = undefined;
        }
    };
    const setExpanded = (expanded: boolean): void => {
        clearCloseTimer();
        group.classList.toggle("edf-exclusion-group-expanded", expanded);
        summary.setAttribute("aria-expanded", String(expanded));
    };
    const expand = (): void => {
        setExpanded(true);
    };
    const collapse = (event?: FocusEvent): void => {
        if (event?.relatedTarget instanceof Node && group.contains(event.relatedTarget)) {
            return;
        }

        closeTimer = window.setTimeout(() => {
            setExpanded(false);
            closeTimer = undefined;
        }, 250);
    };
    const toggleFromKeyboard = (event: KeyboardEvent): void => {
        if (event.key === "Escape") {
            event.preventDefault();
            setExpanded(false);
            summary.focus();
            return;
        }

        if (event.key !== "Enter" && event.key !== " ") return;

        event.preventDefault();
        setExpanded(!group.classList.contains("edf-exclusion-group-expanded"));
    };

    group.addEventListener("mouseenter", expand);
    group.addEventListener("mouseleave", collapse);
    group.addEventListener("focusin", expand);
    group.addEventListener("focusout", collapse);
    group.addEventListener("keydown", toggleFromKeyboard);

    return group;
}

export function updateExclusionGroups(): void {
    document.querySelectorAll(GROUP_SELECTOR).forEach(element => element.remove());

    const cards = findTopLevelCards();
    for (const card of cards) {
        card.style.removeProperty(GROUP_MEMBER_HIDDEN_STYLE_PROP);
    }

    let index = 0;
    while (index < cards.length) {
        const reason = getActiveReason(cards[index]);
        if (!reason) {
            index += 1;
            continue;
        }

        let end = index + 1;
        while (end < cards.length && getActiveReason(cards[end]) !== undefined) {
            end += 1;
        }

        const run = cards.slice(index, end);
        if (run.length >= 2) {
            const members = run
                .map((card): GroupMember | undefined => {
                    const memberReason = getActiveReason(card);
                    const url = getMemberUrl(card);
                    return memberReason && url ? { card, url, reason: memberReason } : undefined;
                })
                .filter((member): member is GroupMember => member !== undefined);

            if (members.length >= 2) {
                const group = createGroupElement(members);
                run[0].before(group);
                for (const member of members) {
                    member.card.style.setProperty(GROUP_MEMBER_HIDDEN_STYLE_PROP, "none", "important");
                }
            }
        }

        index = end;
    }
}
