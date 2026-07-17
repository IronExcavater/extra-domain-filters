import type { MaybePromise } from "./types";

export type Disposer = () => void;
export type Unbind = Disposer;

const noop: Disposer = () => {};

function once(dispose: Disposer): Disposer {
    let active = true;

    return () => {
        if (!active) return;

        active = false;
        dispose();
    };
}

export interface PropertyValues {
    boolean: boolean;
    number: number;
    string: string;
    range: { min: number; max: number };
}

export type PropertyKind = keyof PropertyValues;
export type PropertyValue<K extends PropertyKind> = PropertyValues[K];

export interface PropertyChange<K extends PropertyKind> {
    readonly source: Property<K>;
    readonly oldValue: PropertyValue<K>;
    readonly newValue: PropertyValue<K>;
}

export type PropertyObserver<K extends PropertyKind> = (
    change: PropertyChange<K>,
) => MaybePromise<void>;

export interface PropertyAdapter<T> {
    get(): MaybePromise<T>;
    set(value: T): MaybePromise<void>;
    observe?(observer: (value: T) => MaybePromise<void>): Disposer;
    dispose?(): void;
}

type LinkMode = 'one-way' | 'two-way';

type PropertyLink = {
    readonly mode: LinkMode;
    readonly source: object;
    readonly target: object;
    readonly unbind: Disposer;
};

export class Property<K extends PropertyKind> {
    private readonly observers = new Set<PropertyObserver<K>>();
    private readonly links = new Set<PropertyLink>();

    private current: Promise<PropertyValue<K>>;
    private readonly stopAdapter: Disposer;
    private disposed = false;

    private constructor(
        readonly kind: K,
        initialValue: MaybePromise<PropertyValue<K>>,
        private readonly adapter?: PropertyAdapter<PropertyValue<K>>,
    ) {
        this.current = Promise.resolve(initialValue);
        this.stopAdapter = adapter?.observe?.(value => this.receive(value)) ?? noop;
    }

    static value<K extends PropertyKind>(
        kind: K,
        initialValue: PropertyValue<K>,
    ): Property<K> {
        return new Property(kind, initialValue);
    }

    static from<K extends PropertyKind>(
        kind: K,
        adapter: PropertyAdapter<PropertyValue<K>>,
    ): Property<K> {
        return new Property(kind, adapter.get(), adapter);
    }

    async get(): Promise<PropertyValue<K>> {
        this.assertActive();

        if (!this.adapter) return await this.current;

        const value = await this.adapter.get();
        this.current = Promise.resolve(value);

        return value;
    }

    async set(value: PropertyValue<K>): Promise<void> {
        this.assertActive();
        const adapter = this.adapter;
        await this.update(value, adapter ? () => adapter.set(value) : undefined);
    }

    observe(observer: PropertyObserver<K>): Disposer {
        this.assertActive();
        this.observers.add(observer);

        return once(() => this.observers.delete(observer));
    }

    async bind(target: Property<K>): Promise<Unbind> {
        this.assertActive();
        target.assertActive();

        this.unbind(target);
        this.unbindTwoWay(target);
        await target.set(await this.get());

        const stop = this.observe(({ newValue }) => target.set(newValue));
        return this.link('one-way', target, stop);
    }

    async bindTwoWay(other: Property<K>): Promise<Unbind> {
        this.assertActive();
        other.assertActive();

        if (other === this) return noop;

        this.unbind(other);
        other.unbind(this);
        this.unbindTwoWay(other);

        let syncing = false;

        const sync = async (
            target: Property<K>,
            value: PropertyValue<K>,
        ): Promise<void> => {
            if (syncing) return;

            syncing = true;

            try {
                await target.set(value);
            } finally {
                syncing = false;
            }
        };

        await sync(other, await this.get());

        const stopForward = this.observe(({ newValue }) => sync(other, newValue));
        const stopBackward = other.observe(({ newValue }) => sync(this, newValue));

        return this.link('two-way', other, stopForward, stopBackward);
    }

    unbind(target: Property<K>): void {
        for (const link of [...this.links]) {
            if (
                link.mode === 'one-way' &&
                link.source === this &&
                link.target === target
            ) {
                link.unbind();
            }
        }
    }

    unbindTwoWay(other: Property<K>): void {
        for (const link of [...this.links]) {
            if (
                link.mode === 'two-way' &&
                ((link.source === this && link.target === other) ||
                    (link.source === other && link.target === this))
            ) {
                link.unbind();
            }
        }
    }

    dispose(): void {
        if (this.disposed) return;

        this.disposed = true;
        this.stopAdapter();

        for (const link of [...this.links]) link.unbind();

        this.links.clear();
        this.observers.clear();
        this.adapter?.dispose?.();
    }

    private async receive(value: PropertyValue<K>): Promise<void> {
        if (this.disposed) return;
        await this.update(value);
    }

    private async update(
        newValue: PropertyValue<K>,
        write?: () => MaybePromise<void>,
    ): Promise<void> {
        const oldValue = await this.current;

        if (Object.is(oldValue, newValue)) return;

        this.current = Promise.resolve(newValue);

        try {
            await write?.();
        } catch (error) {
            this.current = Promise.resolve(oldValue);
            throw error;
        }

        const change: PropertyChange<K> = {
            source: this,
            oldValue,
            newValue,
        };

        for (const observer of [...this.observers]) {
            await observer(change);
        }
    }

    private link(
        mode: LinkMode,
        target: Property<K>,
        ...subscriptions: Disposer[]
    ): Disposer {
        const link: PropertyLink = {
            mode,
            source: this,
            target,
            unbind: once(() => {
                for (const unsubscribe of subscriptions) {
                    unsubscribe();
                }

                this.links.delete(link);
                target.links.delete(link);
            }),
        };

        this.links.add(link);
        target.links.add(link);

        return link.unbind;
    }

    private assertActive(): void {
        if (this.disposed) {
            throw new Error(`The ${this.kind} property has been disposed.`);
        }
    }
}
