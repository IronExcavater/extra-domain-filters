export interface CollectionController<TFilter, TItem, TSort> {
    clearSelection(): void;
    getSelection(): ReadonlySet<string>;
    getVisibleItems(): readonly TItem[];
    replaceItems(items: readonly TItem[]): void;
    replaceSelection(ids: readonly string[]): void;
    selectAllVisible(): void;
    setFilter(filter: TFilter): void;
    setSort(sort: TSort): void;
    subscribe(listener: () => void, signal?: AbortSignal): () => void;
    toggleSelection(id: string): void;
}

export interface CollectionControllerOptions<TFilter, TItem, TSort> {
    filter(item: TItem, value: TFilter): boolean;
    getId(item: TItem): string;
    initialFilter: TFilter;
    initialItems: readonly TItem[];
    initialSelection?: readonly string[];
    initialSort: TSort;
    sort(items: readonly TItem[], value: TSort): readonly TItem[];
}

export function createCollectionController<TFilter, TItem, TSort>(
    options: CollectionControllerOptions<TFilter, TItem, TSort>,
): CollectionController<TFilter, TItem, TSort> {
    let filter = options.initialFilter;
    let items = [...options.initialItems];
    let sort = options.initialSort;
    const listeners = new Set<() => void>();
    const selection = new Set(options.initialSelection ?? []);
    const notify = (): void => listeners.forEach(listener => listener());
    const getVisibleItems = (): readonly TItem[] => options.sort(
        items.filter(item => options.filter(item, filter)),
        sort,
    );
    const replaceSelection = (ids: readonly string[]): void => {
        const available = new Set(items.map(options.getId));
        selection.clear();
        ids.filter(id => available.has(id)).forEach(id => selection.add(id));
        notify();
    };

    replaceSelection([...selection]);

    return {
        clearSelection: () => replaceSelection([]),
        getSelection: () => new Set(selection),
        getVisibleItems,
        replaceItems: nextItems => {
            items = [...nextItems];
            const available = new Set(items.map(options.getId));
            for (const id of selection) {
                if (!available.has(id)) selection.delete(id);
            }
            notify();
        },
        replaceSelection,
        selectAllVisible: () => replaceSelection(getVisibleItems().map(options.getId)),
        setFilter: value => {
            filter = value;
            notify();
        },
        setSort: value => {
            sort = value;
            notify();
        },
        subscribe: (listener, signal) => {
            if (signal?.aborted) return () => undefined;
            listeners.add(listener);
            const unsubscribe = (): void => {
                listeners.delete(listener);
            };
            signal?.addEventListener("abort", unsubscribe, { once: true });
            return unsubscribe;
        },
        toggleSelection: id => {
            if (selection.has(id)) selection.delete(id);
            else if (items.some(item => options.getId(item) === id)) selection.add(id);
            notify();
        },
    };
}
