import { enableMasonry } from "./masonry";

export interface CollectionFrame {
    cards: HTMLElement;
    element: HTMLElement;
    replaceCards(cards: readonly Node[], animate?: boolean): void;
    setEmptyState(empty?: HTMLElement): void;
    /** The tabs, on the right of the title. */
    setTabs(tabs?: Node): void;
    /** The row under the title: selection on the left, sort on the right. */
    setToolbar(nodes: readonly Node[]): void;
}

export interface CollectionFrameOptions {
    cardsClassName?: string;
    className?: string;
    /** The page's title, with its tabs on the right of it. */
    title?: string;
}

export function createCollectionFrame(options: CollectionFrameOptions = {}): CollectionFrame {
    const element = document.createElement("section");
    const head = document.createElement("div");
    const tabsSlot = document.createElement("div");
    const toolbar = document.createElement("div");
    const body = document.createElement("div");
    const cards = document.createElement("div");
    const empty = document.createElement("div");

    element.className = "edf-collection-frame";
    if (options.className) element.classList.add(...options.className.split(/\s+/).filter(Boolean));
    head.className = "edf-collection-head";
    if (options.title) {
        const title = document.createElement("h1");
        title.className = "edf-collection-heading";
        title.textContent = options.title;
        head.append(title);
    }
    tabsSlot.className = "edf-collection-head-tabs";
    head.append(tabsSlot);
    toolbar.className = "edf-collection-toolbar edf-collection-frame-toolbar";
    body.className = "edf-collection-frame-body";
    cards.className = "edf-collection-frame-cards";
    if (options.cardsClassName) cards.classList.add(...options.cardsClassName.split(/\s+/).filter(Boolean));
    empty.className = "edf-collection-frame-empty";
    empty.hidden = true;
    enableMasonry(cards);
    body.append(cards, empty);
    element.append(head, toolbar, body);

    return {
        cards,
        element,
        replaceCards: (nextCards, animate = false) => {
            cards.replaceChildren(...nextCards);
            if (animate && nextCards.length > 0) {
                cards.removeAttribute("data-animate");
                void cards.offsetWidth;
                cards.dataset.animate = "true";
            }
        },
        setEmptyState: emptyState => {
            empty.replaceChildren(...(emptyState ? [emptyState] : []));
            empty.hidden = !emptyState;
            cards.hidden = Boolean(emptyState);
        },
        setTabs: tabs => tabsSlot.replaceChildren(...(tabs ? [tabs] : [])),
        setToolbar: nodes => toolbar.replaceChildren(...nodes),
    };
}
