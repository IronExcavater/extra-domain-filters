export interface CollectionFrame {
    element: HTMLElement;
    replaceCards(cards: readonly Node[], animate?: boolean): void;
    setEmptyState(empty?: HTMLElement): void;
    setToolbar(nodes: readonly Node[]): void;
}

export interface CollectionFrameOptions {
    cardsClassName?: string;
    className?: string;
}

export function createCollectionFrame(options: CollectionFrameOptions = {}): CollectionFrame {
    const element = document.createElement("section");
    const toolbar = document.createElement("div");
    const body = document.createElement("div");
    const cards = document.createElement("div");
    const empty = document.createElement("div");

    element.className = "edf-collection-frame";
    if (options.className) element.classList.add(...options.className.split(/\s+/).filter(Boolean));
    toolbar.className = "edf-collection-toolbar edf-collection-frame-toolbar";
    body.className = "edf-collection-frame-body";
    cards.className = "edf-collection-frame-cards";
    if (options.cardsClassName) cards.classList.add(...options.cardsClassName.split(/\s+/).filter(Boolean));
    empty.className = "edf-collection-frame-empty";
    empty.hidden = true;
    body.append(cards, empty);
    element.append(toolbar, body);

    return {
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
        setToolbar: nodes => toolbar.replaceChildren(...nodes),
    };
}
